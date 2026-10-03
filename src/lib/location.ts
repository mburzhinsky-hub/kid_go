import type { GeoPoint, Place, TransportId } from "@/lib/types";
import { DEFAULT_LOCATION, haversineKm, legMode, pt, travelMinutes } from "@/lib/geo";

/**
 * Точка «откуда мы выезжаем». Все экраны считают дорогу от неё,
 * а не от центра города.
 */
export type OriginSource = "gps" | "home" | "area" | "default";

export interface Origin extends GeoPoint {
  label: string;
  source: OriginSource;
  updatedAt?: number;
}

export const DEFAULT_ORIGIN: Origin = { ...DEFAULT_LOCATION, label: "Центр", source: "default" };

/** Районы Москвы — быстрый выбор без GPS (координаты — центр района, примерно). */
export const AREAS: { id: string; label: string; lat: number; lng: number }[] = [
  { id: "center", label: "Центр", lat: 55.752, lng: 37.6175 },
  { id: "khamovniki", label: "Хамовники", lat: 55.733, lng: 37.58 },
  { id: "zamoskvorechye", label: "Замоскворечье", lat: 55.737, lng: 37.629 },
  { id: "sokolniki", label: "Сокольники", lat: 55.789, lng: 37.68 },
  { id: "vdnh", label: "ВДНХ / Останкино", lat: 55.821, lng: 37.641 },
  { id: "otradnoe", label: "Отрадное", lat: 55.864, lng: 37.605 },
  { id: "medvedkovo", label: "Медведково", lat: 55.887, lng: 37.661 },
  { id: "khovrino", label: "Ховрино", lat: 55.869, lng: 37.493 },
  { id: "tushino", label: "Тушино", lat: 55.827, lng: 37.437 },
  { id: "strogino", label: "Строгино", lat: 55.804, lng: 37.403 },
  { id: "krylatskoe", label: "Крылатское", lat: 55.757, lng: 37.408 },
  { id: "kuntsevo", label: "Кунцево", lat: 55.73, lng: 37.446 },
  { id: "ramenki", label: "Раменки", lat: 55.696, lng: 37.5 },
  { id: "teply-stan", label: "Тёплый Стан", lat: 55.619, lng: 37.506 },
  { id: "yasenevo", label: "Ясенево", lat: 55.607, lng: 37.533 },
  { id: "chertanovo", label: "Чертаново", lat: 55.612, lng: 37.602 },
  { id: "butovo", label: "Бутово", lat: 55.545, lng: 37.565 },
  { id: "kolomenskoe", label: "Коломенское", lat: 55.672, lng: 37.665 },
  { id: "maryino", label: "Марьино", lat: 55.65, lng: 37.744 },
  { id: "lyublino", label: "Люблино", lat: 55.676, lng: 37.762 },
  { id: "vykhino", label: "Выхино", lat: 55.716, lng: 37.817 },
  { id: "perovo", label: "Перово", lat: 55.752, lng: 37.787 },
  { id: "izmaylovo", label: "Измайлово", lat: 55.788, lng: 37.78 },
];

/** Ближайший район — подпись для GPS-точки («Рядом: Сокольники»). */
export function nearestAreaLabel(p: GeoPoint): string {
  let best = AREAS[0];
  let bestKm = Infinity;
  for (const a of AREAS) {
    const km = haversineKm(p, a);
    if (km < bestKm) {
      best = a;
      bestKm = km;
    }
  }
  return bestKm < 4 ? best.label : "Рядом со мной";
}

export interface Travel {
  km: number;
  minutes: number;
  mode: TransportId;
}

/**
 * Время в пути (оценка без routing API: прямая × коэффициент улиц + ожидание).
 * Интерфейс совместим с матрицей маршрутов — подменяется без правок экранов.
 */
export function travelBetween(a: GeoPoint, b: GeoPoint, preferred: TransportId = "transit"): Travel {
  const km = haversineKm(a, b);
  const mode = legMode(km, preferred);
  return { km, mode, minutes: travelMinutes(km, mode) };
}

export function travelToPlace(origin: GeoPoint, place: Place, preferred: TransportId = "transit"): Travel {
  return travelBetween(origin, pt(place), preferred);
}

export function formatTravel(t: Travel): string {
  if (t.km < 0.15) return "рядом";
  const word = t.mode === "walk" ? "пешком" : t.mode === "car" ? "на машине" : "в пути";
  return `${t.minutes} мин ${word}`;
}

/** «Готовы ехать до N минут» — варианты для профиля и планировщика. */
export const TRAVEL_LIMITS = [20, 40, 60, 90] as const;
