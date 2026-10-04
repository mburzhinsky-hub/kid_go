import type { BudgetId, Child, DurationId, MoodId, Place, PlannerInput, ScenarioConstraints, TransportId } from "@/lib/types";
import type { Forecast } from "@/lib/forecast";
import { daySummary, moscowDateISO } from "@/lib/forecast";
import { locationMode, type Origin } from "@/lib/location";
import { BUDGETS, DURATIONS, MOODS, TRANSPORTS } from "@/lib/catalog";
import { scenarioById } from "@/lib/scenarios";

/**
 * Ссылка «Подобрать день» → параметры движка. Вынесено из экрана результатов, чтобы правила
 * (сценарий + фильтры + место поиска) проверялись тем же кодом, что и работает в приложении.
 */
export type ResultsQuery = Record<string, string | undefined>;

export interface BuildArgs {
  query: ResultsQuery;
  kids: Pick<Child, "name" | "age" | "interests">[];
  origin: Origin;
  prefs: { budget: BudgetId; transport: TransportId; maxTravelMin: number };
  forecast: Forecast;
  extraPlaces?: Place[];
  family?: PlannerInput["family"];
  now?: Date;
}

const pick = <T extends string>(list: readonly { id: T }[], v: string | undefined): T | undefined => list.find((x) => x.id === v)?.id;
const int = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/** Дорога «до N минут» из ссылки: только разумные значения. */
const TRAVEL_MIN = 10;
const TRAVEL_MAX = 150;

export function buildPlannerInput(a: BuildArgs): PlannerInput {
  const { query, kids, origin, prefs, forecast } = a;
  const now = a.now ?? new Date();
  const scenario = scenarioById(query.s);
  const mode = locationMode(origin);
  const dayOffset = int(query.day, 0, 6, 0);
  const dateISO = moscowDateISO(dayOffset, now);

  const constraints: ScenarioConstraints = { ...(scenario?.constraints ?? {}) };
  if (query.weather === "rain") constraints.indoorOnly = true;
  if (query.weather === "sun") constraints.outdoorPreferred = true;

  // «до N минут в пути» осмысленно, только когда известно, откуда едем: в режиме «вся Москва» дорога не ограничивается
  if (mode === "any") delete constraints.maxTravelMin;
  else {
    const fromLink = query.travel ? int(query.travel, TRAVEL_MIN, TRAVEL_MAX, 0) || undefined : undefined;
    const limit = fromLink ?? Math.min(constraints.maxTravelMin ?? 999, Math.max(prefs.maxTravelMin, 20));
    if (limit < 999) constraints.maxTravelMin = limit;
    else delete constraints.maxTravelMin;
  }

  const ages = kids.map((k) => k.age).join(".");
  return {
    children: kids,
    duration: (pick(DURATIONS, query.duration) ?? scenario?.duration ?? "mid") as DurationId,
    mood: (pick(MOODS, query.mood) ?? scenario?.mood ?? "surprise") as MoodId,
    budget: (pick(BUDGETS, query.budget) ?? scenario?.budget ?? prefs.budget) as BudgetId,
    transport: (pick(TRANSPORTS, query.transport) ?? prefs.transport) as TransportId,
    location: origin,
    locationMode: mode,
    extraPlaces: a.extraPlaces?.length ? a.extraPlaces : undefined,
    weather: daySummary(forecast, dateISO).weather,
    forecast,
    dayOffset,
    now,
    foodAfter: query.food === "1" || !!scenario?.food,
    maxDistanceKm: query.near === "1" && mode !== "any" ? 5 : undefined,
    family: a.family,
    constraints,
    seed: `${dateISO}:${ages}`,
  };
}
