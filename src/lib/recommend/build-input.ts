import type { BudgetId, Child, DurationId, GeoScope, MoodId, Place, PlannerInput, ScenarioConstraints, TransportId } from "@/lib/types";
import type { Forecast } from "@/lib/forecast";
import { daySummary, moscowDateISO } from "@/lib/forecast";
import { DEFAULT_ORIGIN, isSuburban, locationMode, type LocMode, type Origin } from "@/lib/location";
import { places as STATIC_PLACES } from "@/lib/data/places";
import { BUDGETS, DURATIONS, MOODS, TRANSPORTS } from "@/lib/catalog";
import { scenarioById } from "@/lib/scenarios";
import { isOutside, softenOnly } from "@/lib/recommend/engine";

/**
 * Ссылка «Подобрать день» → параметры движка. Вынесено из экрана результатов, чтобы правила
 * (сценарий + фильтры + место поиска) проверялись тем же кодом, что и работает в приложении.
 */
export type ResultsQuery = Record<string, string | undefined>;

export interface BuildArgs {
  query: ResultsQuery;
  kids: Pick<Child, "name" | "age" | "interests">[];
  origin: Origin;
  prefs: { budget: BudgetId; transport: TransportId; maxTravelMin: number; geoScope?: GeoScope };
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

/** Если длину дня не выбрали: вокруг городского места — «3–4 часа», вокруг места за городом — столько, сколько стоит дорога. */
export function anchorDuration(p: Place): DurationId {
  if (!isOutside(p)) return "mid";
  const km = Math.hypot((p.latitude - DEFAULT_ORIGIN.lat) * 111, (p.longitude - DEFAULT_ORIGIN.lng) * 63);
  return km <= 32 ? "mid" : km <= 55 ? "half" : "day";
}

export function buildPlannerInput(a: BuildArgs): PlannerInput {
  const { query, kids, origin, prefs, forecast } = a;
  const now = a.now ?? new Date();
  const scenario = scenarioById(query.s);
  // «Собрать день вокруг этого места»: место задано, остальное подбираем рядом
  const anchor = query.anchor ? STATIC_PLACES.find((p) => p.slug === query.anchor) : undefined;
  const tripScenario = !!scenario?.constraints?.regionOnly;
  const tripAnchor = !!anchor && isOutside(anchor);
  // Поездка за город считается от центра Москвы (если человек не живёт за городом: тогда — от его точки).
  const originMode = locationMode(origin);
  const fromCenter = (tripScenario || tripAnchor) && !(originMode !== "any" && isSuburban(origin));
  const mode: LocMode = fromCenter || (anchor && originMode === "area") ? "any" : originMode;
  const loc: Origin = mode === "any" && originMode !== "any" ? DEFAULT_ORIGIN : origin;
  const geoScope: GeoScope | undefined = mode === "any" ? (tripScenario || tripAnchor ? "moscow-region" : (prefs.geoScope ?? "moscow")) : undefined;
  const dayOffset = int(query.day, 0, 6, 0);
  const dateISO = moscowDateISO(dayOffset, now);

  const loose = query.loose === "1" || query.loose === "true";
  const constraints: ScenarioConstraints = loose ? softenOnly(scenario?.constraints) : { ...(scenario?.constraints ?? {}) };
  if (query.weather === "rain") constraints.indoorOnly = true;
  if (query.weather === "sun") constraints.outdoorPreferred = true;

  // «до N минут в пути» осмысленно, только когда известно, откуда едем: в режиме «вся Москва» дорога в городе не ограничивается,
  // а вот выезд за город — да (из ссылки или из сценария «недалеко»)
  if (mode === "any") {
    const fromLink = query.travel && geoScope === "moscow-region" ? int(query.travel, TRAVEL_MIN, TRAVEL_MAX, 0) || undefined : undefined;
    if (fromLink) constraints.maxTravelMin = fromLink;
    else if (geoScope !== "moscow-region" || tripScenario) delete constraints.maxTravelMin;
  } else {
    const fromLink = query.travel ? int(query.travel, TRAVEL_MIN, TRAVEL_MAX, 0) || undefined : undefined;
    const limit = fromLink ?? Math.min(constraints.maxTravelMin ?? 999, Math.max(prefs.maxTravelMin, 20));
    if (limit < 999) constraints.maxTravelMin = limit;
    else delete constraints.maxTravelMin;
  }

  const ages = kids.map((k) => k.age).join(".");
  return {
    children: kids,
    duration: (pick(DURATIONS, query.duration) ?? scenario?.duration ?? (anchor ? anchorDuration(anchor) : "mid")) as DurationId,
    mood: (pick(MOODS, query.mood) ?? scenario?.mood ?? "surprise") as MoodId,
    budget: (pick(BUDGETS, query.budget) ?? scenario?.budget ?? prefs.budget) as BudgetId,
    transport: (pick(TRANSPORTS, query.transport) ?? prefs.transport) as TransportId,
    location: loc,
    locationMode: mode,
    geoScope,
    anchorSlug: anchor?.slug,
    extraPlaces: a.extraPlaces?.length ? a.extraPlaces : undefined,
    weather: daySummary(forecast, dateISO).weather,
    forecast,
    dayOffset,
    now,
    foodAfter: query.food === "1" || !!scenario?.food,
    maxDistanceKm: query.near === "1" && mode !== "any" ? 5 : undefined,
    // округ: по умолчанию только он; «и соседние» — по явной просьбе в ссылке
    areaScope: query.wide === "1" || query.wide === "true" ? "wide" : "strict",
    looseFit: loose ? true : undefined,
    family: a.family,
    constraints,
    seed: `${dateISO}:${ages}`,
  };
}
