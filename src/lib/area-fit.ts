import type { Place } from "@/lib/types";
import { ADJACENT, okrugOf, tierOf, tierOfArea, type Tier } from "@/lib/moscow";
import { okrugById, type Okrug } from "@/lib/location";

/**
 * Единое правило «выбран округ» для всех экранов, где показываются места или маршруты
 * (главная, поиск, карта, приключения, замена шага): основное — в самом округе, потом соседние, дальние — только если больше нечего.
 * Подбор дня (engine.ts) использует те же `tierOf`/`okrugOf`, поэтому экраны не расходятся.
 */

/** Категории «основного занятия»: по ним и считаем, где проходит день (кафе и магазины — по пути). */
export const ANCHOR_CATEGORIES = ["park", "play", "museum", "active", "animals"] as const;
const isAnchorCat = (c: string) => (ANCHOR_CATEGORIES as readonly string[]).includes(c);

/** Округа основных мест маршрута: id округа или "mo" для Подмосковья. Без дубликатов. */
export function areasOfPlaces(places: Pick<Place, "id" | "slug" | "latitude" | "longitude" | "region" | "category">[]): string[] {
  const anchors = places.filter((p) => isAnchorCat(p.category));
  return [...new Set((anchors.length ? anchors : places).map((p) => okrugOf(p) ?? "mo"))];
}

/** 0 — весь маршрут в округе, 1 — в нём и в соседних, 2 — есть что-то дальше. */
export function fitOfAreas(areas: string[] | undefined, okrugId: string): Tier {
  if (!areas?.length) return 2;
  let worst: Tier = 0;
  for (const a of areas) {
    const t = a === "mo" ? 2 : tierOfArea(a, okrugId);
    if (t > worst) worst = t;
  }
  return worst;
}

/** Подпись «где это» для маршрута относительно выбранного округа (null — подписывать нечего). */
export function areaNote(areas: string[] | undefined, okrugId: string): { text: string; tone: "here" | "near" | "far" } | null {
  if (!areas?.length) return null;
  const here = okrugById(okrugId)?.short ?? "округе";
  const fit = fitOfAreas(areas, okrugId);
  if (fit === 0) return { text: `📍 Всё в ${here}`, tone: "here" };
  const names = areas.map((a) => (a === "mo" ? "Подмосковье" : okrugById(a)?.short ?? a));
  if (fit === 1) return { text: `📍 ${names.join(" + ")} — рядом с ${here}`, tone: "near" };
  return { text: `📍 ${names.join(" + ")} — не в ${here}`, tone: "far" };
}

/**
 * Порядок мест для подборок («Популярное рядом», карта): сначала лучшие из самого округа, затем из соседних (если своих мало);
 * места из других концов города — только когда в округе и рядом почти ничего нет. `inArea` — хватило ли своих мест.
 */
export function orderByArea<T>(
  items: T[],
  placeOf: (t: T) => Place,
  okrug: Okrug | undefined,
  quality: (t: T) => number,
  opts: { enough?: number; fallback?: (a: T, b: T) => number } = {}
): { list: T[]; inArea: boolean } {
  if (!okrug) return { list: [...items].sort((a, b) => quality(b) - quality(a)), inArea: false };
  const enough = opts.enough ?? 4;
  const tiers: T[][] = [[], [], []];
  for (const it of items) tiers[tierOf(placeOf(it), okrug.id)].push(it);
  const byQ = (a: T, b: T) => quality(b) - quality(a);
  const own = tiers[0].sort(byQ);
  const adj = tiers[1].sort(byQ);
  const far = tiers[2].sort(opts.fallback ?? byQ);
  if (own.length >= enough) return { list: [...own, ...adj], inArea: true };
  // своих мало: свои, затем соседние; дальние добавляем, только если вместе всё равно меньше трёх
  const list = [...own, ...adj];
  return { list: list.length >= 3 ? list : [...list, ...far], inArea: own.length > 0 };
}

export { ADJACENT };
