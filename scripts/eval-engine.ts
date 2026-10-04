/**
 * Offline-оценка движка рекомендаций (запускается в CI).
 *   npx tsx scripts/eval-engine.ts
 *
 * Прогоняет семьи × точки выезда × погода × настроение × длительность и считает:
 *  - нарушения жёстких условий (закрыто к приходу, не по возрасту, вне бюджета, улица в плохую погоду,
 *    слишком далеко, позже 21:00) — должно быть 0;
 *  - разнообразие: доля самого частого первого места, число уникальных первых мест;
 *  - полноту: доля «однoшаговых» дней для 3+ часов, средняя длина дня по запросу;
 *  - чувствительность к точке выезда и к интересам детей.
 */
import { generatePlans, BUDGET_MAX, DURATION_MIN } from "../src/lib/recommend/engine";
import { demoForecast, daySummary, moscowDateISO, outdoorVerdict, weekdayOf, windowWx, type WxScenario } from "../src/lib/forecast";
import { isOpenDuring, toMinutes } from "../src/lib/format";
import { AREAS, SETTLEMENTS, isSuburban } from "../src/lib/location";
import { SCENARIO_LIBRARY, pickScenarios, type ScenarioCtx } from "../src/lib/scenarios";
import type { BudgetId, DurationId, InterestId, MoodId, PlannerInput } from "../src/lib/types";
import { placesFromOsm, parseOpeningHours, type OsmElement } from "../src/lib/osm";
import { readFileSync } from "node:fs";

const NOW = new Date("2026-10-03T08:00:00Z"); // суббота, 11:00 МСК

const families: Record<string, { name: string; age: number; interests: InterestId[] }[]> = {
  "малыш 0": [{ name: "", age: 0, interests: [] }],
  "малыш 2": [{ name: "", age: 2, interests: ["animals"] }],
  "5 и 9": [
    { name: "", age: 5, interests: ["dinosaurs", "space"] },
    { name: "", age: 9, interests: ["drawing", "animals"] },
  ],
  "7, музыка": [{ name: "", age: 7, interests: ["music"] }],
  "11, спорт": [{ name: "", age: 11, interests: ["sport", "science"] }],
  "1, 6 и 12": [
    { name: "", age: 1, interests: [] },
    { name: "", age: 6, interests: ["transport"] },
    { name: "", age: 12, interests: ["science"] },
  ],
};
const origins = ["center", "tushino", "chertanovo", "izmaylovo"].map((id) => AREAS.find((a) => a.id === id)!);
const weathers: WxScenario[] = ["sun", "rain", "rain15", "cold", "heat"];
const moods: MoodId[] = ["energy", "creative", "learn", "outdoor", "calm", "surprise"];
const durations: DurationId[] = ["short", "mid", "half", "day"];
const budgets: BudgetId[] = ["5000", "any", "2000", "free"];

let runs = 0;
let empty = 0;
const violations: string[] = [];
const top1 = new Map<string, number>();
let multiStepRuns = 0;
let oneStep = 0;
const totalByDur: Record<string, number[]> = {};
const stopsByDur: Record<string, number[]> = {};
let interestRuns = 0;
let interestHits = 0;
const byKey = new Map<string, string>();
const emptyBy = new Map<string, number>();
let emptyNoHelp = 0;
let richRuns = 0;
let richOne = 0;
const oneBy = new Map<string, number>();

for (const [fname, kids] of Object.entries(families))
  for (const o of origins)
    for (const wx of weathers) {
      const forecast = demoForecast(o, wx, NOW);
      for (const mood of moods)
        for (const duration of durations)
          for (const budget of budgets) {
          const input: PlannerInput = {
            children: kids,
            mood,
            duration,
            budget,
            transport: "transit",
            location: o,
            weather: daySummary(forecast, moscowDateISO(0, NOW)).weather,
            now: NOW,
            forecast,
            seed: "eval",
          };
          const r = generatePlans(input);
          runs++;
          if (!r.plans.length) {
            empty++;
            if (!r.suggestions.length) emptyNoHelp++;
            for (const k of [fname, o.label, wx, budget, mood, duration]) emptyBy.set(k, (emptyBy.get(k) ?? 0) + 1);
            continue;
          }
          const dateISO = moscowDateISO(r.dayOffset, NOW);
          const weekday = weekdayOf(dateISO);
          const youngest = Math.min(...kids.map((k) => k.age));
          r.plans.forEach((p, pi) => {
            const tag = `${fname} · ${o.label} · ${wx} · ${mood} · ${duration} · ${budget} · #${pi + 1}`;
            for (const s of p.stops) {
              const at = toMinutes(s.start);
              if (!isOpenDuring(s.place.opening_hours, weekday, at, s.duration)) violations.push(`закрыто: ${s.place.slug} ${s.start} — ${tag}`);
              if (!r.partialAge && kids.some((k) => k.age < s.place.age_min || k.age > s.place.age_max))
                violations.push(`возраст: ${s.place.slug} — ${tag}`);
              if (s.place.outdoor && !s.place.indoor) {
                const v = outdoorVerdict(windowWx(forecast, dateISO, at, at + s.duration), youngest);
                if (!v.ok) violations.push(`погода (${v.reason}): ${s.place.slug} ${s.start} — ${tag}`);
              }
              if (at + s.duration > 21 * 60) violations.push(`поздно: ${s.place.slug} — ${tag}`);
            }
            if (budget !== "any" && budget !== "free" && p.budget > BUDGET_MAX[budget] * 1.1) violations.push(`бюджет ${p.budget}: ${tag}`);
            if (budget === "free" && p.stops.some((s) => s.place.price_min > 0)) violations.push(`не бесплатно: ${tag}`);
            if (!r.relaxed && p.fromHome && p.fromHome.minutes > 45 * 1.35 + 1) violations.push(`далеко ${p.fromHome.minutes} мин: ${tag}`);
          });
          const first = r.plans[0];
          top1.set(first.stops[0].place.slug, (top1.get(first.stops[0].place.slug) ?? 0) + 1);
          const rich = (o.id === "center" || o.id === "izmaylovo") && (budget === "5000" || budget === "any");
          if (DURATION_MIN[duration] >= 240 && rich) {
            richRuns++;
            if (first.stops.length === 1) richOne++;
          }
          if (DURATION_MIN[duration] >= 240) {
            multiStepRuns++;
            if (first.stops.length === 1) {
              oneStep++;
              for (const k of [fname, o.label, wx, budget, mood, duration]) oneBy.set(k, (oneBy.get(k) ?? 0) + 1);
            }
          }
          (totalByDur[duration] ??= []).push(first.totalMinutes);
          (stopsByDur[duration] ??= []).push(first.stops.length);
          const ints = kids.flatMap((k) => k.interests);
          if (ints.length) {
            interestRuns++;
            if (r.plans.some((p) => p.stops.some((s) => s.place.interest_tags.some((t) => ints.includes(t))))) interestHits++;
          }
          byKey.set(`${fname}|${wx}|${mood}|${duration}|${o.id}`, first.key);
        }
    }

// каждый сценарий библиотеки даёт план (или честную подсказку) для разных семей и погоды
const scenarioEmpty: string[] = [];
let scenarioRuns = 0;
for (const sc of SCENARIO_LIBRARY)
  for (const [fname, kids] of Object.entries(families).slice(1, 4))
    for (const wx of ["sun", "rain", "rain15"] as WxScenario[]) {
      const o = origins[0];
      const forecast = demoForecast(o, wx, NOW);
      const r = generatePlans({
        children: kids,
        mood: sc.mood,
        duration: sc.duration,
        budget: sc.budget ?? "5000",
        transport: "transit",
        location: o,
        weather: daySummary(forecast, moscowDateISO(0, NOW)).weather,
        now: NOW,
        forecast,
        foodAfter: sc.food,
        constraints: sc.constraints,
        seed: "eval",
      });
      scenarioRuns++;
      if (!r.plans.length && !r.suggestions.length) scenarioEmpty.push(`${sc.id} · ${fname} · ${wx}`);
      else if (!r.plans.length) scenarioEmpty.push(`(подсказка) ${sc.id} · ${fname} · ${wx}`);
    }

// чувствительность к точке выезда: тот же запрос из разных районов
let pairs = 0;
let differ = 0;
for (const [k, v] of byKey) {
  if (!k.endsWith("|center")) continue;
  for (const o of origins.slice(1)) {
    const other = byKey.get(k.replace(/\|center$/, `|${o.id}`));
    if (!other) continue;
    pairs++;
    if (other !== v) differ++;
  }
}


/* ───────── Загород: за МКАД тоже должно что-то предлагаться ───────── */
const suburbs = ["krasnogorsk", "odintsovo", "mytishchi", "podolsk", "khimki", "balashikha", "lyubertsy", "dmitrov", "istra", "domodedovo"].map((id) => SETTLEMENTS.find((x) => x.id === id)!);
let subRuns = 0;
let subEmpty = 0;
let subRelaxed = 0;
const subMax: number[] = [];
const subViol: string[] = [];
for (const [fname, kids] of Object.entries(families))
  for (const o of suburbs)
    for (const wx of ["sun", "rain"] as WxScenario[])
      for (const duration of ["short", "mid", "day"] as DurationId[])
        for (const budget of ["any", "2000"] as BudgetId[]) {
          const forecast = demoForecast(o, wx, NOW);
          const r = generatePlans({
            children: kids, mood: "surprise", duration, budget, transport: "car", location: o,
            weather: daySummary(forecast, moscowDateISO(0, NOW)).weather, now: NOW, forecast, seed: "eval",
          });
          subRuns++;
          if (!r.plans.length) subEmpty++;
          else {
            if (r.relaxed) subRelaxed++;
            const dateISO = moscowDateISO(r.dayOffset, NOW);
            const weekday = weekdayOf(dateISO);
            for (const p of r.plans) {
              subMax.push(p.fromHome?.minutes ?? 0);
              for (const st of p.stops) {
                if (!isOpenDuring(st.place.opening_hours, weekday, toMinutes(st.start), st.duration)) subViol.push(`закрыто ${st.place.slug} — ${fname}/${o.label}`);
                if (toMinutes(st.start) + st.duration > 21 * 60) subViol.push(`поздно ${st.place.slug} — ${fname}/${o.label}`);
              }
            }
          }
        }


/* ───────── Места из OpenStreetMap: посёлок, где каталог пуст, получает локальные планы ───────── */
const OSM_FIX = JSON.parse(readFileSync(new URL("./fixtures/overpass-sample.json", import.meta.url), "utf8")).elements as OsmElement[];
const village = { lat: 56.06, lng: 36.98, label: "Посёлок (тест)", source: "custom" as const };
const osmPlaces = placesFromOsm(OSM_FIX, village);
const osmProblems: string[] = [];
if (osmPlaces.some((p) => !p.title || p.review_count !== 0 || p.confidence !== "osm")) osmProblems.push("места OSM без названия / с выдуманными отзывами");
if (osmPlaces.some((p) => p.slug.indexOf("osm-") !== 0)) osmProblems.push("slug OSM-места не начинается с osm-");
if (osmPlaces.some((p) => p.opening_hours.length !== 7)) osmProblems.push("режим работы не на 7 дней");
if (osmPlaces.length < 20 || osmPlaces.length > 31) osmProblems.push(`после фильтрации ${osmPlaces.length} мест (ожидали 20–31)`);
const oh = parseOpeningHours("Tu-Su 10:00-17:00; Mo off");
if (!oh || oh[0] !== null || oh[1]?.[0] !== "10:00" || oh[6]?.[1] !== "17:00") osmProblems.push("parseOpeningHours: Tu-Su/Mo off");
if (parseOpeningHours("странный формат") !== null) osmProblems.push("parseOpeningHours должен вернуть null на мусоре");
let osmRuns = 0;
let osmNoPlan = 0;
let osmNearer = 0;
let osmCompared = 0;
const osmFirst: number[] = [];
const osmBase: number[] = [];
for (const [fname, kids] of Object.entries(families))
  for (const wx of ["sun", "rain", "cold"] as WxScenario[])
    for (const duration of ["short", "mid", "half"] as DurationId[])
      for (const budget of ["any", "2000", "free"] as BudgetId[]) {
        const forecast = demoForecast(village, wx, NOW);
        const input = {
          children: kids, mood: "surprise" as MoodId, duration, budget, transport: "car" as const, location: village,
          weather: daySummary(forecast, moscowDateISO(0, NOW)).weather, now: NOW, forecast, seed: "eval",
        };
        const withOsm = generatePlans({ ...input, extraPlaces: osmPlaces });
        const without = generatePlans(input);
        osmRuns++;
        if (!withOsm.plans.length) {
          osmNoPlan++;
          continue;
        }
        const dateISO = moscowDateISO(withOsm.dayOffset, NOW);
        const weekday = weekdayOf(dateISO);
        for (const p of withOsm.plans)
          for (const st of p.stops)
            if (!isOpenDuring(st.place.opening_hours, weekday, toMinutes(st.start), st.duration)) osmProblems.push(`закрыто ${st.place.slug} — ${fname}/${wx}`);
        if (without.plans.length) {
          osmCompared++;
          const a = withOsm.plans[0].fromHome?.minutes ?? 0;
          const b = without.plans[0].fromHome?.minutes ?? 0;
          osmFirst.push(a);
          osmBase.push(b);
          if (a <= b) osmNearer++;
        }
      }

/* ───────── Чувствительность: меняем ОДНО условие — план должен меняться ───────── */
type Ov = Partial<{ kids: (typeof families)[string]; o: (typeof origins)[number]; wx: WxScenario; mood: MoodId; duration: DurationId; budget: BudgetId; transport: PlannerInput["transport"]; now: Date }>;
const baseCfgs: { fname: string; kids: (typeof families)[string]; o: (typeof origins)[number]; mood: MoodId; duration: DurationId }[] = [];
for (const [fname, kids] of Object.entries(families))
  for (const o of origins) for (const mood of moods) for (const duration of ["mid", "half"] as DurationId[]) baseCfgs.push({ fname, kids, o, mood, duration });
function plan1(b: (typeof baseCfgs)[number], ov: Ov) {
  const now = ov.now ?? NOW;
  const o = ov.o ?? b.o;
  const wx = ov.wx ?? "sun";
  const forecast = demoForecast(o, wx, now);
  const r = generatePlans({
    children: ov.kids ?? b.kids, mood: ov.mood ?? b.mood, duration: ov.duration ?? b.duration, budget: ov.budget ?? "5000", transport: ov.transport ?? "transit", location: o,
    weather: daySummary(forecast, moscowDateISO(0, now)).weather, now, forecast, seed: "eval",
  });
  return r.plans[0];
}
const SENS: { name: string; a: Ov; b: Ov; min: number; by?: "key" | "stops" | "anchor"; only?: (b: (typeof baseCfgs)[number]) => boolean }[] = [
  { name: "солнце → дождь", a: {}, b: { wx: "rain" }, min: 0.85 },
  { name: "солнце → мороз", a: {}, b: { wx: "cold" }, min: 0.55 },
  { name: "солнце → жара", a: {}, b: { wx: "heat" }, min: 0.4 },
  { name: "ребёнок 2 года → 9 лет", a: { kids: [{ name: "", age: 2, interests: [] }] }, b: { kids: [{ name: "", age: 9, interests: [] }] }, min: 0.85 },
  { name: "бюджет 5 000 → бесплатно", a: {}, b: { budget: "free" }, min: 0.7 },
  { name: "бюджет 5 000 → 2 000", a: {}, b: { budget: "2000" }, min: 0.35 },
  { name: "настроение: энергия → спокойно", a: { mood: "energy" }, b: { mood: "calm" }, min: 0.8 },
  { name: "настроение: узнать → на воздухе", a: { mood: "learn" }, b: { mood: "outdoor" }, min: 0.75 },
  { name: "длительность: 2 часа → весь день", a: { duration: "short" }, b: { duration: "day" }, min: 0.9, by: "stops" },
  { name: "точка выезда: центр → другой район", a: { o: origins[0] }, b: { o: origins[1] }, min: 0.45 },
  { name: "транспорт: метро → машина", a: {}, b: { transport: "car" }, min: 0.3 },
  { name: "будний вечер → субботнее утро", a: { now: new Date("2026-10-06T14:00:00Z") }, b: { now: NOW }, min: 0.4 },
  { name: "лето → зима (метки сезона у мест)", a: { now: new Date("2026-07-04T08:00:00Z") }, b: { now: new Date("2027-01-09T08:00:00Z") }, min: 0.08 },
  { name: "интерес: динозавры → животные", a: { kids: [{ name: "", age: 6, interests: ["dinosaurs"] }] }, b: { kids: [{ name: "", age: 6, interests: ["animals"] }] }, min: 0.65 },
];
const sensRes: { name: string; rate: number; min: number }[] = [];
for (const t of SENS) {
  let n = 0;
  let ch = 0;
  for (const b of baseCfgs) {
    if (t.only && !t.only(b)) continue;
    const a = plan1(b, t.a);
    const c = plan1(b, t.b);
    if (!a || !c) continue;
    n++;
    const differ = t.by === "stops" ? a.stops.length !== c.stops.length || a.totalMinutes !== c.totalMinutes : a.key !== c.key;
    if (differ) ch++;
  }
  sensRes.push({ name: t.name, rate: ch / Math.max(1, n), min: t.min });
}

/* Главная: набор из 8 ситуаций должен реагировать на условия */
const sc = (o: Partial<ScenarioCtx>): ScenarioCtx => ({ weekday: 5, hour: 11, month: 10, rainAllDay: false, rainLater: false, snow: false, cold: false, hot: false, sunny: true, warm: true, kidsCount: 1, youngest: 5, oldest: 5, interests: [], ...o });
const ids = (c: ScenarioCtx) => new Set(pickScenarios(c).map((x) => x.id));
const diffN = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).length;
const HOME: { name: string; a: ScenarioCtx; b: ScenarioCtx; min: number }[] = [
  { name: "солнце → дождь весь день", a: sc({}), b: sc({ sunny: false, warm: false, rainAllDay: true }), min: 3 },
  { name: "солнце → мороз", a: sc({}), b: sc({ sunny: false, warm: false, cold: true }), min: 3 },
  { name: "малыш 1–3 → школьник 10+", a: sc({ youngest: 2, oldest: 2 }), b: sc({ youngest: 11, oldest: 11 }), min: 3 },
  { name: "суббота → будний вечер", a: sc({ weekday: 5, hour: 10 }), b: sc({ weekday: 2, hour: 17 }), min: 3 },
  { name: "один ребёнок → двое с разницей", a: sc({}), b: sc({ kidsCount: 2, youngest: 2, oldest: 9 }), min: 2 },
  { name: "без интересов → рисование и наука", a: sc({}), b: sc({ interests: ["drawing", "science", "animals"] }), min: 2 },
];
const homeRes = HOME.map((h) => ({ name: h.name, n: diffN(ids(h.a), ids(h.b)), min: h.min }));

const avg = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));
const sortedTop = [...top1.entries()].sort((a, b) => b[1] - a[1]);
const nonEmpty = runs - empty;
const topShare = sortedTop.length ? sortedTop[0][1] / nonEmpty : 0;

console.log(`Прогонов: ${runs}, пустых: ${empty} (${((empty / runs) * 100).toFixed(1)}%), из них без подсказки, что ослабить: ${emptyNoHelp}`);
console.log(`Нарушений жёстких условий: ${violations.length}`);
violations.slice(0, 15).forEach((v) => console.log("  ✗", v));
console.log(`Уникальных первых мест: ${sortedTop.length}; лидер: ${sortedTop[0]?.[0]} ${(topShare * 100).toFixed(1)}%`);
console.log(`Топ-5 первых мест: ${sortedTop.slice(0, 5).map(([k, v]) => `${k} ${((v / nonEmpty) * 100).toFixed(0)}%`).join(", ")}`);
console.log(`Однoшаговых дней при запросе 3+ часов: ${((oneStep / Math.max(1, multiStepRuns)) * 100).toFixed(1)}%`);
console.log(`  …там, где хватает мест (центр/Измайлово, бюджет от 5 000): ${((richOne / Math.max(1, richRuns)) * 100).toFixed(1)}%`);
for (const d of durations) console.log(`  ${d}: запрошено ${DURATION_MIN[d]} мин → в среднем ${avg(totalByDur[d] ?? [])} мин, ${(avg((stopsByDur[d] ?? []).map((x) => x * 10)) / 10).toFixed(1)} шага`);
console.log(`Есть шаг по интересам ребёнка: ${((interestHits / Math.max(1, interestRuns)) * 100).toFixed(0)}% запросов`);
console.log(`Другая точка выезда → другой лучший план: ${((differ / Math.max(1, pairs)) * 100).toFixed(0)}%`);

if (process.argv.includes("--why"))
  console.log("Пустые по признакам:", [...emptyBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(", "));
if (process.argv.includes("--why"))
  console.log("Однoшаговые по признакам:", [...oneBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(", "));
console.log(`Сценарии: ${scenarioRuns} прогонов, без плана: ${scenarioEmpty.length}`);
console.log(`Загород (${suburbs.length} городов, на машине): ${subRuns} прогонов, пустых ${subEmpty}, с расширенным радиусом ${subRelaxed}, нарушений ${subViol.length}; дорога до первого места: ср. ${avg(subMax)} мин`);
subViol.slice(0, 5).forEach((x) => console.log("  ✗", x));
console.log(`Места из OSM (${osmPlaces.length} из ${OSM_FIX.length} элементов): ${osmRuns} прогонов, без плана ${osmNoPlan}; дорога до первого места ${avg(osmFirst)} мин против ${avg(osmBase)} мин без OSM; не дальше, чем без OSM: ${osmCompared ? Math.round((osmNearer / osmCompared) * 100) : 0}%`);
osmProblems.slice(0, 6).forEach((x) => console.log("  ✗", x));
console.log("Чувствительность (доля случаев, где изменилось ОДНО условие → изменился план):");
for (const r of sensRes) console.log(`  ${r.rate >= r.min ? "✓" : "✗"} ${r.name}: ${(r.rate * 100).toFixed(0)}% (нужно ≥ ${(r.min * 100).toFixed(0)}%)`);
console.log("Главная — сколько из 8 ситуаций заменилось при смене условий:");
for (const r of homeRes) console.log(`  ${r.n >= r.min ? "✓" : "✗"} ${r.name}: ${r.n} (нужно ≥ ${r.min})`);
scenarioEmpty.slice(0, 12).forEach((x) => console.log("  ·", x));
const sensFail = sensRes.some((r) => r.rate < r.min) || homeRes.some((r) => r.n < r.min);
const subFail = subEmpty / subRuns > 0.02 || subViol.length > 0 || osmProblems.length > 0 || osmNoPlan / osmRuns > 0.02 || (osmCompared > 0 && osmNearer / osmCompared < 0.9);
const fail = sensFail || subFail || scenarioEmpty.filter((x) => !x.startsWith("(")).length > 0 || violations.length > 0 || emptyNoHelp / runs > 0.02 || empty / runs > 0.15 || richOne / Math.max(1, richRuns) > 0.05;
if (fail) {
  console.error("\nОценка не пройдена");
  process.exit(1);
}
console.log("\nОценка пройдена ✓");
