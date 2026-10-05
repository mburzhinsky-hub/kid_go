import type { GeoPoint, Place } from "@/lib/types";
import { haversineKm, pt } from "@/lib/geo";
import { OKRUGS, okrugById, type Okrug, type Origin } from "@/lib/location";

/**
 * География Москвы без внешних сервисов: «в Москве ли место» и «в каком оно округе».
 *
 * Официальные границы — сложные многоугольники, а нам нужна устойчивая оценка:
 *  - внутри «ядра» (сверхэллипс вокруг центра, примерно МКАД) округ определяется по ближайшей из
 *    нескольких опорных точек (районы, а не один центр на округ — иначе Сокольники «уходят» в ЦАО);
 *  - за МКАД Москва — это Зеленоград, Новая Москва, Бутово, Солнцево, Некрасовка: они заданы кругами;
 *  - всё остальное — Подмосковье.
 * У мест из каталога округ можно уточнить вручную (`OKRUG_OVERRIDE`), у остальных — по координатам.
 */

/** Опорные точки округов (центры районов), [lat, lng]. */
const SEEDS: Record<string, [number, number][]> = {
  cao: [
    [55.752, 37.6156], [55.7488, 37.588], [55.725, 37.565], [55.765, 37.56], [55.778, 37.585],
    [55.777, 37.628], [55.78, 37.65], [55.77, 37.67], [55.742, 37.652], [55.733, 37.63], [55.73, 37.605],
  ],
  sao: [
    [55.8, 37.53], [55.79, 37.52], [55.835, 37.5], [55.845, 37.575], [55.87, 37.51], [55.86, 37.565], [55.869, 37.493], [55.84, 37.47],
  ],
  svao: [
    [55.826, 37.637], [55.8, 37.605], [55.83, 37.605], [55.865, 37.605], [55.88, 37.66], [55.85, 37.655], [55.9, 37.575], [55.87, 37.7], [55.84, 37.7], [55.885, 37.62],
  ],
  vao: [
    [55.795, 37.68], [55.815, 37.71], [55.796, 37.716], [55.77, 37.735], [55.787, 37.78], [55.75, 37.79], [55.75, 37.82], [55.733, 37.83], [55.744, 37.866], [55.82, 37.745], [55.775, 37.815],
  ],
  uvao: [
    [55.706, 37.745], [55.72, 37.775], [55.675, 37.762], [55.65, 37.745], [55.69, 37.73], [55.755, 37.7], [55.727, 37.735], [55.71, 37.82], [55.683, 37.855], [55.7, 37.91], [55.63, 37.8],
  ],
  uao: [
    [55.705, 37.615], [55.64, 37.605], [55.62, 37.602], [55.595, 37.605], [55.68, 37.67], [55.667, 37.67], [55.61, 37.68], [55.61, 37.705], [55.635, 37.765], [55.58, 37.66], [55.62, 37.745], [55.65, 37.655],
  ],
  uzao: [
    [55.7, 37.58], [55.685, 37.57], [55.67, 37.59], [55.68, 37.54], [55.66, 37.55], [55.67, 37.565], [55.66, 37.575], [55.635, 37.52], [55.62, 37.505], [55.605, 37.535], [55.565, 37.545], [55.545, 37.57],
  ],
  zao: [
    [55.745, 37.55], [55.735, 37.47], [55.74, 37.485], [55.757, 37.408], [55.73, 37.44], [55.71, 37.44], [55.695, 37.5], [55.677, 37.505], [55.65, 37.47], [55.685, 37.46], [55.635, 37.385], [55.645, 37.395], [55.605, 37.285], [55.71, 37.553],
  ],
  szao: [
    [55.8, 37.485], [55.805, 37.465], [55.83, 37.43], [55.852, 37.425], [55.77, 37.5], [55.804, 37.403], [55.845, 37.36], [55.89, 37.38],
  ],
};

/** За МКАД, но в Москве: [округ, lat, lng, радиус км]. */
const ZONES: [string, number, number, number][] = [
  ["zelao", 55.985, 37.2, 7.5],
  ["uzao", 55.55, 37.57, 6.5],
  ["nao", 55.505, 37.565, 7],
  ["nao", 55.565, 37.485, 7],
  ["nao", 55.605, 37.36, 6.5],
  ["nao", 55.478, 37.3, 14],
  ["nao", 55.52, 37.42, 8],
  ["zao", 55.605, 37.28, 4],
  ["zao", 55.645, 37.395, 4.5],
  ["uvao", 55.705, 37.905, 5],
];

/** Ядро Москвы (≈ МКАД): центр и полуоси, км, показатель сверхэллипса. */
const CORE = { lat: 55.745, lng: 37.62, ns: 18.2, ew: 16.0, p: 2.4 };

const KM_LAT = 111.2;
const kmLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

function inCore(p: GeoPoint): boolean {
  const dy = Math.abs(p.lat - CORE.lat) * KM_LAT;
  const dx = Math.abs(p.lng - CORE.lng) * kmLng(p.lat);
  return (dy / CORE.ns) ** CORE.p + (dx / CORE.ew) ** CORE.p <= 1;
}

/** Округ по координатам или null — это уже не Москва. */
export function okrugAtPoint(p: GeoPoint): string | null {
  if (!inCore(p)) {
    for (const [id, lat, lng, r] of ZONES) if (haversineKm(p, { lat, lng }) <= r) return id;
    return null;
  }
  let best = "cao";
  let bestKm = Infinity;
  const kx = kmLng(p.lat);
  for (const [id, seeds] of Object.entries(SEEDS)) {
    for (const [lat, lng] of seeds) {
      const dx = (p.lng - lng) * kx;
      const dy = (p.lat - lat) * KM_LAT;
      const d = dx * dx + dy * dy;
      if (d < bestKm) {
        bestKm = d;
        best = id;
      }
    }
  }
  return best;
}

/** Уточнения для мест каталога, где ближайшая опорная точка ошибается (по slug → округ). */
export const OKRUG_OVERRIDE: Record<string, string> = {
  "joki-joya": "cao", // Пресненская наб., Афимолл
  "panorama360-federation": "cao", // Пресненская наб., Москва-Сити
  "park-luzhniki": "cao", // Хамовники
  "neskuchny-sad": "cao", // Якиманка / Нескучный сад
  kuskovo: "vao", // район Вешняки
  "poni-klub-podkova": "uzao", // Битцевский лес
  "muzey-zhd-tehniki": "svao", // Рижский вокзал — Алексеевский район
  "serebryany-bor": "szao", // Хорошёво-Мнёвники
  "mitinsky-park": "szao", // Митино — за МКАД, но в Москве
};

const cache = new Map<string, string | null>();

/** Округ места: null — Подмосковье или другой регион. */
export function okrugOf(p: Pick<Place, "id" | "slug" | "latitude" | "longitude" | "region">): string | null {
  const hit = cache.get(p.id);
  if (hit !== undefined) return hit;
  let v: string | null;
  const forced = OKRUG_OVERRIDE[p.slug];
  if (forced) v = forced;
  else if (p.region === "mo") v = null;
  else {
    v = okrugAtPoint(pt(p));
    // в каталоге «msk» — это точно Москва: если координаты выпали из моделей, берём ближайший округ
    if (!v && p.region === "msk") v = nearestOkrug(pt(p)).id;
  }
  cache.set(p.id, v);
  return v;
}

export const inMoscow = (p: Pick<Place, "id" | "slug" | "latitude" | "longitude" | "region">) => okrugOf(p) !== null;

export function nearestOkrug(p: GeoPoint): Okrug {
  let best = OKRUGS[0];
  let bestKm = Infinity;
  for (const o of OKRUGS) {
    const km = haversineKm(p, o);
    if (km < bestKm) {
      bestKm = km;
      best = o;
    }
  }
  return best;
}

/** Если точка выезда — выбранный округ, вернёт его (иначе точка — город области, адрес, GPS). */
export function okrugOfOrigin(o?: Pick<Origin, "source" | "label" | "lat" | "lng">): Okrug | undefined {
  if (!o || o.source !== "area") return undefined;
  // по названию, а не по координатам: сохранённая раньше точка округа могла быть чуть другой, но это всё тот же округ
  return OKRUGS.find((k) => k.short === o.label);
}

/** Соседние округа: «рядом» — можно зайти за кафе или на соседнюю улицу, но не за основным занятием. */
export const ADJACENT: Record<string, string[]> = {
  cao: ["sao", "svao", "vao", "uvao", "uao", "uzao", "zao", "szao"],
  sao: ["cao", "svao", "szao", "zao"],
  svao: ["sao", "cao", "vao"],
  vao: ["svao", "cao", "uvao"],
  uvao: ["vao", "cao", "uao"],
  uao: ["uvao", "cao", "uzao"],
  uzao: ["uao", "cao", "zao", "nao"],
  zao: ["uzao", "cao", "szao", "sao", "nao"],
  szao: ["zao", "sao", "cao", "zelao"],
  zelao: ["szao", "sao"],
  nao: ["uzao", "zao", "uao"],
};

/** Зеленоград и Новая Москва окружены Подмосковьем: ближайшие города области считаем «соседями». */
const OUTER = new Set(["zelao", "nao"]);
const OUTER_NEAR_KM = 14;

/** То же для уже известного округа места (null — не Москва). Для Зеленограда и Новой Москвы Подмосковье «рядом» тут не считается. */
export function tierOfArea(area: string | null | undefined, okrugId: string): Tier {
  if (area === okrugId) return 0;
  if (area && ADJACENT[okrugId]?.includes(area)) return 1;
  return 2;
}

/** 0 — место в самом округе, 1 — в соседнем (или рядом, для Зеленограда и Новой Москвы), 2 — дальше. */
export type Tier = 0 | 1 | 2;

export function tierOf(p: Pick<Place, "id" | "slug" | "latitude" | "longitude" | "region">, okrugId: string): Tier {
  const o = okrugOf(p);
  if (o === okrugId) return 0;
  if (o && ADJACENT[okrugId]?.includes(o)) return 1;
  if (!o && OUTER.has(okrugId)) {
    const c = okrugById(okrugId);
    if (c && haversineKm(pt(p), c) <= OUTER_NEAR_KM) return 1;
  }
  return 2;
}
