import type { Plan, PlannerInput } from "@/lib/types";
import { OKRUGS, SETTLEMENTS, okrugById, okrugOrigin, travelBetween, travelToPlace, type Okrug, type Origin } from "@/lib/location";
import { haversineKm } from "@/lib/geo";
import { SCENARIO_LIBRARY, type ScenarioCtx, type ScenarioDef } from "@/lib/scenarios";
import { buildPlannerInput, type BuildArgs } from "./build-input";
import { areaOf, dayContext, generatePlans } from "./engine";

/**
 * «В округе подходящего нет» — что предложить вместо пустого экрана:
 *  1) те же условия, но в ближайшем округе (или городе рядом — для Зеленограда и Новой Москвы);
 *  2) другие ситуации, которые в этом округе реально работают (например, не «развивающее», а «погулять»).
 */

export interface AreaOther {
  key: string;
  label: string;
  /** «в САО» — для кнопки «Искать в …»; у городов области формы нет, там пишем без предлога. */
  prep?: string;
  origin: Origin;
  /** Оценка времени от центра выбранного округа до центра этого. */
  minutes: number;
  plans: Plan[];
}

export interface AreaAlt {
  here: Okrug;
  others: AreaOther[];
  scenarios: { def: ScenarioDef; plans: number }[];
}

/** Сколько округов/городов пробуем и сколько показываем. */
const TRY_OTHERS = 8;
const SHOW_OTHERS = 2;
const SHOW_SCENARIOS = 6;
const MAX_OTHER_MIN = 75;

const OUTER = new Set(["zelao", "nao"]);

export function scenarioCtxOf(input: PlannerInput): ScenarioCtx {
  const d = dayContext(input);
  return {
    weekday: d.weekday,
    hour: Math.floor(d.start / 60),
    month: d.month,
    day: d.day,
    rainAllDay: d.cond.wet === "all",
    rainLater: d.cond.wet === "later",
    snow: d.cond.snow,
    cold: d.cond.cold,
    hot: d.cond.hot,
    sunny: d.cond.sunny,
    warm: d.cond.warm,
    kidsCount: input.children.length,
    youngest: d.youngest,
    oldest: d.oldest,
    interests: input.children.flatMap((k) => k.interests),
  };
}

/** Ссылка-запрос для другой ситуации: сохраняем день и погоду, а условия прошлой ситуации не тянем. */
export const altQuery = (query: BuildArgs["query"], id: string): Record<string, string> => {
  const q: Record<string, string> = { s: id };
  if (query.day) q.day = query.day;
  if (query.weather) q.weather = query.weather;
  return q;
};

export function areaAlternatives(args: BuildArgs, input: PlannerInput): AreaAlt | null {
  const hereId = areaOf(input);
  const here = hereId ? okrugById(hereId) : undefined;
  if (!here) return null;
  const hereOrigin = okrugOrigin(here);

  // 1) тот же запрос, но в других округах — ближайшие первыми
  const cands: { key: string; label: string; prep?: string; origin: Origin }[] = OKRUGS.filter((o) => o.id !== here.id).map((o) => ({ key: o.id, label: o.short, prep: o.prep, origin: okrugOrigin(o) }));
  if (OUTER.has(here.id)) {
    for (const s of SETTLEMENTS) {
      if (haversineKm(here, s) <= 28) cands.push({ key: s.id, label: s.label, origin: { lat: s.lat, lng: s.lng, label: s.label, source: "area" } });
    }
  }
  cands.sort((a, b) => haversineKm(here, a.origin) - haversineKm(here, b.origin));
  const others: AreaOther[] = [];
  let tried = 0;
  const transport = input.transport;
  for (const c of cands) {
    if (others.length >= SHOW_OTHERS || tried >= TRY_OTHERS) break;
    tried++;
    const minutes = Math.round(travelBetween(hereOrigin, c.origin, transport).minutes);
    if (minutes > MAX_OTHER_MIN) continue;
    const r = generatePlans(buildPlannerInput({ ...args, origin: c.origin }), 2);
    if (!r.plans.length) continue;
    // дорога на карточке — от выбранного округа, а не от чужого центра
    const plans = r.plans.map((p) => ({ ...p, fromHome: { ...travelToPlace(hereOrigin, p.stops[0].place, transport), approx: true as const } }));
    others.push({ key: c.key, label: c.label, prep: c.prep, origin: c.origin, minutes, plans });
  }

  // 2) другие ситуации, которые в этом округе работают
  const ctx = scenarioCtxOf(input);
  const currentId = args.query.s;
  const ranked: { def: ScenarioDef; plans: number; r: number }[] = [];
  for (const def of SCENARIO_LIBRARY) {
    if (def.id === currentId) continue;
    const rel = def.relevance(ctx);
    if (rel <= 0) continue;
    const alt = buildPlannerInput({ ...args, query: altQuery(args.query, def.id) });
    const n = generatePlans(alt, 3).plans.length;
    if (n > 0) ranked.push({ def, plans: n, r: rel + n * 1.5 });
  }
  ranked.sort((a, b) => b.r - a.r);
  const perGroup = new Map<string, number>();
  const scenarios: AreaAlt["scenarios"] = [];
  for (const x of ranked) {
    const g = perGroup.get(x.def.group) ?? 0;
    if (g >= 2) continue;
    perGroup.set(x.def.group, g + 1);
    scenarios.push({ def: x.def, plans: x.plans });
    if (scenarios.length >= SHOW_SCENARIOS) break;
  }
  return { here, others, scenarios };
}
