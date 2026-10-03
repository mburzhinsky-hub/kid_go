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
import { AREAS } from "../src/lib/location";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";
import type { BudgetId, DurationId, InterestId, MoodId, PlannerInput } from "../src/lib/types";

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
            if (p.fromHome && p.fromHome.minutes > 45 * 1.35 + 1) violations.push(`далеко ${p.fromHome.minutes} мин: ${tag}`);
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
scenarioEmpty.slice(0, 12).forEach((x) => console.log("  ·", x));
const fail = scenarioEmpty.filter((x) => !x.startsWith("(")).length > 0 || violations.length > 0 || emptyNoHelp / runs > 0.02 || empty / runs > 0.15 || richOne / Math.max(1, richRuns) > 0.05;
if (fail) {
  console.error("\nОценка не пройдена");
  process.exit(1);
}
console.log("\nОценка пройдена ✓");
