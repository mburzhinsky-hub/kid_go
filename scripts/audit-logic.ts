/**
 * Логический аудит сценариев: «а это точно логично?»
 *   npx tsx scripts/audit-logic.ts            — отчёт в консоль
 *   npx tsx scripts/audit-logic.ts --md=PATH  — ещё и полный отчёт с примерами планов в markdown
 *
 * audit-scenarios.ts проверяет жёсткие условия (часы работы, возраст, бюджет, «под крышей»…).
 * Здесь — смысл: каждый сценарий берётся в те моменты, когда ГЛАВНАЯ его реально показывает
 * (тот же контекст, что считает HomeLive: вечером с 19:00 — уже завтрашний день), строится план, и сверяется:
 *   1. время плана попадает в окно, ради которого сценарий показан («После садика» не должен строить утро);
 *   2. сценарий «на сейчас» не уезжает на завтра, а «суббота» — не строит пятницу;
 *   3. длина плана соответствует названию («Почти весь день» — не 4 часа вечером);
 *   4. в плане есть то, что обещает название и подсказка (кафе, прогулка, музей, игровая…);
 *   5. даты: «Золотая осень», «Новогодние каникулы», «Проводы лета» — в своё время года;
 *   6. пары сценариев, которые на деле дают одни и те же планы.
 */
import { writeFileSync } from "node:fs";
import { generatePlans, DURATION_MIN } from "../src/lib/recommend/engine";
import { buildPlannerInput } from "../src/lib/recommend/build-input";
import { daySummary, demoForecast, moscowDateISO, weekdayOf, type WxScenario } from "../src/lib/forecast";
import { DAY_TEMP, isSchoolBreak } from "../src/lib/school-calendar";
import { AREAS, DEFAULT_ORIGIN, type Origin } from "../src/lib/location";
import { SCENARIO_LIBRARY, pickScenarios, scenarioCtx, type HomeCtx, type ScenarioCtx, type ScenarioDef } from "../src/lib/scenarios";
import { buildHomeCtx } from "../src/lib/home-ctx";
import { startToday } from "../src/lib/day-window";
import { planHasFood, type PlannerResult } from "../src/lib/recommend/engine";
import { toMinutes } from "../src/lib/format";
import type { InterestId, Plan } from "../src/lib/types";

const MD = process.argv.find((a) => a.startsWith("--md="))?.slice(5);
const PER_SCENARIO = Number((process.argv.find((a) => a.startsWith("--n=")) ?? "--n=16").slice(4));

interface Persona {
  id: string;
  kids: { name: string; age: number; interests: InterestId[] }[];
  region?: boolean;
}
const kid = (age: number, interests: InterestId[] = []) => ({ name: "", age, interests });
const PERSONAS: Persona[] = [
  { id: "без детей", kids: [] },
  { id: "0 лет", kids: [kid(0)] },
  { id: "2 года · животные", kids: [kid(2, ["animals"])] },
  { id: "3 года", kids: [kid(3)] },
  { id: "5 · динозавры, космос", kids: [kid(5, ["dinosaurs", "space"])] },
  { id: "6 · транспорт", kids: [kid(6, ["transport"])] },
  { id: "7 · музыка, сказки", kids: [kid(7, ["music", "fairy"])] },
  { id: "8 · рисование, готовка", kids: [kid(8, ["drawing", "cooking"])] },
  { id: "11 · спорт, природа", kids: [kid(11, ["sport", "nature"])] },
  { id: "12 · наука", kids: [kid(12, ["science"])] },
  { id: "2 и 9", kids: [kid(2), kid(9, ["animals"])] },
  { id: "4 и 5", kids: [kid(4), kid(5)] },
  { id: "1, 6, 12", kids: [kid(1), kid(6), kid(12)] },
  { id: "5 · область", kids: [kid(5)], region: true },
  { id: "2 и 9 · область", kids: [kid(2), kid(9)], region: true },
  { id: "9 · область", kids: [kid(9, ["nature"])], region: true },
];
const WXS: WxScenario[] = ["sun", "rain", "rain15", "cold", "heat", "snow"];
const DATES = ["2026-10-07", "2026-12-23", "2027-01-12", "2027-04-12", "2026-07-08", "2026-08-19", "2026-09-04", "2026-11-18", "2027-03-10", "2027-02-10"];
const HOURS = [9, 12, 15, 17, 18, 20];

/** Тот же контекст, что строит HomeLive (useHomeCtx), только из заданного «сейчас». */
function homeCtx(now: Date, wx: WxScenario, p: Persona): HomeCtx {
  const forecast = demoForecast(DEFAULT_ORIGIN, wx, now);
  const msk = new Date(now.getTime() + 3 * 3600_000);
  return buildHomeCtx({
    nowMin: msk.getUTCHours() * 60 + msk.getUTCMinutes(),
    weekday: (msk.getUTCDay() + 6) % 7,
    dateOf: (off) => moscowDateISO(off, now),
    forecast,
    kids: p.kids,
    region: !!p.region,
  });
}

const at = (date: string, h: number) => new Date(`${date}T${String(h - 3).padStart(2, "0")}:10:00Z`);
const HOME: Origin = { ...AREAS.find((a) => a.id === "tushino")!, source: "custom" };

/* ───────── подбор контекстов: только те, где главная реально показывает сценарий ───────── */
interface Run {
  sid: string;
  tag: string;
  persona: Persona;
  now: Date;
  wx: WxScenario;
  ctx: HomeCtx;
  exact?: boolean;
}
const shownBy = new Map<string, Run[]>();
for (const date of DATES)
  for (let d = 0; d < 7; d++) {
    const base = new Date(`${date}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + d);
    const iso = base.toISOString().slice(0, 10);
    for (const h of HOURS)
      for (const wx of WXS)
        for (const persona of PERSONAS) {
          const now = at(iso, h);
          const ctx = homeCtx(now, wx, persona);
          for (const s of pickScenarios(ctx)) {
            const list = shownBy.get(s.id) ?? [];
            list.push({ sid: s.id, tag: `${iso} ${h}:10 · ${wx} · ${persona.id}`, persona, now, wx, ctx });
            shownBy.set(s.id, list);
          }
        }
  }

/** Детерминированная выборка: равномерно по отсортированному списку, чтобы попали разные дни, часы и семьи. */
function sample<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  const out: T[] = [];
  const step = list.length / n;
  for (let i = 0; i < n; i++) out.push(list[Math.floor(i * step + step / 2)]);
  return out;
}
/** «Ручные» контексты: человек открыл сценарий из полного списка в произвольный момент. */
const MANUAL: Omit<Run, "sid">[] = [
  { tag: "ручной: сб 11:10 · sun · 5 лет", persona: PERSONAS[4], now: at("2026-10-10", 11), wx: "sun", ctx: homeCtx(at("2026-10-10", 11), "sun", PERSONAS[4]) },
  { tag: "ручной: вт 15:10 · rain · 2 года", persona: PERSONAS[2], now: at("2026-10-06", 15), wx: "rain", ctx: homeCtx(at("2026-10-06", 15), "rain", PERSONAS[2]) },
  { tag: "ручной: вс 10:10 · cold · 2 и 9", persona: PERSONAS[10], now: at("2026-10-11", 10), wx: "cold", ctx: homeCtx(at("2026-10-11", 10), "cold", PERSONAS[10]) },
  { tag: "ручной: пт 16:10 · sun · 8 лет", persona: PERSONAS[7], now: at("2026-10-09", 16), wx: "sun", ctx: homeCtx(at("2026-10-09", 16), "sun", PERSONAS[7]) },
  { tag: "ручной: ср 11:10 · heat · 5 лет", persona: PERSONAS[4], now: at("2026-10-07", 11), wx: "heat", ctx: homeCtx(at("2026-10-07", 11), "heat", PERSONAS[4]) },
];

/* ───────── прогон ───────── */
interface Rec {
  run: Run;
  r: PlannerResult;
  plan?: Plan;
  offset: number;
  wd: number;
  month: number;
  day: number;
  start: number;
  end: number;
  flags: string[];
}
const TRIP = new Set(SCENARIO_LIBRARY.filter((s) => s.constraints?.regionOnly).map((s) => s.id));
function exec(s: ScenarioDef, run: Run): Rec {
  const region = !!run.persona.region || TRIP.has(s.id);
  const forecast = demoForecast(run.exact ? HOME : DEFAULT_ORIGIN, run.wx, run.now);
  const input = buildPlannerInput({
    query: { s: s.id },
    kids: run.persona.kids,
    origin: run.exact ? HOME : DEFAULT_ORIGIN,
    prefs: { budget: "5000", transport: "transit", maxTravelMin: 40, geoScope: region ? "moscow-region" : "moscow" },
    forecast,
    now: run.now,
    family: { want: [], visited: [], loved: [], disliked: [], seen: [] },
  });
  const r = generatePlans(input);
  const plan = r.plans[0];
  const dateISO = moscowDateISO(r.dayOffset, run.now);
  const stops = plan?.stops ?? [];
  const start = stops.length ? toMinutes(stops[0].start) : 0;
  const last = stops[stops.length - 1];
  const end = last ? toMinutes(last.start) + last.duration : 0;
  return { run, r, plan, offset: r.dayOffset, wd: weekdayOf(dateISO), month: Number(dateISO.slice(5, 7)), day: Number(dateISO.slice(8, 10)), start, end, flags: [] };
}

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/* ───────── смысловые проверки: что обещает название ───────── */
type X = { s: ScenarioDef; rec: Rec; plan: Plan; st: Plan["stops"]; kids: Persona["kids"]; ctx: ScenarioCtx };
const cat = (x: X, ...c: string[]) => x.st.filter((s) => c.includes(s.place.category));
const nonCafe = (x: X) => x.st.filter((s) => s.place.category !== "cafe");
const has = (x: X, ...c: string[]) => cat(x, ...c).length > 0;
const span = (x: X) => x.rec.end - x.rec.start;
const dayOf = (x: X) => ({ m: x.rec.month, d: x.rec.day });
const inRange = (m: number, d: number, from: [number, number], to: [number, number]) => {
  const v = m * 100 + d;
  const a = from[0] * 100 + from[1];
  const b = to[0] * 100 + to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};
const SEM: Record<string, (x: X) => string[]> = {
  "before-rain": (x) => [...(x.st.some((s) => s.place.outdoor) ? [] : ["нет прогулки до дождя"]), ...(x.rec.end <= 15 * 60 + 10 || x.st.some((s) => s.place.indoor && toMinutes(s.start) + s.duration > 14 * 60 + 30) ? [] : ["нет места «потом под крышу»"])],
  frost: (x) => (planHasFood(x.plan) ? [] : ["нет горячего (еды) в плане"]),
  "first-snow": (x) => (x.st.every((s) => s.place.outdoor || s.place.category === "cafe") ? [] : ["не на улице"]),
  "golden-autumn": (x) => (inRange(dayOf(x).m, dayOf(x).d, [9, 15], [10, 25]) ? [] : [`листопад не по дате: ${dayOf(x).d}.${dayOf(x).m}`]),
  picnic: (x) => [...(x.rec.start >= 11 * 60 ? [] : ["раньше 11:00"]), ...(has(x, "cafe") ? ["кафе в плане, а «еда с собой»"] : [])],
  spring: (x) => (inRange(dayOf(x).m, dayOf(x).d, [3, 1], [5, 31]) ? [] : ["не весна"]),
  "warm-evening": (x) => [...(x.rec.start >= 17 * 60 ? [] : ["старт раньше 17:00"]), ...(span(x) >= 90 ? [] : [`всего ${span(x)} мин`]), ...(x.st.some((s) => s.place.outdoor) ? [] : ["нет прогулки"]), ...(planHasFood(x.plan) ? [] : ["нет ужина"])],
  "winter-tale": (x) => (inRange(dayOf(x).m, dayOf(x).d, [12, 1], [2, 28]) ? [] : ["не зима"]),
  rink: (x) => (nonCafe(x).every((s) => s.place.place_type === "ice_rink") ? [] : ["не каток"]),
  "hot-water": (x) => (nonCafe(x).every((s) => ["waterpark", "aquarium"].includes(s.place.place_type ?? "")) ? [] : ["не вода"]),
  // игровых центров в базе мало (и они дорогие), поэтому «игровым» считаем и интерактивные места (мастерские, игровые зоны), но не магазины/спектакли
  "rain-play": (x) => (nonCafe(x).filter((s) => ["play", "active"].includes(s.place.category) || s.place.experience_tags.some((e) => ["playzone", "workshop"].includes(e))).length >= Math.ceil(nonCafe(x).length / 2) ? [] : ["мало игровых"]),
  short: (x) => (span(x) <= 170 ? [] : [`длинно для «пары часов»: ${span(x)} мин`]),
  "before-nap": (x) => [...(x.rec.end <= 13 * 60 + 10 ? [] : ["позже 13:00"]), ...(x.rec.start < 12 * 60 ? [] : ["старт ближе ко сну"])],
  morning: (x) => (x.rec.start < 12 * 60 ? [] : [`«утро», а старт ${hm(x.rec.start)}`]),
  "breakfast-kids": (x) => [...(x.st[0]?.place.category === "cafe" ? [] : ["первым не кафе"]), ...(x.rec.start <= 11 * 60 ? [] : [`завтрак в ${hm(x.rec.start)}`])],
  "after-school": (x) => [...(x.rec.wd < 5 ? [] : [`план на ${WD[x.rec.wd]}`]), ...(x.rec.start >= 15 * 60 ? [] : [`«после садика», а старт ${hm(x.rec.start)}`])],
  "weekday-evening": (x) => (x.rec.wd < 5 ? [] : [`план на ${WD[x.rec.wd]}`]),
  friday: (x) => [...(x.rec.wd === 4 ? [] : [`«вечер пятницы», а план на ${WD[x.rec.wd]}`]), ...(planHasFood(x.plan) ? [] : ["нет ужина"])],
  "big-saturday": (x) => [...(x.rec.wd === 5 ? [] : [`«суббота», а план на ${WD[x.rec.wd]}`]), ...(span(x) >= 270 ? [] : [`«целый день», а ${span(x)} мин`])],
  "slow-sunday": (x) => [...(x.rec.wd === 6 ? [] : [`«воскресенье», а план на ${WD[x.rec.wd]}`]), ...(span(x) >= 150 ? [] : [`всего ${span(x)} мин`])],
  "weekend-morning": (x) => [...(x.rec.wd >= 5 ? [] : [`«выходного», а ${WD[x.rec.wd]}`]), ...(x.rec.start <= 11 * 60 + 30 ? [] : [`старт ${hm(x.rec.start)}`]), ...(planHasFood(x.plan) ? [] : ["нет обеда"])],
  "lunch-walk": (x) => [...(has(x, "cafe") ? [] : ["нет обеда"]), ...(x.st.some((s) => s.place.outdoor) ? [] : ["нет прогулки"]), ...(x.rec.start >= 11 * 60 && x.rec.start <= 14 * 60 + 30 ? [] : [`обед в ${hm(x.rec.start)}`])],
  holidays: (x) => [...(x.st.length >= 4 ? [] : [`${x.st.length} шага`]), ...(x.rec.wd < 5 && isSchoolBreak(x.rec.month, x.rec.day) ? [] : ["не каникулы по плану"]), ...(span(x) >= 270 ? [] : [`всего ${span(x)} мин`])],
  "late-start": (x) => (x.rec.offset === 0 ? [] : ["«выехали поздно», а план на завтра"]),
  "sunday-eve": (x) => [...(x.rec.wd === 6 ? [] : [`«воскресный вечер», а план на ${WD[x.rec.wd]}`]), ...(x.rec.start >= 13 * 60 ? [] : [`старт ${hm(x.rec.start)} — это не вечер`])],
  "weekday-off": (x) => [...(x.rec.wd < 5 ? [] : [`«будний», а ${WD[x.rec.wd]}`]), ...(cat(x, "museum", "animals").length ? [] : ["нет музея/зоопарка"])],
  "day-trip": (x) => (span(x) >= 240 ? [] : [`«на день», а ${span(x)} мин`]),
  "museums-away": (x) => (has(x, "museum") ? [] : ["нет музея"]),
  baby: (x) => (x.st.every((s) => s.place.activity_level <= 2 && s.place.noise_level <= 2) ? [] : ["шумно/активно для малыша"]),
  siblings: (x) => (x.rec.r.partialAge ? ["подходит не обоим"] : []),
  grandma: (x) => (x.st.every((s) => s.place.activity_level <= 2) ? [] : ["активное место для бабушки"]),
  grandpa: (x) => (x.st.every((s) => s.place.activity_level <= 2) ? [] : ["активное место для дедушки"]),
  friends: (x) => (has(x, "play", "active") ? [] : ["нет игровой/активной"]),
  "dad-day": (x) => (has(x, "active") ? [] : ["нет активного места"]),
  preschool: (x) => (has(x, "play", "animals") || x.st.some((s) => s.place.experience_tags.some((e) => ["show", "playzone"].includes(e))) || (x.kids.some((k) => k.interests.length) && has(x, "museum")) ? [] : ["нет игровой/зоопарка/спектакля"]),
  primary: (x) => (has(x, "museum", "active") ? [] : ["нет музея/активного"]),
  "big-family": (x) => (has(x, "park", "play") ? [] : ["нет парка/игровой"]),
  "mom-friends": (x) => (planHasFood(x.plan) ? [] : ["нет кафе"]),
  "first-grader": (x) => [...(x.rec.wd < 5 ? [] : [`«после школы», а ${WD[x.rec.wd]}`]), ...(x.rec.start >= 13 * 60 ? [] : [`старт ${hm(x.rec.start)}`])],
  twins: (x) => (has(x, "play", "park") ? [] : ["нет игровой/парка"]),
  birthday: (x) => (planHasFood(x.plan) ? [] : ["нет еды"]),
  guests: (x) => [...(cat(x, "museum", "park", "animals").length >= 2 ? [] : ["мало «достопримечательного»"]), ...(span(x) >= 270 ? [] : [`«на день», а ${span(x)} мин`])],
  reward: (x) => (has(x, "shop", "active", "play") ? [] : ["нет магазина/активного/игровой"]),
  "first-time": (x) => (has(x, "animals", "museum") ? [] : ["нет зоопарка/музея"]),
  "new-year": (x) => (inRange(dayOf(x).m, dayOf(x).d, [12, 15], [1, 10]) ? [] : [`не каникулы: ${dayOf(x).d}.${dayOf(x).m}`]),
  gift: (x) => (nonCafe(x).every((s) => s.place.category === "shop") ? [] : ["не магазин"]),
  "family-dinner": (x) => [...(planHasFood(x.plan) ? [] : ["нет стола"]), ...(x.rec.wd >= 5 ? [] : [`«праздник», а ${WD[x.rec.wd]}`])],
  "summer-farewell": (x) => [...(inRange(dayOf(x).m, dayOf(x).d, [8, 1], [9, 15]) ? [] : [`не конец лета: ${dayOf(x).d}.${dayOf(x).m}`]), ...(span(x) >= 240 ? [] : [`«на день», а ${span(x)} мин`])],
  playeat: (x) => [...(has(x, "play", "active") || x.st.some((s) => s.place.experience_tags.includes("playzone")) ? [] : ["нет игровой"]), ...(planHasFood(x.plan) ? [] : ["нет еды"])],
  energy: (x) => (has(x, "play", "active", "park") ? [] : ["нечем выплеснуть энергию"]),
  science: (x) => (x.st.some((s) => s.place.interest_tags.some((i) => ["science", "space"].includes(i))) ? [] : ["нет науки"]),
  animals: (x) => (nonCafe(x).every((s) => s.place.category === "animals") ? [] : ["не животные"]),
  calm: (x) => (x.st.every((s) => s.place.activity_level <= 2) ? [] : ["активное место"]),
  coffee: (x) => (planHasFood(x.plan) ? [] : ["нет кафе"]),
  "theatre-circus": (x) => (nonCafe(x).every((s) => ["theatre", "circus"].includes(s.place.place_type ?? "")) ? [] : ["не театр/цирк"]),
  "dino-day": (x) => (x.st.some((s) => s.place.interest_tags.some((i) => ["dinosaurs", "nature"].includes(i))) ? [] : ["нет динозавров/природы"]),
  "transport-day": (x) => (x.st.some((s) => s.place.interest_tags.some((i) => ["transport", "construction"].includes(i))) ? [] : ["нет техники"]),
  "nature-walk": (x) => (nonCafe(x).every((s) => s.place.category === "park") ? [] : ["не парк"]),
  "sport-day": (x) => (has(x, "active", "play") ? [] : ["нет спорта/игровой"]),
  "sweet-workshop": (x) => [...(x.st.some((s) => s.place.experience_tags.includes("workshop")) ? [] : ["нет мастер-класса"]), ...(planHasFood(x.plan) ? [] : ["нет сладкого/еды"])],
  bookish: (x) => (x.st.some((s) => s.place.experience_tags.includes("books")) ? [] : ["нет книг"]),
  "cheap-lunch": (x) => (planHasFood(x.plan) ? [] : ["нет обеда"]),
  easy: (x) => (x.st.length === 1 ? [] : [`${x.st.length} шага вместо одного`]),
  splurge: (x) => (x.plan.budget >= 2500 ? [] : [`«потратиться», а бюджет плана ${x.plan.budget} ₽`]),
  gentle: (x) => [...(x.st.every((s) => s.place.activity_level <= 1) ? [] : ["беготня"]), ...(x.st.every((s) => s.place.indoor) ? [] : ["на улице"])],
  "low-energy": (x) => (x.st.some((s) => s.place.category === "cafe") ? [] : ["нет места присесть (кафе)"]),
  "no-crowd": (x) => (x.st.every((s) => s.place.noise_level <= 2) ? [] : ["шумно"]),
};

/** Ожидаемая длина по названию: доля заявленной DURATION_MIN. */
function durationFlag(s: ScenarioDef, rec: Rec): string | undefined {
  if (!rec.plan) return;
  const want = DURATION_MIN[s.duration];
  const got = rec.end - rec.start;
  if (TRIP.has(s.id)) return;
  const narrow = !!(s.constraints?.onlyCategories?.length || s.constraints?.onlyTypes?.length || s.constraints?.onlyExperiences?.length || s.constraints?.maxStops);
  if (got < want * (narrow ? 0.4 : 0.55)) return `урезан: ${got} мин из ${want}`;
  return;
}

const recs = new Map<string, Rec[]>();
const flagCount = new Map<string, Map<string, number>>();
const bump = (sid: string, f: string) => {
  const m = flagCount.get(sid) ?? new Map<string, number>();
  m.set(f, (m.get(f) ?? 0) + 1);
  flagCount.set(sid, m);
};
for (const s of SCENARIO_LIBRARY) {
  const shown = shownBy.get(s.id) ?? [];
  const runs: Run[] = [...sample(shown, PER_SCENARIO).map((r) => ({ ...r })), ...MANUAL.map((m) => ({ ...m, sid: s.id }))];
  if (s.constraints?.maxTravelMin) runs.push(...sample(shown, 4).map((r) => ({ ...r, exact: true, tag: `${r.tag} · от Тушино` })));
  const list: Rec[] = [];
  for (const run of runs) {
    const rec = exec(s, run);
    const f = rec.flags;
    if (!rec.plan) f.push("пусто");
    else {
      const x: X = { s, rec, plan: rec.plan, st: rec.plan.stops, kids: run.persona.kids, ctx: scenarioCtx(s, run.ctx) };
      const manual = run.tag.startsWith("ручной");
      // 1. время плана — в окне, ради которого сценарий показан
      if (!manual) {
        const own = scenarioCtx(s, run.ctx);
        // «сегодня» — окно считается по часу, когда сценарий показан; «завтра» — по часу старта завтрашнего плана
        const planCtx: ScenarioCtx = { ...own, weekday: rec.wd, hour: rec.offset === 0 ? own.hour : Math.floor(rec.start / 60), month: rec.month, day: rec.day };
        if (s.relevance(planCtx) <= 0) f.push(`время плана вне окна сценария (${WD[rec.wd]} ${hm(rec.start)})`);
        // главная считает день для сценария тем же правилом, что движок: расхождение — это уже баг
        const sc = scenarioCtx(s, run.ctx);
        const homeTomorrow = sc !== run.ctx.today;
        if (rec.offset > 0 !== homeTomorrow) f.push(`главная считает «${homeTomorrow ? "завтра" : "сегодня"}», а план — ${rec.offset > 0 ? "завтра" : "сегодня"}`);
      }
      const d = durationFlag(s, rec);
      if (d) f.push(d);
      // даты и дни недели смысловых проверок осмысленны, только когда сценарий показан главной; «ручной» запуск — в любой момент
      for (const m of SEM[s.id]?.(x) ?? []) if (!manual || !/(не весна|не зима|листопад|не конец лета|не каникулы|«[а-я ]+», а [а-я]{2}$|«[а-я ]+», а план на)/.test(m)) f.push(m);
    }
    f.forEach((m) => bump(s.id, m));
    list.push(rec);
  }
  recs.set(s.id, list);
}

/* ───────── пары сценариев, дающие одно и то же ───────── */
const GRID: Omit<Run, "sid">[] = [];
for (const [iso, h] of [["2026-10-10", 11], ["2026-10-11", 12], ["2026-10-06", 15], ["2026-10-09", 16]] as const)
  for (const wx of ["sun", "rain"] as WxScenario[])
    for (const pi of [1, 2, 4, 7, 8, 10, 11, 12]) GRID.push({ tag: `${iso} ${h} ${wx} ${PERSONAS[pi].id}`, persona: PERSONAS[pi], now: at(iso, h), wx, ctx: homeCtx(at(iso, h), wx, PERSONAS[pi]) });
// «похожесть» важна только если оба сценария реально попадают в одну восьмёрку на главной
const TOP = GRID.map((g) => new Set(pickScenarios(g.ctx).map((x) => x.id)));
const sig = new Map<string, Map<number, Set<string> | null>>();
for (const s of SCENARIO_LIBRARY) {
  if (TRIP.has(s.id)) continue;
  const m = new Map<number, Set<string> | null>();
  GRID.forEach((g, i) => {
    // сравниваем только там, где сценарий вообще уместен для этой семьи и момента (иначе «похожесть» — артефакт теста)
    if (!TOP[i].has(s.id)) return void m.set(i, null);
    const rec = exec(s, { ...g, sid: s.id });
    m.set(i, new Set((rec.plan?.stops ?? []).filter((st) => st.place.category !== "cafe").map((st) => st.place.slug)));
  });
  sig.set(s.id, m);
}
const ids = [...sig.keys()];
const sims: { a: string; b: string; v: number; n: number }[] = [];
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    let tot = 0;
    let n = 0;
    for (let g = 0; g < GRID.length; g++) {
      const A = sig.get(ids[i])!.get(g);
      const B = sig.get(ids[j])!.get(g);
      if (!A || !B || (!A.size && !B.size)) continue;
      const inter = [...A].filter((x) => B.has(x)).length;
      tot += inter / (A.size + B.size - inter || 1);
      n++;
    }
    if (n >= 3) sims.push({ a: ids[i], b: ids[j], v: tot / n, n });
  }
sims.sort((p, q) => q.v - p.v);

/* ───────── вывод ───────── */
const lines: string[] = [];
const log = (s = "") => {
  lines.push(s);
};
const label = (id: string) => SCENARIO_LIBRARY.find((s) => s.id === id)!.label;
let problemScenarios = 0;
for (const s of SCENARIO_LIBRARY) {
  const list = recs.get(s.id)!;
  const fc = flagCount.get(s.id);
  const total = list.length;
  const empty = list.filter((r) => !r.plan).length;
  const sorted = [...(fc?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
  if (sorted.length) problemScenarios++;
  log(`### ${s.label} · ${s.id}  (${total} прогонов, пусто ${empty})`);
  for (const [f, n] of sorted) log(`- ${f}: ${n}/${total}`);
  if (!sorted.length) log("- замечаний нет");
  const byPersona = new Map<string, { n: number; bad: number }>();
  for (const r of list) {
    if (r.run.tag.startsWith("ручной")) continue;
    const v = byPersona.get(r.run.persona.id) ?? { n: 0, bad: 0 };
    v.n++;
    if (r.flags.length) v.bad++;
    byPersona.set(r.run.persona.id, v);
  }
  const personaLine = [...byPersona.entries()].filter(([, v]) => v.bad).map(([k, v]) => `${k} ${v.bad}/${v.n}`).join(", ");
  if (personaLine) log(`- по семьям (с замечаниями): ${personaLine}`);
  const ex = [...list.filter((r) => r.plan).slice(0, 2), ...list.filter((r) => r.plan && r.flags.length).slice(0, 2)];
  for (const r of ex) {
    const p = r.plan!;
    log(`  · ${r.run.tag} → ${WD[r.wd]} ${hm(r.start)}–${hm(r.end)}: ${p.stops.map((st) => `${st.place.title} [${st.place.category}${st.place.indoor && !st.place.outdoor ? "·in" : st.place.outdoor && !st.place.indoor ? "·out" : ""}]`).join(" → ")}${r.flags.length ? `  ⚠ ${r.flags.join("; ")}` : ""}`);
  }
  for (const r of list.filter((x) => !x.plan).slice(0, 4)) log(`  · ПУСТО: ${r.run.tag}`);
  log();
}
log("## Пары сценариев с почти одинаковой выдачей (среднее пересечение мест, 1.0 = одно и то же)");
for (const p of sims.filter((x) => x.v >= 0.6).slice(0, 40)) log(`- ${p.v.toFixed(2)} (${p.n} сл.) · «${label(p.a)}» ≈ «${label(p.b)}»`);
const text = lines.join("\n");
if (MD) writeFileSync(MD, text);
console.log(`сценариев с замечаниями: ${problemScenarios}/${SCENARIO_LIBRARY.length}`);
for (const s of SCENARIO_LIBRARY) {
  const fc = flagCount.get(s.id);
  if (!fc?.size) continue;
  console.log(`${s.id}: ${[...fc.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ×${n}`).join(" | ")}`);
}
console.log("\nпохожие пары:");
for (const p of sims.filter((x) => x.v >= 0.6).slice(0, 30)) console.log(`${p.v.toFixed(2)} (${p.n}) ${p.a} ≈ ${p.b}`);
