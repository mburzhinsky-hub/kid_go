import type { CategoryId, Child, Place, PlanStop, TransportId } from "@/lib/types";
import { places as ALL } from "@/lib/data/places";
import { pt } from "@/lib/geo";
import { isOpenDuring, toMinutes } from "@/lib/format";
import { travelBetween, isSuburban } from "@/lib/location";
import { inMoscow, okrugOf, tierOf } from "@/lib/moscow";
import { outdoorVerdict, windowWx, type Forecast } from "@/lib/forecast";

/** Роль шага в дне: заменяем «как на как» — занятие на занятие, кафе на кафе. */
const ROLE: Record<CategoryId, "activity" | "food" | "extra"> = {
  park: "activity",
  play: "activity",
  museum: "activity",
  active: "activity",
  animals: "activity",
  cafe: "food",
  shop: "extra",
};

export interface Alternative {
  place: Place;
  minutesFromPrev?: number;
  reason: string;
}

/**
 * Варианты замены шага: та же роль, рядом с соседними шагами, открыто в это время,
 * подходит детям и погоде в это окно.
 */
export function alternativesFor(
  stops: PlanStop[],
  index: number,
  opts: {
    kids: Pick<Child, "age" | "interests">[];
    transport: TransportId;
    weekday: number;
    forecast?: Forecast;
    dateISO?: string;
    indoorOnly?: boolean;
    /** Округ, выбранный как «где ищем»: замена не должна увозить из него. */
    area?: string;
  }
): Alternative[] {
  const stop = stops[index];
  const prev = stops[index - 1]?.place;
  const next = stops[index + 1]?.place;
  const role = ROLE[stop.place.category];
  const at = toMinutes(stop.start);
  const used = new Set(stops.map((s) => s.place.id));
  const ages = opts.kids.map((k) => k.age);
  const youngest = ages.length ? Math.min(...ages) : 5;
  const interests = new Set(opts.kids.flatMap((k) => k.interests));
  // Где «держим» день: в выбранном округе (если шаг в нём или рядом), иначе — в округе самого шага.
  // Занятие меняем на занятие из того же округа, кафе и магазин — из него или соседнего. Подмосковье остаётся Подмосковьем.
  const stopArea = okrugOf(stop.place);
  const home = opts.area && (stopArea === opts.area || (stopArea && tierOf(stop.place, opts.area) <= (role === "activity" ? 0 : 1))) ? opts.area : stopArea;
  const inScope = (p: Place) => {
    if (!home) return !inMoscow(p) || isSuburban(pt(p)) === isSuburban(pt(stop.place)); // шаг за МКАД — замена тоже за городом
    const t = tierOf(p, home);
    return role === "activity" ? t === 0 : t <= 1;
  };
  return ALL.filter((p) => !used.has(p.id) && ROLE[p.category] === role && inScope(p))
    .filter((p) => ages.every((a) => a >= p.age_min && a <= p.age_max))
    .filter((p) => isOpenDuring(p.opening_hours, opts.weekday, at, stop.duration))
    .filter((p) => !opts.indoorOnly || p.indoor)
    .filter((p) => {
      if (!opts.forecast || !opts.dateISO || p.indoor) return true;
      return outdoorVerdict(windowWx(opts.forecast, opts.dateISO, at, at + stop.duration), youngest).ok;
    })
    .map((p) => {
      const fromPrev = prev ? travelBetween(pt(prev), pt(p), opts.transport).minutes : undefined;
      const toNext = next ? travelBetween(pt(p), pt(next), opts.transport).minutes : 0;
      const near = (fromPrev ?? travelBetween(pt(stop.place), pt(p), opts.transport).minutes) + toNext;
      const hit = p.interest_tags.some((t) => interests.has(t));
      const score = p.rating * 2 + (hit ? 2 : 0) + (p.indoor && !stop.place.indoor ? 0.5 : 0) - near / 8;
      const reason = hit ? "по интересам" : p.indoor && !stop.place.indoor ? "под крышей" : near <= 15 ? "совсем рядом" : `★ ${p.rating.toFixed(1)}`;
      return { place: p, minutesFromPrev: fromPrev, reason, score, near };
    })
    .filter((x) => x.near <= (home ? 60 : 45))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ place, minutesFromPrev, reason }) => ({ place, minutesFromPrev, reason }));
}
