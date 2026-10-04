import type { GeoPoint, Place, TransportId } from "@/lib/types";
import { DEFAULT_LOCATION, haversineKm, legMode, pt, travelMinutes } from "@/lib/geo";

/**
 * Точка «откуда мы выезжаем». Все экраны считают дорогу от неё,
 * а не от центра города.
 */
export type OriginSource = "gps" | "home" | "area" | "custom" | "default";

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

/** Подмосковье и ближайшие города: быстрый выбор без интернета (центры городов, ±1–2 км). */
export interface Settlement {
  id: string;
  label: string;
  sub?: string;
  lat: number;
  lng: number;
  /** Дополнительные названия для поиска (посёлки, шоссе). */
  aliases?: string[];
}
export const SETTLEMENTS: Settlement[] = [
  { id: "krasnogorsk", label: "Красногорск", sub: "Московская область", lat: 55.8317, lng: 37.3295, aliases: ["павшино", "опалиха", "путилково"] },
  { id: "nakhabino", label: "Нахабино", sub: "Красногорск", lat: 55.842, lng: 37.183 },
  { id: "dedovsk", label: "Дедовск", sub: "Истра", lat: 55.8656, lng: 37.1239 },
  { id: "istra", label: "Истра", sub: "Московская область", lat: 55.9136, lng: 36.8603 },
  { id: "odintsovo", label: "Одинцово", sub: "Московская область", lat: 55.678, lng: 37.264, aliases: ["рублёвка", "рублевка", "барвиха", "жуковка"] },
  { id: "zvenigorod", label: "Звенигород", sub: "Одинцовский округ", lat: 55.7305, lng: 36.858 },
  { id: "golitsyno", label: "Голицыно", sub: "Одинцовский округ", lat: 55.62, lng: 36.989 },
  { id: "kubinka", label: "Кубинка", sub: "Одинцовский округ", lat: 55.58, lng: 36.7 },
  { id: "khimki", label: "Химки", sub: "Московская область", lat: 55.897, lng: 37.4297, aliases: ["сходня"] },
  { id: "lobnya", label: "Лобня", sub: "Московская область", lat: 56.013, lng: 37.472 },
  { id: "dolgoprudny", label: "Долгопрудный", sub: "Московская область", lat: 55.939, lng: 37.505 },
  { id: "solnechnogorsk", label: "Солнечногорск", sub: "Московская область", lat: 56.184, lng: 36.978 },
  { id: "zelenograd", label: "Зеленоград", sub: "Москва", lat: 55.9825, lng: 37.1814 },
  { id: "mytishchi", label: "Мытищи", sub: "Московская область", lat: 55.9105, lng: 37.7364 },
  { id: "korolev", label: "Королёв", sub: "Московская область", lat: 55.9142, lng: 37.8254, aliases: ["королев", "юбилейный"] },
  { id: "pushkino", label: "Пушкино", sub: "Московская область", lat: 56.0103, lng: 37.847 },
  { id: "ivanteevka", label: "Ивантеевка", sub: "Московская область", lat: 55.972, lng: 37.92 },
  { id: "shchelkovo", label: "Щёлково", sub: "Московская область", lat: 55.921, lng: 37.991, aliases: ["щелково", "фрязино"] },
  { id: "balashikha", label: "Балашиха", sub: "Московская область", lat: 55.796, lng: 37.938 },
  { id: "reutov", label: "Реутов", sub: "Московская область", lat: 55.76, lng: 37.858 },
  { id: "lyubertsy", label: "Люберцы", sub: "Московская область", lat: 55.6772, lng: 37.8932 },
  { id: "kotelniki", label: "Котельники", sub: "Московская область", lat: 55.6597, lng: 37.863 },
  { id: "dzerzhinsky", label: "Дзержинский", sub: "Московская область", lat: 55.63, lng: 37.85, aliases: ["лыткарино"] },
  { id: "vidnoe", label: "Видное", sub: "Московская область", lat: 55.5516, lng: 37.7075 },
  { id: "domodedovo", label: "Домодедово", sub: "Московская область", lat: 55.4363, lng: 37.766 },
  { id: "podolsk", label: "Подольск", sub: "Московская область", lat: 55.4311, lng: 37.545 },
  { id: "shcherbinka", label: "Щербинка", sub: "Москва", lat: 55.5, lng: 37.568 },
  { id: "troitsk", label: "Троицк", sub: "Москва", lat: 55.48, lng: 37.3 },
  { id: "moskovsky", label: "Московский", sub: "Москва · Новая Москва", lat: 55.6, lng: 37.355, aliases: ["внуково", "румянцево"] },
  { id: "aprelevka", label: "Апрелевка", sub: "Москва · Новая Москва", lat: 55.547, lng: 37.068 },
  { id: "ramenskoe", label: "Раменское", sub: "Московская область", lat: 55.567, lng: 38.231 },
  { id: "zhukovsky", label: "Жуковский", sub: "Московская область", lat: 55.595, lng: 38.117 },
  { id: "zheleznodorozhny", label: "Железнодорожный", sub: "Балашиха", lat: 55.749, lng: 38.009 },
  { id: "noginsk", label: "Ногинск", sub: "Московская область", lat: 55.854, lng: 38.441, aliases: ["электросталь"] },
  { id: "sergiev-posad", label: "Сергиев Посад", sub: "Московская область", lat: 56.31, lng: 38.13 },
  { id: "dmitrov", label: "Дмитров", sub: "Московская область", lat: 56.344, lng: 37.52 },
  { id: "chekhov", label: "Чехов", sub: "Московская область", lat: 55.143, lng: 37.46 },
  { id: "kolomna", label: "Коломна", sub: "Московская область", lat: 55.079, lng: 38.778 },
];

const norm = (t: string) => t.toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").trim();

/** Мгновенный поиск по городам/посёлкам (без сети). */
export function searchSettlements(q: string, limit = 6): Settlement[] {
  const n = norm(q).replace(/^(кп|снт|днт|пос[её]лок|деревня|д\.|г\.|город)\s+/, "");
  if (n.length < 2) return [];
  const score = (s: Settlement) => {
    const names = [s.label, ...(s.aliases ?? [])].map(norm);
    if (names.some((x) => x === n)) return 3;
    if (names.some((x) => x.startsWith(n))) return 2;
    if (names.some((x) => x.includes(n)) || norm(s.sub ?? "").includes(n)) return 1;
    return 0;
  };
  return SETTLEMENTS.map((s) => ({ s, v: score(s) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, limit)
    .map((x) => x.s);
}

export interface GeoHit {
  label: string;
  sub?: string;
  lat: number;
  lng: number;
}

/** Рамка поиска: Москва и область (lon_min, lat_max, lon_max, lat_min). */
const REGION_BOX = { w: 35.1, n: 56.9, e: 40.3, s: 54.6 };
const inRegion = (lat: number, lng: number) => lat >= REGION_BOX.s && lat <= REGION_BOX.n && lng >= REGION_BOX.w && lng <= REGION_BOX.e;

/** Онлайн-геокодер (Nominatim → Photon) для адресов и коттеджных посёлков. Ошибки сети → []. */
export async function geocode(q: string, signal?: AbortSignal): Promise<GeoHit[]> {
  const text = q.trim();
  if (text.length < 3) return [];
  try {
    const params = new URLSearchParams({
      q: /москв|област/i.test(text) ? text : `${text}, Московская область`,
      format: "jsonv2",
      limit: "6",
      "accept-language": "ru",
      countrycodes: "ru",
      viewbox: `${REGION_BOX.w},${REGION_BOX.n},${REGION_BOX.e},${REGION_BOX.s}`,
      bounded: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
    if (res.ok) {
      const rows = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
      const hits = rows
        .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.name || r.display_name.split(",")[0], sub: r.display_name.split(",").slice(1, 3).join(",").trim() }))
        .filter((h) => Number.isFinite(h.lat) && inRegion(h.lat, h.lng));
      if (hits.length) return hits;
    }
  } catch {
    if (signal?.aborted) return [];
  }
  try {
    const params = new URLSearchParams({ q: text, limit: "6", lat: "55.75", lon: "37.6", bbox: `${REGION_BOX.w},${REGION_BOX.s},${REGION_BOX.e},${REGION_BOX.n}` });
    const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; state?: string; district?: string; street?: string } }[] };
    return data.features
      .map((f) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        label: f.properties.name || f.properties.street || "Точка",
        sub: [f.properties.district, f.properties.city, f.properties.state].filter(Boolean).join(", "),
      }))
      .filter((h) => inRegion(h.lat, h.lng));
  } catch {
    return [];
  }
}

/** Ближайший район Москвы или город области — подпись для GPS-точки и точки на карте. */
export function nearestAreaLabel(p: GeoPoint): string {
  let best: { label: string; km: number } = { label: "", km: Infinity };
  for (const a of AREAS) {
    const km = haversineKm(p, a);
    if (km < best.km) best = { label: a.label, km };
  }
  if (best.km < 4) return best.label;
  let near: { label: string; km: number } = { label: "", km: Infinity };
  for (const s of SETTLEMENTS) {
    const km = haversineKm(p, s);
    if (km < near.km) near = { label: s.label, km };
  }
  const c = near.km < best.km ? near : best;
  return c.km < (c === near ? 15 : 12) ? `Рядом: ${c.label}` : "Точка на карте";
}

/** Центр Москвы и «за МКАД» — для транспорта и ожиданий по умолчанию. */
export const CITY_CENTER: GeoPoint = { lat: 55.7558, lng: 37.6173 };
export const distToCenterKm = (p: GeoPoint) => haversineKm(p, CITY_CENTER);
/** Дальше ~24 км от центра — уже за МКАД: ездят на машине, до города далеко. */
export const isSuburban = (p: GeoPoint) => distToCenterKm(p) > 24;
export const suggestedTransport = (p: GeoPoint): TransportId => (isSuburban(p) ? "car" : "transit");

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
