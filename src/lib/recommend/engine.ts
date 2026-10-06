import type { Place, Plan, PlannerInput, MoodId, BudgetId, DurationId, StopWeather, CategoryId } from "@/lib/types";
import { places as STATIC_PLACES } from "@/lib/data/places";
import { buildPlan, chainLabel } from "@/lib/plan";
import { pt } from "@/lib/geo";
import { ceilTo, fromMinutes, isOpenDuring, moscowNow } from "@/lib/format";
import { travelBetween, travelToPlace, type Travel } from "@/lib/location";
import { bringList, daySummary, moscowDateISO, outdoorVerdict, weekdayOf, windowWx, type Forecast } from "@/lib/forecast";
import { isSuburban } from "@/lib/location";
import { inMoscow, okrugOfOrigin, tierOf, type Tier } from "@/lib/moscow";
import { explainPlan } from "./explain";

/**
 * Recommendation layer v2 (без LLM как источника истины).
 *
 *  1. Контекст дня: дата, старт, окно, прогноз по часам, точка выезда.
 *  2. Жёсткие фильтры: возраст (всем детям), время в пути, бюджет, ограничения сценария, «не понравилось».
 *  3. Скоринг места: настроение, интересы каждого ребёнка, близость, рейтинг, хотелки/история, ротация.
 *  4. Сборка дня по слотам до заполнения окна: якорь → еда → второе занятие → бонус.
 *  5. Порядок шагов перебором: часы работы на момент прибытия + погода в окне каждого шага + дорога.
 *  6. Набор из 3 планов с разнообразием (MMR) и «сюрпризом», крытые замены для уличных шагов.
 */

export const DURATION_MIN: Record<DurationId, number> = { short: 120, mid: 240, half: 330, day: 450 };
export const BUDGET_MAX: Record<BudgetId, number> = { free: 0, "2000": 2000, "5000": 5000, any: Infinity };
const MIN_STOPS: Record<DurationId, number> = { short: 1, mid: 2, half: 3, day: 3 };
const MAX_STOPS: Record<DurationId, number> = { short: 2, mid: 3, half: 4, day: 5 };
/** Сколько готовы ехать до первой точки по умолчанию, мин. */
const DEFAULT_REACH: Record<PlannerInput["transport"], number> = { walk: 25, transit: 45, car: 40 };
/** Максимум между соседними шагами, мин. */
const LEG_MAX: Record<PlannerInput["transport"], number> = { walk: 18, transit: 25, car: 20 };
const BUFFER = 10;
const ACTIVITY: CategoryId[] = ["park", "play", "museum", "active", "animals"];

export interface ScoredPlace {
  place: Place;
  score: number;
  km: number;
  minutes: number;
  parts: Record<string, number>;
  /** Для округа: 0 — в самом округе, 1 — в соседнем, 2 — дальше. */
  tier?: Tier;
}

/* ───────── 1. Контекст ───────── */

export type Season = "winter" | "spring" | "summer" | "autumn";
export const seasonOf = (month: number): Season => (month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn");

/** Погода дня одним взглядом — от неё зависят вес «улицы» и «под крышей». */
export interface DayCond {
  wet: "all" | "later" | "none";
  cold: boolean;
  hot: boolean;
  snow: boolean;
  sunny: boolean;
  warm: boolean;
  temp: number;
}

export interface DayCtx {
  dateISO: string;
  weekday: number;
  dayOffset: number;
  start: number;
  end: number;
  total: number;
  tomorrow: boolean;
  forecast?: Forecast;
  youngest: number;
  oldest: number;
  reach: number;
  rainFrom?: string;
  /** Минуты с полуночи сейчас (только если планируем на сегодня). */
  nowMin: number | null;
  month: number;
  season: Season;
  weekend: boolean;
  cond: DayCond;
}

export function dayContext(input: PlannerInput, reachMul = 1): DayCtx {
  const now = moscowNow(input.now);
  const want = DURATION_MIN[input.duration];
  const c = input.constraints ?? {};
  let offset = input.dayOffset ?? 0;
  let start: number;
  if (offset === 0) {
    start = ceilTo(now.minutes + 40, 30); // собраться и доехать
    const latest = (c.endBy ?? 21 * 60) - Math.min(want, 90);
    if (start > Math.min(18 * 60, latest)) {
      offset = 1;
      start = 10 * 60 + 30;
    }
  } else start = want >= 330 ? 10 * 60 + 30 : 11 * 60;
  start = Math.max(start, 10 * 60, c.startAt ?? 0);
  const endBy = Math.min(c.endBy ?? 21 * 60, 21 * 60);
  const total = Math.max(60, Math.min(want, endBy - start - 15));
  const dateISO = moscowDateISO(offset, input.now);
  const ages = input.children.map((k) => k.age);
  const reachBase = c.maxTravelMin ?? DEFAULT_REACH[input.transport];
  const reach = Math.min(150, (input.maxDistanceKm ? Math.min(reachBase, 20) : reachBase) * reachMul);
  const sum = input.forecast ? daySummary(input.forecast, dateISO) : undefined;
  const month = Number(dateISO.slice(5, 7));
  const weekday = offset === 0 ? now.weekday : weekdayOf(dateISO);
  const w = sum?.window;
  const legacy = input.weather;
  const cond: DayCond = sum && w
    ? {
        wet: sum.allWet ? "all" : sum.rainFrom ? "later" : "none",
        cold: w.feelsMax < -5,
        hot: w.feelsMax >= 27,
        snow: w.condition === "snow",
        sunny: w.condition === "sun" && !sum.allWet,
        warm: w.tempMax >= 16,
        temp: sum.weather.temp,
      }
    : {
        wet: legacy.condition === "rain" || legacy.condition === "snow" ? "all" : "none",
        cold: legacy.temp < -8,
        hot: legacy.temp >= 28,
        snow: legacy.condition === "snow",
        sunny: legacy.condition === "sun",
        warm: legacy.temp >= 16,
        temp: legacy.temp,
      };
  return {
    dateISO,
    weekday,
    dayOffset: offset,
    start,
    end: start + total,
    total,
    tomorrow: offset > 0,
    forecast: input.forecast,
    youngest: ages.length ? Math.min(...ages) : 5,
    oldest: ages.length ? Math.max(...ages) : 5,
    reach,
    rainFrom: sum?.rainFrom,
    nowMin: offset === 0 ? now.minutes : null,
    month,
    season: seasonOf(month),
    weekend: weekday >= 5,
    cond,
  };
}

/* ───────── 2–3. Фильтры и скоринг ───────── */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function moodFit(p: Place, mood: MoodId): number {
  switch (mood) {
    case "energy":
      return p.activity_level === 3 ? 1 : p.activity_level === 2 ? 0.35 : 0;
    case "creative":
      if (p.experience_tags.includes("workshop")) return 1;
      if (p.interest_tags.some((t) => t === "drawing" || t === "music")) return 0.7;
      if (p.interest_tags.some((t) => t === "cooking" || t === "construction")) return 0.5;
      return 0.1;
    case "learn":
      return p.category === "museum" ? 1 : p.category === "animals" ? 0.75 : p.interest_tags.includes("science") ? 0.7 : 0.1;
    case "outdoor":
      return p.outdoor ? 1 : 0.05;
    case "calm":
      return p.activity_level === 1 ? 1 : p.noise_level <= 2 && p.activity_level === 2 ? 0.5 : 0;
    case "surprise":
      return (p.experience_tags.includes("unusual") ? 0.6 : 0.3) + (p.is_hit ? 0.3 : 0);
  }
}

/**
 * «Тип» ситуации: развивающая — это музеи и наука, прогулка — парки и улица, спорт — активные места.
 * Нужен, чтобы в строгом режиме округа честно сказать «здесь такого нет», а не подсунуть парк под «развивающее».
 */
export function coreFit(p: Place, input: Pick2<PlannerInput, "mood" | "constraints">): boolean {
  const c = input.constraints ?? {};
  if (input.mood === "learn" && moodFit(p, "learn") < 0.7) return false;
  if (input.mood === "creative" && moodFit(p, "creative") < 0.5) return false;
  if (input.mood === "energy" && moodFit(p, "energy") < 0.35) return false;
  if (input.mood === "outdoor" && !p.outdoor) return false;
  const cats = c.preferCategories;
  // сценарий про конкретные занятия («к животным», «на каток», «в театр»): основное место — из них или нужного формата
  if (cats?.length && cats.every((k) => ACTIVITY.includes(k))) {
    const byFormat = c.experiences?.some((e) => p.experience_tags.includes(e));
    if (!cats.includes(p.category) && !byFormat) return false;
  }
  return true;
}

/** Насколько улица подходит хоть когда-то в окне дня (для предварительного отбора). */
export function dayOutdoorScore(ctx: DayCtx): number {
  if (!ctx.forecast) return 0.8;
  let best = 0;
  for (let t = ctx.start; t < ctx.end; t += 60) {
    const v = outdoorVerdict(windowWx(ctx.forecast, ctx.dateISO, t, t + 90), ctx.youngest);
    if (v.ok) best = Math.max(best, v.score);
  }
  return best;
}

export function scorePlace(
  p: Place,
  input: PlannerInput,
  ages: number[],
  ctx = dayContext(input),
  outdoorDay = dayOutdoorScore(ctx),
  partialAge = false
): ScoredPlace | null {
  const c = input.constraints ?? {};
  const fam = input.family;
  const mode = input.locationMode ?? "exact";
  const travel = legHome(input, p);
  const anchorLike = isAnchorLike(p, input);
  const reach = anchorLike ? ctx.reach : ctx.reach * 1.35;
  // В общем режиме пользователь явно выбирает географию: Москва или Москва + область.
  if (mode === "any" && input.geoScope !== "moscow-region" && (!inMoscow(p) || isSuburban(pt(p)))) return null;
  // округ: основное место — только в самом округе, соседние округа годятся для кафе и магазина по пути
  const okr = areaOf(input);
  const strict = !!okr && input.areaScope !== "wide";
  const tier = okr ? tierOf(p, okr) : undefined;
  if (strict && tier !== undefined && (tier === 2 || (tier === 1 && anchorLike))) return null;
  if (okr && input.areaScope === "adjacent" && tier === 2) return null;
  if (mode !== "any" && travel.minutes > reach && !(strict && tier === 0)) return null;

  // возраст: по умолчанию место должно подходить всем детям
  const fit = ages.length ? ages.filter((a) => a >= p.age_min && a <= p.age_max).length / ages.length : 1;
  if (fit === 0 || (!partialAge && fit < 1)) return null;

  const budgetMax = BUDGET_MAX[input.budget];
  if (input.budget === "free" ? p.price_min > 0 : p.family_budget > budgetMax) return null;

  if (c.indoorOnly && !p.indoor) return null;
  if (c.quiet && p.noise_level === 3) return null;
  if (c.stroller && !p.stroller_friendly) return null;
  if (c.avoidCategories?.includes(p.category)) return null;
  if (fam?.disliked.includes(p.slug)) return null;

  // погода: место только на улице, а весь день плохо — не берём
  const badDayLegacy = !input.forecast && (input.weather.condition === "rain" || input.weather.condition === "snow");
  const outdoorOnly = p.outdoor && !p.indoor;
  if (outdoorOnly && (outdoorDay === 0 || badDayLegacy) && !(badDayLegacy && input.mood === "outdoor" && !c.indoorOnly)) return null;

  const kidInterests = input.children.map((k) => k.interests);
  const interestKids = kidInterests.filter((ints) => ints.some((i) => p.interest_tags.includes(i))).length;
  const interest = kidInterests.some((x) => x.length) ? interestKids / kidInterests.length : 0.3;
  const scenarioInterest = c.interests?.some((i) => p.interest_tags.includes(i)) ? 2 : 0;
  // «лучший возраст»: ближе к середине диапазона места — интереснее, чем у краёв
  const mid = (p.age_min + p.age_max) / 2;
  const half = Math.max(1.5, (p.age_max - p.age_min) / 2 + 0.5);
  const sweet = ages.length ? ages.reduce((acc, a) => acc + Math.exp(-(((a - mid) / half) ** 2) * 0.9), 0) / ages.length : 0.7;

  const parts: Record<string, number> = {
    age: fit * 2 + sweet * 2 + ageNeeds(p, ctx),
    // «центр округа» — условная точка, внутри округа расстояние от неё почти ничего не значит
    distance: mode === "any" ? 0 : Math.max(0, 1 - travel.minutes / ctx.reach) ** 1.3 * (input.transport === "walk" ? 10 : 8.5) * (strict ? 0.3 : mode === "area" ? 0.7 : 1),
    // «шире округа»: выбранный округ всё равно впереди соседних
    area: !okr || strict ? 0 : tier === 0 ? 2.4 : tier === 1 ? 0.8 : 0,
    // При широком поиске область доступна, но Москва остаётся чуть выше при прочих равных.
    geography: mode === "any" && input.geoScope === "moscow-region" && (p.region === "mo" || isSuburban(pt(p))) ? -1.1 : 0,
    interest: interest * 8 + scenarioInterest,
    rating: p.rating_source ? p.rating - 4 : 0,
    mood: moodFit(p, input.mood) * 9,
    shelter: c.indoorOnly && p.outdoor ? -3 : 0,
    activity: input.activity ? 1 - Math.abs(p.activity_level - input.activity) / 2 : 0.5,
    // данные OpenStreetMap не проверены редакцией — при прочих равных отдаём предпочтение каталогу
    trust: p.confidence === "osm" ? -0.7 : 0,
    popularity: (p.is_hit ? 0.4 : 0) + (p.review_count > 0 ? Math.min(0.4, p.review_count / 10000) : 0),
    weather: weatherFit(p, ctx, outdoorDay, input),
    season: seasonFit(p, ctx),
    crowd: crowdFit(p, ctx, input),
    transport: transportFit(p, input),
    prefer:
      // сценарий про одну категорию («к животным», «на каток») тянет к ней сильнее, чем про несколько
      (c.preferCategories?.includes(p.category) ? (c.preferCategories.length === 1 ? 4.6 : 3.4) : 0) +
      (c.outdoorPreferred && p.outdoor ? 2 : 0) +
      // формат сценария: «спектакль», «мастер-класс», «книги»…
      (c.experiences?.some((e) => p.experience_tags.includes(e)) ? 2.4 : 0) +
      // компания / праздник: места, где принимают брони и есть игровая зона
      (c.bookingOk && (p.booking_required || p.experience_tags.includes("playzone")) ? 1.6 : 0),
    family:
      (fam?.want.includes(p.slug) ? 2.5 : 0) +
      (fam?.loved.includes(p.slug) ? 1 : 0) -
      (fam?.visited.includes(p.slug) && !fam?.loved.includes(p.slug) ? 2 : 0) -
      (fam?.seen?.includes(p.slug) ? 0.8 : 0),
    rotation: hash(`${input.seed ?? ""}:${p.id}`) * 0.9,
    // При скромном бюджете дорогой якорь «съедает» весь день.
    // В режиме «бесплатно» предпочитаем действительно бесплатные места, а не варианты «от 0 ₽» с платными активностями.
    // При бюджете 5 000 ₽ небольшой bonus помогает использовать доступный бюджет на более насыщенное событие,
    // но он заметно слабее intent/возраста/географии и не заставляет тратить деньги любой ценой.
    price:
      input.budget === "free"
        ? (p.price_max === 0 || p.family_budget === 0 ? 1.6 : 0)
        : Number.isFinite(budgetMax) && budgetMax > 0
          ? -((p.family_budget / budgetMax) ** 1.3) * (input.budget === "2000" ? 3.4 : 1.4) + (input.budget === "5000" && p.price_min > 0 ? 1.25 : 0)
          : budgetMax === Infinity
            ? (p.price_level >= 2 && p.rating >= 4.6 ? 0.6 : 0)
            : 0,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { place: p, score, km: travel.km, minutes: travel.minutes, parts, tier };
}

/** Основное занятие дня (якорь): парк, игра, музей, актив, животные — и кафе с игровой, если нужна передышка. */
function isAnchorLike(p: Pick2<Place, "category" | "experience_tags">, input: Pick2<PlannerInput, "constraints">): boolean {
  return ACTIVITY.includes(p.category) || !!(input.constraints?.parentBreak && p.category === "cafe" && p.experience_tags.includes("playzone"));
}

/** Округ, в котором ищем (если выбран округ Москвы, а не адрес, точка или город области). */
export function areaOf(input: Pick2<PlannerInput, "location" | "locationMode">): string | undefined {
  if (input.locationMode !== "area") return undefined;
  const o = input.location as PlannerInput["location"] & { label?: string; source?: "area" };
  return okrugOfOrigin({ source: "area", label: o.label ?? "", lat: o.lat, lng: o.lng })?.id;
}

/** Потребности возраста: малышу — коляска и тишина, старшему — «не малышовое». */
function ageNeeds(p: Place, ctx: DayCtx): number {
  let v = 0;
  if (ctx.youngest <= 3) {
    v += (p.stroller_friendly ? 0.9 : -0.6) + (p.baby_room ? 0.7 : 0) + (p.activity_level === 3 ? -1.6 : 0) + (p.noise_level === 3 ? -1.2 : 0) + (p.experience_tags.includes("toddlers") ? 1.2 : 0);
  } else if (ctx.youngest <= 5) {
    v += (p.kids_menu ? 0.3 : 0) + (p.age_min <= 3 ? 0.4 : 0);
  }
  if (ctx.oldest >= 9) {
    v += (p.age_min >= 6 ? 1.1 : p.age_min <= 2 && p.age_max <= 8 ? -1.4 : 0) + (p.activity_level === 3 ? 0.5 : 0) + (p.experience_tags.includes("toddlers") ? -1.2 : 0);
  }
  return v;
}

/** Погода дня: улица или крыша, в зависимости от того, что реально лучше. */
function weatherFit(p: Place, ctx: DayCtx, outdoorDay: number, input: PlannerInput): number {
  const { cond } = ctx;
  const indoorOnly = p.indoor && !p.outdoor;
  const outdoorOnly = p.outdoor && !p.indoor;
  const prefersIn = input.mood === "learn" || input.mood === "creative";
  let v: number;
  if (cond.wet === "all") v = indoorOnly ? 3.8 : outdoorOnly ? 0 : 1.3;
  else if (cond.wet === "later") v = indoorOnly ? 1.4 : outdoorOnly ? outdoorDay * 2.6 : 1.8;
  else if (cond.cold) v = indoorOnly ? 3.2 : outdoorOnly ? outdoorDay * 1.0 - 1 : 1.2;
  else if (cond.hot) v = indoorOnly ? 2.4 : outdoorOnly ? outdoorDay * 1.4 : 1.6;
  else if (cond.sunny && cond.warm) v = outdoorOnly ? outdoorDay * 3.2 * (prefersIn ? 0.4 : 1) : indoorOnly ? (prefersIn ? 0.6 : -0.9) : 2.2;
  else v = outdoorOnly ? outdoorDay * 2.4 * (prefersIn ? 0.5 : 1) : indoorOnly ? 1.5 : 1.9;
  // метки места «когда оно хорошо»: дождь, солнце, холод, жара
  const tag = cond.wet === "all" ? "rain" : cond.hot ? "heat" : cond.cold || cond.snow ? "cold" : cond.sunny ? "sun" : "any";
  if (tag !== "any" && p.weather_tags.includes(tag)) v += tag === "sun" && prefersIn ? 0.4 : 1.3;
  if (cond.snow && !cond.wet && p.category === "active" && p.outdoor) v += 0.8;
  return v;
}

/** Сезон: уличное не по сезону — минус, «своё» время — плюс. */
function seasonFit(p: Place, ctx: DayCtx): number {
  if (p.season_tags.length >= 4) return 0;
  const inSeason = p.season_tags.includes(ctx.season);
  return inSeason ? 0.5 : p.outdoor ? -3 : -0.8;
}

/** День недели и толпа: в выходные хиты переполнены, в будни — спокойнее. */
function crowdFit(p: Place, ctx: DayCtx, input: PlannerInput): number {
  const calm = input.mood === "calm" || input.constraints?.quiet;
  let v = 0;
  if (ctx.weekend && p.is_hit && p.noise_level === 3) v -= calm ? 1.4 : 0.5;
  if (!ctx.weekend && (p.category === "museum" || p.category === "animals")) v += 0.5;
  if (ctx.weekend && p.category === "play" && p.price_min > 0) v += 0.2;
  return v;
}

export function hasFoodOption(p: Pick2<Place, "category" | "menu_url">): boolean {
  return p.category === "cafe" || !!p.menu_url;
}

export function planHasFood(plan: Pick2<Plan, "stops">): boolean {
  return plan.stops.some((s) => s.foodOption === true || (s.foodOption == null && hasFoodOption(s.place)));
}

/** Как добираемся: на машине важна подтверждённая парковка, на метро — станция рядом. */
function transportFit(p: Place, input: PlannerInput): number {
  if (input.transport === "car") {
    const status = p.parking_info?.status;
    if (status === "yes") return 1.2;
    if (status === "partial") return 0.25;
    if (status === "unknown") return -0.05;
    if (status === "no") return -1.2;
    return p.parking ? 0.7 : 0;
  }
  if (input.transport === "transit") return p.metro ? 0.7 : -0.3;
  return p.stroller_friendly ? 0.2 : 0;
}

/* ───────── 4–5. Сборка дня и порядок шагов ───────── */

type Slot = "anchor" | "food" | "activity" | "extra";
interface Pick {
  place: Place;
  duration: number;
  slot: Slot;
}

export function wxFor(
  p: Place,
  from: number,
  dur: number,
  ctx: Pick2<DayCtx, "forecast" | "dateISO" | "youngest">,
  input: Pick2<PlannerInput, "weather" | "mood" | "constraints">
): { ok: boolean; score: number; reason?: string; w?: StopWeather } {
  if (!ctx.forecast) {
    const bad = input.weather.condition === "rain" || input.weather.condition === "snow";
    if (bad && p.outdoor && !p.indoor && !(input.mood === "outdoor" && !input.constraints?.indoorOnly)) return { ok: false, score: 0, reason: "дождь" };
    return { ok: true, score: bad && p.indoor ? 1 : 0.85 };
  }
  const w = windowWx(ctx.forecast, ctx.dateISO, from, from + dur);
  const v = outdoorVerdict(w, ctx.youngest);
  const sw: StopWeather | undefined = w.empty ? undefined : { temp: Math.round((w.tempMin + w.tempMax) / 2), condition: w.condition, pop: w.popMax, bad: !v.ok };
  if (p.indoor && !p.outdoor) return { ok: true, score: v.ok ? 0.85 : 1, w: sw };
  if (p.indoor && p.outdoor) return { ok: true, score: v.ok ? v.score : 0.55, w: sw };
  return { ok: v.ok, score: v.score, reason: v.reason, w: sw };
}
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };

interface Ordered {
  picks: Pick[];
  cost: number;
  weather: (StopWeather | undefined)[];
  startClock: number;
  end: number;
}

function simulate(order: Pick[], ctx: DayCtx, input: PlannerInput, ignoreWeather = false): Ordered | null {
  let clock = ctx.start;
  // сегодня выезжаем не раньше «сейчас + сборы + дорога до первого места»
  if (ctx.nowMin !== null) {
    const first = legHome(input, order[0].place).minutes;
    clock = Math.max(clock, ceilTo(ctx.nowMin + 25 + first, 5));
  }
  const startClock = clock;
  let cost = 0;
  const weather: (StopWeather | undefined)[] = [];
  for (let i = 0; i < order.length; i++) {
    const { place, duration, slot } = order[i];
    if (!isOpenDuring(place.opening_hours, ctx.weekday, clock, duration)) return null;
    // малыш и тихий час: 13–15 лучше провести спокойно или дома
    if (ctx.youngest <= 3) {
      const overlap = Math.max(0, Math.min(clock + duration, 15 * 60) - Math.max(clock, 13 * 60));
      if (overlap > 0) cost += (overlap / 60) * (place.indoor && place.activity_level === 1 ? 0.6 : 2.2);
    }
    if (ctx.youngest <= 5 && clock + duration > 19 * 60) cost += 1.2;
    const wx = wxFor(place, clock, duration, ctx, input);
    if (!wx.ok && !ignoreWeather) return null;
    weather.push(wx.w);
    if (!ignoreWeather) cost += (1 - wx.score) * 3;
    if (slot === "food") cost += clock >= 12 * 60 && clock <= 15 * 60 ? -0.6 : 0.3;
    if (i === 0 && (slot === "food" || place.category === "shop")) cost += 2.5;
    if (i === 0 && slot !== "anchor") cost += 0.4;
    const next = order[i + 1];
    if (next) {
      const leg = travelBetween(pt(place), pt(next.place), input.transport);
      cost += leg.minutes * 0.05;
      clock = ceilTo(clock + duration + leg.minutes + BUFFER, 5);
    } else clock += duration;
  }
  const backHome = legHome(input, order[order.length - 1].place).minutes;
  const endBy = input.constraints?.endBy;
  if (endBy && clock + backHome > endBy + 10) return null;
  if (clock > 21 * 60) return null;
  return { picks: order, cost, weather, startClock, end: clock };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

function bestOrder(picks: Pick[], ctx: DayCtx, input: PlannerInput) {
  let best: Ordered | null = null;
  let bestDry: Ordered | null = null;
  for (const perm of permutations(picks)) {
    const r = simulate(perm, ctx, input);
    if (r && (!best || r.cost < best.cost)) best = r;
    const d = simulate(perm, ctx, input, true);
    if (d && (!bestDry || d.cost < bestDry.cost)) bestDry = d;
  }
  // порядок поменялся из-за погоды — расскажем об этом
  const reordered = !!best && !!bestDry && best.picks.map((p) => p.place.id).join() !== bestDry.picks.map((p) => p.place.id).join();
  return { best, reordered };
}

interface Assembled {
  ordered: Ordered;
  reordered: boolean;
  anchor: ScoredPlace;
}

function assemble(anchor: ScoredPlace, pool: ScoredPlace[], ctx: DayCtx, input: PlannerInput, kidsInterests: string[][], outdoorDay: number, avoid?: Set<string>): Assembled | null {
  const total = ctx.total;
  const c = input.constraints ?? {};
  const budgetMax = BUDGET_MAX[input.budget];
  const maxStops = MAX_STOPS[input.duration];
  const legMax = LEG_MAX[input.transport];

  const picks: Pick[] = [];
  // если еду просили прямо («с обедом», передышка родителю), оставляем ей время даже в коротком дне
  const mustFood = input.budget !== "free" && !!(input.foodAfter || c.parentBreak);
  // «подарок за пятёрку» и т.п.: магазин игрушек — обязательный шаг, а не случайность
  const mustShop = !!c.preferCategories?.includes("shop");
  const anchorCap = total >= 90 && (mustFood || mustShop) ? Math.max(45, total - (mustFood && mustShop ? 100 : 55)) : Infinity;
  const anchorDur = Math.max(45, Math.min(anchor.place.average_duration, anchorCap, Math.round(total * (total <= 120 ? 0.75 : total <= 240 ? 0.5 : 0.4))));
  picks.push({ place: anchor.place, duration: ceilTo(anchorDur, 5), slot: "anchor" });
  let remaining = total - anchorDur;
  let spent = anchor.place.family_budget;

  const lunchInWindow = ctx.start <= 14 * 60 && ctx.end >= 12 * 60 + 30;
  const wantFood = input.budget !== "free" && (input.foodAfter || c.parentBreak || total >= 240 || (total >= 180 && lunchInWindow));
  const covered = new Set(
    kidsInterests.map((ints, i) => (ints.some((x) => anchor.place.interest_tags.includes(x as never)) ? i : -1)).filter((i) => i >= 0)
  );

  const used = () => new Set(picks.map((p) => p.place.id));
  const last = () => picks[picks.length - 1].place;
  const cats = () => new Set(picks.map((p) => p.place.category));
  const hasFood = () => picks.some((p) => p.slot === "food" || p.place.category === "cafe" || (!c.parentBreak && hasFoodOption(p.place)));
  const activities = () => picks.filter((p) => p.slot === "anchor" || p.slot === "activity").length;
  const sunny = outdoorDay > 0.6;

  while (picks.length < maxStops) {
    let slot: Slot | null = null;
    if (wantFood && !hasFood() && remaining >= 50) slot = "food";
    else if (mustShop && !picks.some((q) => q.place.category === "shop") && remaining >= 40) slot = "extra";
    else if (activities() < (total >= 330 ? 2 : 1) && remaining >= 75) slot = "activity";
    else if (remaining >= 35) slot = "extra";
    if (!slot) break;

    // кафе ищем рядом с ЛЮБЫМ из уже выбранных мест (порядок шагов потом подберёт bestOrder), остальное — рядом с последним
    const legTo = (s: ScoredPlace): Travel =>
      slot === "food"
        ? picks.map((q) => travelBetween(pt(q.place), pt(s.place), input.transport)).reduce((a, b) => (a.minutes <= b.minutes ? a : b))
        : travelBetween(pt(last()), pt(s.place), input.transport);
    const near = pool
      .filter((s) => !used().has(s.place.id))
      .map((s) => ({ s, leg: legTo(s) }))
      .filter(({ leg }) => leg.minutes <= legMax)
      .filter(({ s }) => input.budget === "free" || spent + s.place.family_budget <= budgetMax * 1.1);

    const pickFrom = (filter: (s: ScoredPlace) => boolean, bonus: (s: ScoredPlace, legMin: number) => number) =>
      near
        .filter(({ s }) => filter(s))
        // места из предыдущих вариантов — только если лучшего нет: иначе все три плана «сходят» в одно кафе
        .map(({ s, leg }) => ({ s, leg, v: s.score + bonus(s, leg.minutes) - leg.minutes * 0.08 - (avoid?.has(s.place.id) ? 4.5 : 0) }))
        .sort((a, b) => b.v - a.v)[0];

    let chosen: { s: ScoredPlace; leg: Travel } | undefined;
    let dur = 0;
    if (slot === "food") {
      // голодный ребёнок далеко не уедет: кафе — как можно ближе
      const foodBonus = (s: ScoredPlace, legMin: number) => ((!s.place.unknown_fields?.includes("kids_menu") && s.place.kids_menu) ? 1 : 0) + (c.parentBreak && s.place.experience_tags.includes("playzone") ? 2.5 : 0) - Math.max(0, legMin - 10) * 0.25;
      chosen = pickFrom((s) => s.place.category === "cafe" && (!c.parentBreak || s.place.experience_tags.includes("playzone")) && (!s.place.experience_tags.includes("icecream") || total <= 120), foodBonus);
      dur = total <= 120 ? 40 : 55;
      // еду просили прямо, а рядом только кафе-мороженое — лучше перекус, чем ничего
      if (!chosen && mustFood) {
        chosen = pickFrom((s) => s.place.category === "cafe", foodBonus);
        dur = 30;
      }
      if (!chosen) slot = remaining >= 75 && activities() < 2 ? "activity" : remaining >= 35 ? "extra" : null;
    }
    if (!chosen && slot === "activity") {
      chosen = pickFrom(
        (s) => ACTIVITY.includes(s.place.category) && !cats().has(s.place.category),
        (s) => kidsInterests.filter((ints, i) => !covered.has(i) && ints.some((x) => s.place.interest_tags.includes(x as never))).length * 2.5
      );
      if (chosen) dur = Math.max(45, Math.min(chosen.s.place.average_duration, remaining - 45));
      else if (remaining >= 35) slot = "extra";
    }
    if (!chosen && slot === "extra") {
      chosen = pickFrom(
        (s) =>
          s.place.category !== last().category &&
          (s.place.category === "shop" ||
            (s.place.category === "park" && !cats().has("park")) ||
            (s.place.price_min === 0 && s.place.category !== "cafe" && !cats().has(s.place.category)) ||
            (s.place.experience_tags.includes("icecream") && !hasFood()) ||
            (s.place.category === "play" && !cats().has("play"))),
        (s) => (s.place.category === "shop" ? (mustShop ? 3 : s.place.experience_tags.includes("toys") ? 1 : 0) : 0) + (s.place.category === "park" && sunny ? 1 : 0)
      );
      if (chosen) dur = Math.max(25, Math.min(45, chosen.s.place.average_duration, remaining - 15));
    }
    if (!chosen || !slot) break;
    picks.push({ place: chosen.s.place, duration: ceilTo(dur, 5), slot });
    spent += chosen.s.place.family_budget;
    remaining -= dur + chosen.leg.minutes + BUFFER;
    kidsInterests.forEach((ints, i) => {
      if (ints.some((x) => chosen!.s.place.interest_tags.includes(x as never))) covered.add(i);
    });
  }

  // остаётся время — даём больше побыть там, где интересно (но не дольше разумного)
  if (remaining > 30) {
    for (const p of picks) {
      if (remaining <= 15) break;
      if (p.slot !== "anchor" && p.slot !== "activity") continue;
      const cap = Math.min(180, Math.round(p.place.average_duration * 1.3));
      const add = Math.min(cap - p.duration, remaining - 15);
      if (add >= 15) {
        p.duration = ceilTo(p.duration + add, 5) - (ceilTo(p.duration + add, 5) > cap ? 5 : 0);
        remaining -= add;
      }
    }
  }

  // укорачиваем список, пока не найдётся рабочий порядок (часы работы, погода, «домой к…»)
  let set = picks;
  while (set.length >= 1) {
    const { best, reordered } = bestOrder(set, ctx, input);
    if (best) return { ordered: best, reordered, anchor };
    if (set.length === 1) break;
    set = set.slice(0, -1);
  }
  return null;
}

function titleFor(anchor: Place, input: PlannerInput): { title: string; emoji: string } {
  const t = anchor.interest_tags;
  if (t.includes("dinosaurs")) return { title: "День динозавров", emoji: "🦖" };
  if (t.includes("space")) return { title: "Космический день", emoji: "🚀" };
  if (anchor.slug === "moskvarium") return { title: "Подводный мир", emoji: "🐬" };
  if (anchor.category === "animals") return { title: "День с животными", emoji: "🐾" };
  if (t.includes("science")) return { title: "День открытий", emoji: "🧪" };
  if (anchor.category === "active") return { title: "Энергия на максимум", emoji: "⚡" };
  if (anchor.category === "play" && t.includes("fairy")) return { title: "Сказочный день", emoji: "🧚" };
  if (t.includes("drawing") || t.includes("cooking") || anchor.experience_tags.includes("workshop")) return { title: "Творческий день", emoji: "🎨" };
  if (anchor.category === "cafe") return { title: "Кофе и игры", emoji: "☕" };
  if (anchor.category === "play") return { title: "Игровой день", emoji: "🎈" };
  if (input.budget === "free") return { title: "Бесплатный день", emoji: "💚" };
  if (anchor.category === "park") return { title: "День на воздухе", emoji: "🌿" };
  return { title: "Прогулка и приключения", emoji: "🌿" };
}

/* ───────── 6. Набор планов ───────── */

export interface PlannerResult {
  plans: Plan[];
  startLabel: string;
  tomorrow: boolean;
  dayOffset: number;
  considered: number;
  suggestions: Relaxation[];
  /** Пришлось допустить места, подходящие не всем детям. */
  partialAge: boolean;
  /** Рядом почти ничего нет — радиус автоматически расширен. */
  relaxed?: { from: number; to: number; nearest?: number };
  /** Сколько мест-якорей нашлось в заданном радиусе. */
  anchorsNear: number;
  /** Поиск по округу: где ищем и насколько строго. */
  area?: { id: string; scope: "strict" | "wide"; anchors: number; /** мест в округе, подходящих по условиям, но не «по теме» ситуации */ offType: number; loose: boolean };
}

export interface Relaxation {
  label: string;
  patch: Partial<Pick2<PlannerInput, "budget" | "transport" | "duration" | "mood">> & { travel?: number; anywhere?: boolean; wide?: boolean };
}

const anchorsOf = (pool: ScoredPlace[], input: PlannerInput) =>
  pool.filter(
    (s) =>
      ACTIVITY.includes(s.place.category) ||
      (input.constraints?.parentBreak && s.place.category === "cafe" && s.place.experience_tags.includes("playzone"))
  );

/** Первое плечо «от дома до места» с учётом режима: вся Москва — без дороги, округ — с запасом, точка — как есть. */
export function legHome(input: Pick2<PlannerInput, "location" | "transport" | "locationMode">, p: Pick2<Place, "latitude" | "longitude">): Travel {
  const mode = input.locationMode ?? "exact";
  const t = travelToPlace(input.location, p as Place, input.transport);
  if (mode === "any") return { km: 0, minutes: 0, mode: t.mode };
  if (mode === "area") return { ...t, minutes: Math.max(5, t.minutes - AREA_SOFTEN) };
  return t;
}
/** В режиме «округ» условный центр уже в нескольких километрах от двери — вычитаем типичный путь внутри округа. */
const AREA_SOFTEN = 10;

const poolOf = (input: Pick2<PlannerInput, "extraPlaces">): Place[] => (input.extraPlaces?.length ? [...STATIC_PLACES, ...input.extraPlaces] : STATIC_PLACES);

/** Минуты до ближайшего подходящего по возрасту места-якоря (для честного «ближайшее — в N минутах»). */
function nearestAnchorMin(input: PlannerInput): number | undefined {
  const ages = input.children.map((c) => c.age);
  let best: number | undefined;
  for (const p of poolOf(input)) {
    if (!ACTIVITY.includes(p.category)) continue;
    if (ages.length && !ages.some((a) => a >= p.age_min && a <= p.age_max)) continue;
    const m = legHome(input, p).minutes;
    if (best === undefined || m < best) best = m;
  }
  return best;
}

/**
 * Планы с автоматическим расширением радиуса: если рядом пусто (за МКАД, окраина, узкие рамки),
 * не показываем «ничего не нашлось», а честно расширяем до тех пор, пока не появятся варианты.
 */
export function generatePlans(input: PlannerInput, count = 3, offset = 0): PlannerResult {
  const base = dayContext(input).reach;
  const first = generateOnce(input, count, offset, 1);
  if (input.locationMode === "any") return first; // без привязки к точке радиус не причём
  // строго по округу: радиус не расширяем — «в округе мало» честнее, чем тихо уехать в соседний (см. recommend/area.ts)
  if (first.area?.scope === "strict") return first;
  const sparse = first.anchorsNear < 6 && isSuburban(input.location);
  if (first.plans.length >= (sparse ? count : 1)) return first;
  let best = first;
  let lastEff = base;
  for (const k of [1.5, 2.2, 3.2]) {
    const eff = Math.min(150, base * k);
    if (eff <= lastEff + 1) break;
    lastEff = eff;
    const r = generateOnce(input, count, offset, k);
    if (r.plans.length > best.plans.length) best = { ...r, relaxed: { from: Math.round(base), to: Math.min(150, Math.round(base * k)) } };
    if (best.plans.length >= count) break;
  }
  if (best.relaxed) best.relaxed.nearest = nearestAnchorMin(input);
  return best.plans.length ? best : { ...first, relaxed: undefined };
}

function generateOnce(input: PlannerInput, count: number, offset: number, reachMul: number): PlannerResult {
  const ctx = dayContext(input, reachMul);
  const ages = input.children.map((c) => c.age);
  const outdoorDay = dayOutdoorScore(ctx);
  const ALL_PLACES = poolOf(input);

  let partialAge = false;
  let scored = ALL_PLACES.map((p) => scorePlace(p, input, ages, ctx, outdoorDay)).filter(Boolean) as ScoredPlace[];
  if (ages.length > 1 && anchorsOf(scored, input).length < 4) {
    // разные возрасты: если «всем сразу» почти нечего, допускаем места хотя бы для одного
    partialAge = true;
    scored = ALL_PLACES.map((p) => scorePlace(p, input, ages, ctx, outdoorDay, true)).filter(Boolean) as ScoredPlace[];
  }
  // строго по округу: основное место должно быть «по теме» ситуации (иначе — честное «здесь такого нет»)
  const strictArea = !!areaOf(input) && input.areaScope !== "wide";
  let anchors = anchorsOf(scored, input);
  let offType = 0;
  if (strictArea && !input.looseFit) {
    const core = anchors.filter((s) => coreFit(s.place, input));
    offType = anchors.length - core.length;
    anchors = core;
  }
  const anchorsNear = anchors.length;

  const kidsInterests = input.children.map((c) => [...c.interests, ...(input.constraints?.interests ?? [])] as string[]);
  const candidates = anchors.sort((a, b) => b.score - a.score);
  const results: { a: Assembled; plan: Plan }[] = [];
  const tried = new Set<string>();
  const minStops = Math.min(input.constraints?.minStops ?? MIN_STOPS[input.duration], MAX_STOPS[input.duration]);
  const fallback: Assembled[] = [];

  while (results.length < count + offset) {
    // MMR: сила места минус похожесть на уже выбранные якоря; каждый третий — «сюрприз»
    const chosenAnchors = results.map((r) => r.a.anchor.place);
    const surprise = results.length % 3 === 2;
    const next = candidates
      .filter((c) => !tried.has(c.place.id))
      .slice(0, 18)
      .map((c) => {
        const sameCat = chosenAnchors.filter((p) => p.category === c.place.category).length;
        const near = chosenAnchors.some((p) => travelBetween(pt(p), pt(c.place), "walk").km < 1.5) ? 1 : 0;
        const novelty = surprise
          ? (c.place.experience_tags.includes("unusual") ? 1.2 : 0) + (input.family?.seen?.includes(c.place.slug) ? -1 : 0.6)
          : 0;
        return { c, v: c.score - sameCat * 1.6 - near * 1.2 + novelty };
      })
      .sort((a, b) => b.v - a.v)[0];
    if (!next) break;
    tried.add(next.c.place.id);

    const a = assemble(next.c, scored, ctx, input, kidsInterests.map((x) => [...x]), outdoorDay, new Set(results.flatMap((r) => r.a.ordered.picks.map((p) => p.place.id))));
    if (!a) continue;
    if (a.ordered.picks.length < minStops) {
      fallback.push(a);
      continue;
    }
    const ids = new Set(a.ordered.picks.map((p) => p.place.id));
    if (results.some((r) => r.plan.stops.filter((s) => ids.has(s.place.id)).length >= 2)) continue;
    results.push({ a, plan: toPlan(a, input, ctx, scored, partialAge) });
  }
  // мало вариантов нужной длины — добираем короткими, но честно
  for (const a of fallback) {
    if (results.length >= count + offset) break;
    const ids = new Set(a.ordered.picks.map((p) => p.place.id));
    if (results.some((r) => r.plan.stops.some((s) => ids.has(s.place.id)))) continue;
    results.push({ a, plan: toPlan(a, input, ctx, scored, partialAge) });
  }

  const wantsFood = input.budget !== "free" && !!(input.foodAfter || input.constraints?.parentBreak || DURATION_MIN[input.duration] >= 240);
  const foodFulfilled = (plan: Plan) =>
    input.constraints?.parentBreak
      ? plan.stops.some((s) => s.place.category === "cafe" && s.place.experience_tags.includes("playzone"))
      : planHasFood(plan);
  const wantsOutdoor = !!input.constraints?.outdoorPreferred && ctx.cond.wet !== "all" && !ctx.cond.cold;
  const fulfillment = (plan: Plan) =>
    (wantsFood && foodFulfilled(plan) ? 4 : 0) +
    (wantsOutdoor && plan.stops.some((s) => s.place.outdoor) ? 2 : 0);
  results.sort((a, b) => fulfillment(b.plan) - fulfillment(a.plan));
  const plans = results.map((r) => r.plan);
  return {
    plans: plans.slice(offset),
    startLabel: fromMinutes(ctx.start),
    tomorrow: ctx.tomorrow,
    dayOffset: ctx.dayOffset,
    considered: scored.length,
    suggestions: plans.length ? [] : diagnose(input),
    partialAge,
    anchorsNear,
    area: areaInfo(input, anchorsNear, offType),
  };
}

function areaInfo(input: PlannerInput, anchors: number, offType: number): PlannerResult["area"] {
  const id = areaOf(input);
  return id ? { id, scope: input.areaScope === "wide" ? "wide" : "strict", anchors, offType, loose: !!input.looseFit } : undefined;
}

function toPlan(a: Assembled, input: PlannerInput, ctx: DayCtx, pool: ScoredPlace[], partialAge: boolean): Plan {
  const picks = a.ordered.picks;
  const { title, emoji } = titleFor(a.anchor.place, input);
  const draft = buildPlan(
    picks.map((p) => ({ place: p.place, duration: p.duration })),
    {
      key: picks.map((p) => p.place.slug).join("+"),
      title,
      emoji,
      start: fromMinutes(a.ordered.startClock),
      transport: input.transport,
      description: chainLabel(picks.map((p) => p.place)),
    }
  );
  // Явно отмечаем, где в этом плане находится еда. Само наличие menu_url в базе
  // не означает, что питание является частью конкретного маршрута.
  const lunchInWindow = ctx.start <= 14 * 60 && ctx.end >= 12 * 60 + 30;
  const wantsFood = input.budget !== "free" && (
    input.foodAfter ||
    input.constraints?.parentBreak ||
    ctx.total >= 240 ||
    (ctx.total >= 180 && lunchInWindow)
  );
  draft.stops.forEach((stop) => { stop.foodOption = false; });
  if (wantsFood) {
    let foodIndex = picks.findIndex((p) => p.slot === "food");
    if (foodIndex < 0 && input.constraints?.parentBreak) {
      foodIndex = picks.findIndex((p) => p.place.category === "cafe" && p.place.experience_tags.includes("playzone"));
    }
    if (foodIndex < 0) foodIndex = picks.findIndex((p) => p.place.category === "cafe");
    if (foodIndex < 0 && !input.constraints?.parentBreak) foodIndex = picks.findIndex((p) => !!p.place.menu_url);
    if (foodIndex >= 0) draft.stops[foodIndex].foodOption = true;
  }
  // погода на шаг и крытая замена для уличных
  draft.stops.forEach((s, i) => {
    s.weather = a.ordered.weather[i];
    if (s.place.outdoor && !s.place.indoor) s.backup = findBackup(s.place, picks.map((p) => p.place.id), pool, input)?.slug;
  });
  const mode0 = input.locationMode ?? "exact";
  draft.fromHome = mode0 === "any" ? undefined : { ...legHome(input, picks[0].place), approx: mode0 === "area" || undefined };
  draft.dayOffset = ctx.dayOffset;
  const hasOutdoor = picks.some((p) => p.place.outdoor);
  if (ctx.forecast) draft.bring = bringList(windowWx(ctx.forecast, ctx.dateISO, a.ordered.startClock, a.ordered.end), ctx.youngest, hasOutdoor);

  const notes: string[] = [];
  let weatherNote: string | undefined;
  if (a.reordered && ctx.rainFrom) {
    const outdoor = picks.find((p) => p.place.outdoor && !p.place.indoor);
    weatherNote = outdoor
      ? `Сначала «${outdoor.place.title}», пока сухо: с ${ctx.rainFrom} обещают дождь — дальше всё под крышей.`
      : `Порядок подобран под прогноз: с ${ctx.rainFrom} дождь.`;
    notes.push("⛅ Успеваем до дождя");
  }
  if (!weatherNote && ctx.rainFrom && hasOutdoor) {
    const rain = Number(ctx.rainFrom.slice(0, 2)) * 60 + Number(ctx.rainFrom.slice(3, 5));
    const outdoorEnds = draft.stops.filter((s) => s.place.outdoor && !s.place.indoor).map((s) => Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3, 5)) + s.duration);
    if (outdoorEnds.length && Math.max(...outdoorEnds) <= rain) {
      weatherNote = `Гуляем, пока сухо: дождь обещают с ${ctx.rainFrom}, а прогулка закончится раньше.`;
      notes.push("⛅ Успеваем до дождя");
    }
  }
  if (input.family?.want.some((s) => picks.some((p) => p.place.slug === s))) notes.push("❤️ Вы хотели сюда");
  if (partialAge) notes.push("👀 Не всё — для всех возрастов");
  const { why, explanation } = explainPlan(draft, input, notes);
  return { ...draft, why, explanation: weatherNote ? `${weatherNote} ${explanation}` : explanation, weatherNote, score: a.anchor.score };
}

/** Крытое место рядом — запасной вариант, если погода испортится. */
export function findBackup(p: Place, exclude: string[], pool: ScoredPlace[], input: Pick2<PlannerInput, "transport">): Place | undefined {
  return pool
    .filter((s) => s.place.indoor && !exclude.includes(s.place.id) && s.place.id !== p.id && s.place.category !== "shop" && s.place.category !== "cafe")
    .map((s) => ({ s, v: s.score - travelBetween(pt(p), pt(s.place), input.transport).minutes * 0.1, m: travelBetween(pt(p), pt(s.place), input.transport).minutes }))
    .filter((x) => x.m <= 25)
    .sort((a, b) => b.v - a.v)[0]?.s.place;
}

/** «Ничего не нашлось» — какое ослабление условий даст результат. */
function diagnose(input: PlannerInput): Relaxation[] {
  const tries: Relaxation[] = [
    { label: "Увеличить бюджет до 5 000 ₽", patch: { budget: "5000" } },
    { label: "Готовы ехать до часа", patch: { travel: 60 } },
    { label: "Разрешить общественный транспорт", patch: { transport: "transit" } },
    { label: "Выделить 3–4 часа", patch: { duration: "mid" } },
    { label: "Положиться на нас — «Удивите нас»", patch: { mood: "surprise" } },
  ];
  // привязка к округу/адресу сужает выбор — «вся Москва» снимает её целиком
  if (input.locationMode && input.locationMode !== "any") tries.unshift({ label: "Искать по всей Москве", patch: { anywhere: true } });
  if (areaOf(input) && input.areaScope !== "wide") tries.unshift({ label: "Добавить ближайшие округа", patch: { wide: true } });
  return tries.filter((t) => {
    const { travel, anywhere, wide, ...rest } = t.patch;
    const k = Object.keys(rest)[0] as keyof typeof rest | undefined;
    if (k && input[k] === rest[k]) return false;
    if (travel && input.locationMode === "any") return false; // без точки «время в пути» не ограничивается — предлагать нечего
    if (travel && areaOf(input) && input.areaScope !== "wide") return false; // внутри округа дорога не ограничивает
    if (travel && (input.constraints?.maxTravelMin ?? DEFAULT_REACH[input.transport]) >= travel) return false;
    let next: PlannerInput = { ...input, ...rest, constraints: travel ? { ...input.constraints, maxTravelMin: travel } : input.constraints };
    if (wide) next = { ...input, areaScope: "wide" };
    if (anywhere) {
      const { maxTravelMin: _drop, ...keep } = input.constraints ?? {};
      next = { ...input, locationMode: "any", constraints: keep, maxDistanceKm: undefined };
    }
    const ctx = dayContext(next);
    const ages = next.children.map((c) => c.age);
    const od = dayOutdoorScore(ctx);
    return poolOf(next).filter((p) => ACTIVITY.includes(p.category)).some((p) => scorePlace(p, next, ages, ctx, od, true));
  });
}

/* ───────── Персональные рекомендации мест (главная, «Что потом?») ───────── */

export function rankPlaces(input: PlannerInput, filter?: (p: Place) => boolean, minCount = 0): ScoredPlace[] {
  const ages = input.children.map((c) => c.age);
  const pool = poolOf(input).filter((p) => !filter || filter(p));
  const okr = areaOf(input);
  // округ: сначала только он, а если мест мало — и соседние (свои — первыми); дальше соседних подборка не уходит
  // (лучше показать меньше карточек, чем «для вас» из другого конца города)
  const attempts: { scope?: "strict" | "adjacent" | "wide"; mul: number }[] =
    input.locationMode === "any"
      ? [{ mul: 1 }]
      : okr && input.areaScope !== "wide"
        ? [{ scope: "strict", mul: 1 }, ...[1, 1.5].map((mul) => ({ scope: "adjacent" as const, mul }))]
        : [1, 1.5, 2.2, 3.2].map((mul) => ({ mul }));
  let best: ScoredPlace[] = [];
  for (const a of attempts) {
    const next = a.scope ? { ...input, areaScope: a.scope } : input;
    const ctx = dayContext(next, a.mul);
    const od = dayOutdoorScore(ctx);
    const r = pool
      .map((p) => scorePlace(p, next, ages, ctx, od, true))
      .filter(Boolean)
      .sort((x, y) => (okr ? (x!.tier ?? 2) - (y!.tier ?? 2) || y!.score - x!.score : y!.score - x!.score)) as ScoredPlace[];
    if (r.length > best.length) best = r;
    if (best.length >= minCount) break;
  }
  return best;
}
