/**
 * Покрытие каталога: какие места НИ РАЗУ не попали в рекомендации (по всем сценариям × семьям × погоде × округам).
 *   npx tsx scripts/audit-coverage.ts
 * Место, которое движок никогда не предлагает, — либо ошибка данных (часы, возраст, координаты), либо «мёртвый» каталог.
 */
import { generatePlans } from "../src/lib/recommend/engine";
import { buildPlannerInput } from "../src/lib/recommend/build-input";
import { demoForecast, type WxScenario } from "../src/lib/forecast";
import { DEFAULT_ORIGIN, OKRUGS, SETTLEMENTS, okrugOrigin, type Origin } from "../src/lib/location";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";
import { allPlaces } from "../src/lib/data/repository";
import type { InterestId } from "../src/lib/types";

const families: { name: string; age: number; interests: InterestId[] }[][] = [
  [{ name: "", age: 0, interests: [] }],
  [{ name: "", age: 2, interests: ["animals"] }],
  [{ name: "", age: 5, interests: ["dinosaurs", "space"] }, { name: "", age: 9, interests: ["drawing", "animals"] }],
  [{ name: "", age: 7, interests: ["music"] }],
  [{ name: "", age: 11, interests: ["sport", "science"] }],
  [{ name: "", age: 4, interests: ["transport", "nature"] }],
];
const NOWS = [new Date("2026-10-03T08:00:00Z"), new Date("2026-10-06T14:00:00Z"), new Date("2026-10-04T06:00:00Z"), new Date("2026-07-11T07:00:00Z"), new Date("2027-01-09T08:00:00Z")];
const WXS: WxScenario[] = ["sun", "rain", "cold", "heat"];
const origins: { id: string; o: Origin; transport: "transit" | "car" }[] = [
  { id: "вся Москва", o: DEFAULT_ORIGIN, transport: "transit" },
  ...SETTLEMENTS.map((x) => ({ id: x.id, o: { ...x, source: "area" } as Origin, transport: "car" as const })),
  ...OKRUGS.map((o) => ({ id: o.short, o: okrugOrigin(o), transport: (o.id === "zelao" || o.id === "nao" ? "car" : "transit") as "transit" | "car" })),
];
const count = new Map<string, number>();
let runs = 0;
for (const loc of origins) {
  const sub = SETTLEMENTS.some((x) => x.id === loc.id); // для посёлков — сокращённая сетка, иначе прогон слишком долгий
  for (const now of sub ? [NOWS[0], NOWS[3]] : NOWS)
    for (const wx of sub ? WXS.slice(0, 2) : WXS)
      for (const kids of sub ? [families[1], families[2], families[4]] : families)
        for (const s of SCENARIO_LIBRARY) {
          const forecast = demoForecast(loc.o, wx, now);
          const input = buildPlannerInput({
            query: { s: s.id } as never,
            kids,
            origin: loc.o,
            prefs: { budget: "5000", transport: loc.transport, maxTravelMin: 40 },
            forecast,
            now,
            family: { want: [], visited: [], loved: [], disliked: [], seen: [] },
          });
          const r = generatePlans(input);
          runs++;
          for (const p of r.plans) for (const st of p.stops) count.set(st.place.slug, (count.get(st.place.slug) ?? 0) + 1);
        }
}
const all = allPlaces;
const never = all.filter((p) => !count.get(p.slug));
console.log(`Прогонов: ${runs}. Мест в каталоге: ${all.length}. Ни разу не предложены: ${never.length}`);
for (const p of never) console.log(`  ${p.category.padEnd(7)} ${p.slug} — ${p.title} (${p.address}) возраст ${p.age_min}–${p.age_max}, ${p.indoor ? "indoor" : ""}${p.outdoor ? " outdoor" : ""}`);
const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
console.log("Чаще всего: " + top.slice(0, 8).map(([s, n]) => `${s} ${n}`).join(", "));
console.log("Реже всего (но были): " + top.slice(-10).map(([s, n]) => `${s} ${n}`).join(", "));
