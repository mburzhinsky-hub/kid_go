import type { Place, Plan, PlannerInput, MoodId, BudgetId, DurationId, StopWeather, CategoryId } from "@/lib/types";
import { places as ALL_PLACES } from "@/lib/data/places";
import { buildPlan, chainLabel } from "@/lib/plan";
import { pt } from "@/lib/geo";
import { ceilTo, fromMinutes, isOpenDuring, moscowNow } from "@/lib/format";
import { travelBetween, travelToPlace, type Travel } from "@/lib/location";
import { bringList, daySummary, moscowDateISO, outdoorVerdict, weekdayOf, windowWx, type Forecast } from "@/lib/forecast";
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
}

/* ───────── 1. Контекст ───────── */

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
  reach: number;
  rainFrom?: string;
}

export function dayContext(input: PlannerInput): DayCtx {
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
  const reach = input.maxDistanceKm ? Math.min(reachBase, 20) : reachBase;
  const sum = input.forecast ? daySummary(input.forecast, dateISO) : undefined;
  return {
    dateISO,
    weekday: offset === 0 ? now.weekday : weekdayOf(dateISO),
    dayOffset: offset,
    start,
    end: start + total,
    total,
    tomorrow: offset > 0,
    forecast: input.forecast,
    youngest: ages.length ? Math.min(...ages) : 5,
    reach,
    rainFrom: sum?.rainFrom,
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
  const travel = travelToPlace(input.location, p, input.transport);
  const reach = ACTIVITY.includes(p.category) ? ctx.reach : ctx.reach * 1.35;
  if (travel.minutes > reach) return null;

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
  const interest = kidInterests.some((x) => x.length) ? interestKids / kidInterests.length : 0.35;
  const scenarioInterest = c.interests?.some((i) => p.interest_tags.includes(i)) ? 1.5 : 0;
  // «лучший возраст»: середина диапазона интереснее краёв
  const sweet = ages.length ? ages.reduce((s, a) => s + (a >= p.age_min + 1 && a <= p.age_max - 1 ? 1 : 0.6), 0) / ages.length : 0.8;

  const parts: Record<string, number> = {
    age: fit * 2 + sweet,
    distance: Math.max(0, 1 - travel.minutes / ctx.reach) * 2,
    interest: interest * 3 + scenarioInterest,
    rating: (p.rating - 4) * 1,
    mood: moodFit(p, input.mood) * 4,
    activity: input.activity ? 1 - Math.abs(p.activity_level - input.activity) / 2 : 0.5,
    popularity: (p.is_hit ? 0.4 : 0) + Math.min(0.4, p.review_count / 10000),
    weather: p.indoor && !p.outdoor ? (outdoorDay < 0.5 ? 2.5 : 1.2) : p.outdoor && !p.indoor ? outdoorDay * 2.5 : 1.8,
    prefer: (c.preferCategories?.includes(p.category) ? 2.2 : 0) + (c.outdoorPreferred && p.outdoor ? 1.5 : 0),
    family:
      (fam?.want.includes(p.slug) ? 2.5 : 0) +
      (fam?.loved.includes(p.slug) ? 1 : 0) -
      (fam?.visited.includes(p.slug) && !fam?.loved.includes(p.slug) ? 2 : 0) -
      (fam?.seen?.includes(p.slug) ? 0.8 : 0),
    rotation: hash(`${input.seed ?? ""}:${p.id}`) * 0.9,
    // при скромном бюджете дорогой якорь «съедает» весь день — предпочитаем то, что оставит место для обеда
    price: Number.isFinite(budgetMax) && budgetMax > 0 ? -(p.family_budget / budgetMax) * 1.5 : 0,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { place: p, score, km: travel.km, minutes: travel.minutes, parts };
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
  end: number;
}

function simulate(order: Pick[], ctx: DayCtx, input: PlannerInput, ignoreWeather = false): Ordered | null {
  let clock = ctx.start;
  let cost = 0;
  const weather: (StopWeather | undefined)[] = [];
  for (let i = 0; i < order.length; i++) {
    const { place, duration, slot } = order[i];
    if (!isOpenDuring(place.opening_hours, ctx.weekday, clock, duration)) return null;
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
  const backHome = travelToPlace(input.location, order[order.length - 1].place, input.transport).minutes;
  const endBy = input.constraints?.endBy;
  if (endBy && clock + backHome > endBy + 10) return null;
  if (clock > 21 * 60) return null;
  return { picks: order, cost, weather, end: clock };
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

function assemble(anchor: ScoredPlace, pool: ScoredPlace[], ctx: DayCtx, input: PlannerInput, kidsInterests: string[][], outdoorDay: number): Assembled | null {
  const total = ctx.total;
  const c = input.constraints ?? {};
  const budgetMax = BUDGET_MAX[input.budget];
  const maxStops = MAX_STOPS[input.duration];
  const legMax = LEG_MAX[input.transport];

  const picks: Pick[] = [];
  const anchorDur = Math.max(45, Math.min(anchor.place.average_duration, Math.round(total * (total <= 120 ? 0.75 : total <= 240 ? 0.5 : 0.4))));
  picks.push({ place: anchor.place, duration: ceilTo(anchorDur, 5), slot: "anchor" });
  let remaining = total - anchorDur;
  let spent = anchor.place.family_budget;

  const lunchInWindow = ctx.start <= 14 * 60 && ctx.end >= 12 * 60 + 30;
  const wantFood = input.budget !== "free" && (input.foodAfter || c.parentBreak || total >= 300 || (total >= 200 && lunchInWindow));
  const covered = new Set(
    kidsInterests.map((ints, i) => (ints.some((x) => anchor.place.interest_tags.includes(x as never)) ? i : -1)).filter((i) => i >= 0)
  );

  const used = () => new Set(picks.map((p) => p.place.id));
  const last = () => picks[picks.length - 1].place;
  const cats = () => new Set(picks.map((p) => p.place.category));
  const hasFood = () => picks.some((p) => p.slot === "food" || p.place.category === "cafe");
  const activities = () => picks.filter((p) => p.slot === "anchor" || p.slot === "activity").length;
  const sunny = outdoorDay > 0.6;

  while (picks.length < maxStops) {
    let slot: Slot | null = null;
    if (wantFood && !hasFood() && remaining >= 50) slot = "food";
    else if (activities() < (total >= 330 ? 2 : 1) && remaining >= 75) slot = "activity";
    else if (remaining >= 35) slot = "extra";
    if (!slot) break;

    const near = pool
      .filter((s) => !used().has(s.place.id))
      .map((s) => ({ s, leg: travelBetween(pt(last()), pt(s.place), input.transport) }))
      .filter(({ leg }) => leg.minutes <= legMax)
      .filter(({ s }) => input.budget === "free" || spent + s.place.family_budget <= budgetMax * 1.1);

    const pickFrom = (filter: (s: ScoredPlace) => boolean, bonus: (s: ScoredPlace, legMin: number) => number) =>
      near
        .filter(({ s }) => filter(s))
        .map(({ s, leg }) => ({ s, leg, v: s.score + bonus(s, leg.minutes) - leg.minutes * 0.08 }))
        .sort((a, b) => b.v - a.v)[0];

    let chosen: { s: ScoredPlace; leg: Travel } | undefined;
    let dur = 0;
    if (slot === "food") {
      chosen = pickFrom(
        (s) => s.place.category === "cafe" && (!s.place.experience_tags.includes("icecream") || total <= 120),
        // голодный ребёнок далеко не уедет: кафе — как можно ближе
        (s, legMin) => (s.place.kids_menu ? 1 : 0) + (c.parentBreak && s.place.experience_tags.includes("playzone") ? 2.5 : 0) - Math.max(0, legMin - 10) * 0.25
      );
      dur = total <= 120 ? 40 : 55;
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
        (s) => (s.place.category === "shop" && s.place.experience_tags.includes("toys") ? 1 : 0) + (s.place.category === "park" && sunny ? 1 : 0)
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
}

export interface Relaxation {
  label: string;
  patch: Partial<Pick2<PlannerInput, "budget" | "transport" | "duration" | "mood">> & { travel?: number };
}

const anchorsOf = (pool: ScoredPlace[], input: PlannerInput) =>
  pool.filter(
    (s) =>
      ACTIVITY.includes(s.place.category) ||
      (input.constraints?.parentBreak && s.place.category === "cafe" && s.place.experience_tags.includes("playzone"))
  );

export function generatePlans(input: PlannerInput, count = 3, offset = 0): PlannerResult {
  const ctx = dayContext(input);
  const ages = input.children.map((c) => c.age);
  const outdoorDay = dayOutdoorScore(ctx);

  let partialAge = false;
  let scored = ALL_PLACES.map((p) => scorePlace(p, input, ages, ctx, outdoorDay)).filter(Boolean) as ScoredPlace[];
  if (ages.length > 1 && anchorsOf(scored, input).length < 4) {
    // разные возрасты: если «всем сразу» почти нечего, допускаем места хотя бы для одного
    partialAge = true;
    scored = ALL_PLACES.map((p) => scorePlace(p, input, ages, ctx, outdoorDay, true)).filter(Boolean) as ScoredPlace[];
  }

  const kidsInterests = input.children.map((c) => [...c.interests, ...(input.constraints?.interests ?? [])] as string[]);
  const candidates = anchorsOf(scored, input).sort((a, b) => b.score - a.score);
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

    const a = assemble(next.c, scored, ctx, input, kidsInterests.map((x) => [...x]), outdoorDay);
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

  const plans = results.map((r) => r.plan);
  return {
    plans: plans.slice(offset),
    startLabel: fromMinutes(ctx.start),
    tomorrow: ctx.tomorrow,
    dayOffset: ctx.dayOffset,
    considered: scored.length,
    suggestions: plans.length ? [] : diagnose(input),
    partialAge,
  };
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
      start: fromMinutes(ctx.start),
      transport: input.transport,
      description: chainLabel(picks.map((p) => p.place)),
    }
  );
  // погода на шаг и крытая замена для уличных
  draft.stops.forEach((s, i) => {
    s.weather = a.ordered.weather[i];
    if (s.place.outdoor && !s.place.indoor) s.backup = findBackup(s.place, picks.map((p) => p.place.id), pool, input)?.slug;
  });
  draft.fromHome = travelToPlace(input.location, picks[0].place, input.transport);
  draft.dayOffset = ctx.dayOffset;
  const hasOutdoor = picks.some((p) => p.place.outdoor);
  if (ctx.forecast) draft.bring = bringList(windowWx(ctx.forecast, ctx.dateISO, ctx.start, a.ordered.end), ctx.youngest, hasOutdoor);

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
  return tries.filter((t) => {
    const { travel, ...rest } = t.patch;
    const k = Object.keys(rest)[0] as keyof typeof rest | undefined;
    if (k && input[k] === rest[k]) return false;
    if (travel && (input.constraints?.maxTravelMin ?? DEFAULT_REACH[input.transport]) >= travel) return false;
    const next: PlannerInput = { ...input, ...rest, constraints: travel ? { ...input.constraints, maxTravelMin: travel } : input.constraints };
    const ctx = dayContext(next);
    const ages = next.children.map((c) => c.age);
    const od = dayOutdoorScore(ctx);
    return ALL_PLACES.filter((p) => ACTIVITY.includes(p.category)).some((p) => scorePlace(p, next, ages, ctx, od, true));
  });
}

/* ───────── Персональные рекомендации мест (главная, «Что потом?») ───────── */

export function rankPlaces(input: PlannerInput, filter?: (p: Place) => boolean): ScoredPlace[] {
  const ages = input.children.map((c) => c.age);
  const ctx = dayContext(input);
  const od = dayOutdoorScore(ctx);
  return ALL_PLACES.filter((p) => !filter || filter(p))
    .map((p) => scorePlace(p, input, ages, ctx, od, true))
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as ScoredPlace[];
}
