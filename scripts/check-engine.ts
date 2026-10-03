/**
 * Санити-проверка рекомендаций: прогоняем все комбинации настроения/времени/бюджета/транспорта
 * для нескольких семей и считаем, где не нашлось ни одного дня.
 *   npx tsx scripts/check-engine.ts
 */
import { generatePlans } from "../src/lib/recommend/engine";
import { getWeather } from "../src/lib/weather";
import { DEFAULT_LOCATION } from "../src/lib/geo";
import type { BudgetId, DurationId, MoodId, TransportId, Weather } from "../src/lib/types";

const families = {
  "малыш 2": [{ name: "Тёма", age: 2, interests: [] }],
  "5 и 9": [
    { name: "Миша", age: 5, interests: ["dinosaurs", "space"] },
    { name: "Аня", age: 9, interests: ["drawing", "animals"] },
  ],
  "школьник 11": [{ name: "Петя", age: 11, interests: ["sport", "science"] }],
} as const;

const moods: MoodId[] = ["energy", "creative", "learn", "outdoor", "calm", "surprise"];
const durations: DurationId[] = ["short", "mid", "half", "day"];
const budgets: BudgetId[] = ["free", "2000", "5000", "any"];
const transports: TransportId[] = ["walk", "transit", "car"];
const weathers: Weather["condition"][] = ["sun", "rain"];
// суббота, 11:00 по Москве
const now = new Date("2026-10-03T08:00:00Z");

let total = 0;
let empty = 0;
const emptyCases: string[] = [];
const avgStops: number[] = [];
for (const [fname, kids] of Object.entries(families))
  for (const mood of moods)
    for (const duration of durations)
      for (const budget of budgets)
        for (const transport of transports)
          for (const w of weathers) {
            total++;
            const r = generatePlans({
              children: kids.map((k) => ({ ...k, interests: [...k.interests] })),
              mood, duration, budget, transport,
              location: DEFAULT_LOCATION,
              weather: getWeather(now, w),
              now,
            });
            if (!r.plans.length) {
              empty++;
              emptyCases.push(`${fname} · ${mood} · ${duration} · ${budget} · ${transport} · ${w} → ${r.suggestions.map((s) => s.label).join("; ") || "без подсказок"}`);
            } else avgStops.push(r.plans.reduce((a, p) => a + p.stops.length, 0) / r.plans.length);
          }
console.log(`Комбинаций: ${total}, без результата: ${empty} (${((empty / total) * 100).toFixed(1)}%)`);
console.log(`Среднее число точек в плане: ${(avgStops.reduce((a, b) => a + b, 0) / avgStops.length).toFixed(2)}`);
const noHints = emptyCases.filter((c) => c.endsWith("без подсказок"));
console.log(`Пустых без подсказок: ${noHints.length}`);
console.log(noHints.slice(0, 15).join("\n"));

const sample = generatePlans({
  children: [{ name: "Миша", age: 5, interests: ["dinosaurs"] }, { name: "Аня", age: 9, interests: ["drawing"] }],
  mood: "surprise", duration: "mid", budget: "5000", transport: "transit",
  location: DEFAULT_LOCATION, weather: getWeather(now, "rain"), now,
});
for (const p of sample.plans) {
  console.log(`\n${p.emoji} ${p.title}: ${p.stops.map((s) => `${s.start} ${s.place.title} (${s.duration})`).join(" → ")}`);
  console.log(`   ${p.totalMinutes} мин, ${p.budget} ₽, ${p.distanceKm} км | ${p.why.join(", ")}\n   ${p.explanation}`);
}
