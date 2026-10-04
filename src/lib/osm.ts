import type { CategoryId, ExperienceTag, GeoPoint, InterestId, OpeningHours, Place, SeasonTag, WeatherTag } from "@/lib/types";
import { haversineKm } from "@/lib/geo";
import { photosFor } from "@/lib/data/photos";

/**
 * Места рядом из открытых данных OpenStreetMap (Overpass API).
 *
 * Зачем: наш редакторский каталог плотный в Москве и редкий за МКАД и на окраинах. Чтобы из любого
 * посёлка было что предложить, подтягиваем парки, площадки, музеи, зоопарки, катки, аквапарки и кафе
 * вокруг точки выезда. Это «второй сорт» данных: режим и цены не подтверждены, поэтому такие места
 * помечены `confidence: "osm"`, получают нейтральный рейтинг и честную подпись в интерфейсе.
 * Все преобразования — детерминированные правила (никакого LLM).
 */

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Зеркала Overpass: в РФ надёжнее всего отвечает зеркало Mail.ru, остальные — запасные. */
const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const KEEP_TAGS = ["name", "leisure", "tourism", "amenity", "shop", "opening_hours", "indoor", "fee", "access", "addr:street", "addr:housenumber", "addr:city", "cuisine", "museum", "sport", "operator", "website"];

export function overpassQuery(p: GeoPoint, radiusKm: number): string {
  const R = Math.round(radiusKm * 1000);
  const near = Math.round(Math.min(radiusKm, 7) * 1000);
  const yard = Math.round(Math.min(radiusKm, 4) * 1000);
  const at = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  // три отдельных выборки со своими лимитами: иначе в городе кафе и площадки вытеснят музеи и зоопарки
  return `[out:json][timeout:25];
(
nwr["leisure"~"^(park|garden|water_park|ice_rink|miniature_golf|trampoline_park|amusement_arcade)$"]["name"](around:${R},${at});
nwr["tourism"~"^(zoo|aquarium|theme_park|museum)$"]["name"](around:${R},${at});
nwr["amenity"~"^(theatre|planetarium|library)$"]["name"](around:${R},${at});
)->.a;
.a out tags center qt 320;
(
nwr["leisure"="playground"]["access"!~"private|no|customers"](around:${yard},${at});
)->.b;
.b out tags center qt 220;
(
nwr["shop"~"^(toys|books)$"]["name"](around:${near},${at});
nwr["amenity"~"^(cafe|ice_cream|fast_food|restaurant)$"]["name"](around:${near},${at});
)->.c;
.c out tags center qt 220;`;
}

async function post(url: string, body: string, signal: AbortSignal): Promise<OsmElement[]> {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: body }), signal });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as { elements?: OsmElement[] };
  if (!json.elements) throw new Error("overpass: no elements");
  return json.elements;
}

/** Параллельный запрос ко всем зеркалам: берём первый ответивший. */
export async function fetchOverpass(p: GeoPoint, radiusKm: number, outer?: AbortSignal): Promise<OsmElement[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
  outer?.addEventListener("abort", () => ctrl.abort());
  try {
    const q = overpassQuery(p, radiusKm);
    const els = await Promise.any(ENDPOINTS.map((u) => post(u, q, ctrl.signal)));
    ctrl.abort(); // остальные запросы больше не нужны
    const uniq = new Map<string, OsmElement>();
    for (const e of els) uniq.set(`${e.type}${e.id}`, slim(e));
    return [...uniq.values()];
  } finally {
    clearTimeout(timer);
  }
}

/** В кэше храним только нужные теги — localStorage небольшой. */
function slim(e: OsmElement): OsmElement {
  const tags: Record<string, string> = {};
  for (const k of KEEP_TAGS) if (e.tags?.[k]) tags[k] = e.tags[k];
  return { type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags };
}

/* ───────── Загрузка по идентификатору (общая ссылка «Наш день», вытесненный кэш) ───────── */

export function parseOsmSlug(slug: string): { type: OsmElement["type"]; id: number } | null {
  const m = /^osm-([nwr])(\d+)$/.exec(slug);
  if (!m) return null;
  return { type: m[1] === "n" ? "node" : m[1] === "w" ? "way" : "relation", id: Number(m[2]) };
}

export async function fetchOsmByIds(slugs: string[], outer?: AbortSignal): Promise<OsmElement[]> {
  const by: Record<OsmElement["type"], number[]> = { node: [], way: [], relation: [] };
  for (const s of slugs.slice(0, 40)) {
    const p = parseOsmSlug(s);
    if (p) by[p.type].push(p.id);
  }
  const parts = (["node", "way", "relation"] as const).filter((t) => by[t].length).map((t) => `${t}(id:${by[t].join(",")});`);
  if (!parts.length) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  outer?.addEventListener("abort", () => ctrl.abort());
  try {
    const q = `[out:json][timeout:20];(${parts.join("")});out tags center;`;
    const els = await Promise.any(ENDPOINTS.map((u) => post(u, q, ctrl.signal)));
    ctrl.abort();
    return els.map(slim);
  } finally {
    clearTimeout(timer);
  }
}

/* ───────── Режим работы ───────── */

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function expandDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    const r = /^([A-Z][a-z])-([A-Z][a-z])$/.exec(t);
    if (r) {
      const a = DAYS.indexOf(r[1]);
      const b = DAYS.indexOf(r[2]);
      if (a < 0 || b < 0) return null;
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i);
        if (i === b) break;
      }
    } else {
      const i = DAYS.indexOf(t);
      if (i < 0) return null;
      out.add(i);
    }
  }
  return [...out];
}

const hhmm = (t: string) => t.padStart(5, "0");

/** Простые правила OSM `opening_hours` ("Mo-Fr 09:00-18:00; Sa,Su 10:00-16:00", "24/7", "Mo off"). null — не разобрали. */
export function parseOpeningHours(raw?: string): OpeningHours | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "24/7") return Array(7).fill(["00:00", "24:00"]);
  const res: OpeningHours = Array(7).fill(null);
  let any = false;
  for (const part of s.split(";")) {
    const rule = part.trim();
    if (!rule) continue;
    const m = /^(?:([A-Za-z,\- ]+?)\s+)?(off|\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*)$/.exec(rule);
    if (!m) return null;
    const days = m[1] ? expandDays(m[1].replace(/\s+/g, "")) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    if (m[2] === "off") {
      for (const d of days) res[d] = null;
      continue;
    }
    const ivs = m[2].split(",").map((x) => x.trim().split("-"));
    const open = ivs.map((i) => hhmm(i[0])).sort()[0];
    let close = ivs.map((i) => hhmm(i[1])).sort().slice(-1)[0];
    if (close === "00:00" || close < open) close = "24:00";
    for (const d of days) res[d] = [open, close];
    any = true;
  }
  return any ? res : null;
}

/* ───────── Классификация ───────── */

interface Spec {
  category: CategoryId;
  subtitle: string;
  title: string;
  photoSet: string;
  price: [number, number];
  fb: number;
  age: [number, number];
  dur: number;
  indoor: boolean;
  outdoor: boolean;
  activity: 1 | 2 | 3;
  noise: 1 | 2 | 3;
  hours: [string, string];
  weather?: WeatherTag[];
  season?: SeasonTag[];
  interests?: InterestId[];
  experience?: ExperienceTag[];
  tags: string[];
  rating: number;
  parking: boolean;
  stroller: boolean;
  kidsMenu?: boolean;
}

const KIDDISH = /детск|ребят|малыш|игруш|кукол|юн[оы]|космос|зоолог|динозавр|интерактив|науч|техник|планетар|природ|железн|паровоз|трамва|аэро|патриот|сказ|мульт/i;

function classify(t: Record<string, string>): Spec | null {
  const name = t.name;
  const kidName = !!name && KIDDISH.test(name);
  const hasIn = t.indoor === "yes" || t.indoor === "building";
  switch (t.leisure) {
    case "playground":
      return { category: "park", subtitle: "Детская площадка", title: name || "Детская площадка", photoSet: "playground", price: [0, 0], fb: 0, age: [1, 10], dur: 45, indoor: false, outdoor: true, activity: 2, noise: 2, hours: ["07:00", "22:00"], interests: [], experience: ["walk", "free"], tags: ["Площадка", "Бесплатно", "На воздухе"], rating: 4.2, parking: false, stroller: true };
    case "park":
    case "garden":
      return { category: "park", subtitle: t.leisure === "garden" ? "Сад" : "Парк", title: name, photoSet: "park", price: [0, 0], fb: 0, age: [0, 12], dur: 75, indoor: false, outdoor: true, activity: 1, noise: 1, hours: ["06:00", "23:00"], interests: ["nature"], experience: ["walk", "picnic", "free"], tags: ["Парк", "Прогулка", "Бесплатно"], rating: 4.4, parking: true, stroller: true };
    case "water_park":
      return { category: "active", subtitle: "Аквапарк", title: name, photoSet: "waterpark", price: [800, 2000], fb: 5500, age: [3, 12], dur: 180, indoor: true, outdoor: true, activity: 3, noise: 3, hours: ["10:00", "22:00"], weather: ["heat", "rain", "any"], interests: ["sport"], experience: ["playzone"], tags: ["Аквапарк", "Вода"], rating: 4.4, parking: true, stroller: false };
    case "ice_rink":
      return { category: "active", subtitle: "Каток", title: name, photoSet: "ice", price: [300, 700], fb: 1800, age: [4, 12], dur: 90, indoor: hasIn, outdoor: !hasIn, activity: 3, noise: 2, hours: ["10:00", "22:00"], weather: ["cold", "any"], season: ["autumn", "winter", "spring"], interests: ["sport"], experience: ["playzone"], tags: ["Каток", "Спорт"], rating: 4.3, parking: true, stroller: false };
    case "miniature_golf":
    case "trampoline_park":
    case "amusement_arcade":
      return { category: "play", subtitle: t.leisure === "miniature_golf" ? "Мини-гольф" : t.leisure === "trampoline_park" ? "Батутный парк" : "Игровые автоматы", title: name, photoSet: t.leisure === "trampoline_park" ? "trampoline" : "play", price: [400, 900], fb: 2200, age: [4, 12], dur: 75, indoor: true, outdoor: false, activity: 3, noise: 3, hours: ["11:00", "22:00"], interests: ["sport"], experience: ["playzone"], tags: ["Активный отдых"], rating: 4.2, parking: true, stroller: false };
  }
  switch (t.tourism) {
    case "zoo":
      return { category: "animals", subtitle: "Зоопарк", title: name, photoSet: "zoo", price: [300, 900], fb: 2400, age: [0, 12], dur: 150, indoor: false, outdoor: true, activity: 2, noise: 1, hours: ["10:00", "19:00"], interests: ["animals", "nature"], experience: ["walk"], tags: ["Животные", "На воздухе"], rating: 4.5, parking: true, stroller: true };
    case "aquarium":
      return { category: "animals", subtitle: "Аквариум", title: name, photoSet: "aquarium", price: [500, 1200], fb: 3000, age: [0, 12], dur: 120, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "20:00"], interests: ["animals", "nature"], experience: ["unusual"], tags: ["Животные", "В помещении"], rating: 4.4, parking: true, stroller: true };
    case "theme_park":
      return { category: "active", subtitle: "Парк развлечений", title: name, photoSet: "ferris", price: [600, 1800], fb: 4500, age: [3, 12], dur: 210, indoor: false, outdoor: true, activity: 3, noise: 3, hours: ["11:00", "21:00"], weather: ["sun", "any"], season: ["spring", "summer", "autumn"], interests: ["sport"], experience: ["playzone"], tags: ["Аттракционы"], rating: 4.2, parking: true, stroller: true };
    case "museum":
      return { category: "museum", subtitle: "Музей", title: name, photoSet: "museum", price: [150, 500], fb: 900, age: [kidName ? 3 : 6, 12], dur: 75, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "18:00"], interests: kidName ? ["science"] : [], experience: ["workshop"], tags: ["Музей"], rating: kidName ? 4.5 : 4.0, parking: false, stroller: false };
  }
  switch (t.amenity) {
    case "theatre":
      return { category: "museum", subtitle: kidName ? "Детский театр" : "Театр", title: name, photoSet: "theatre", price: [400, 1500], fb: 2200, age: [kidName ? 3 : 7, 12], dur: 90, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "20:00"], interests: ["music", "fairy"], experience: ["show"], tags: ["Театр", "Спектакль"], rating: kidName ? 4.5 : 4.0, parking: false, stroller: false };
    case "planetarium":
      return { category: "museum", subtitle: "Планетарий", title: name, photoSet: "space", price: [300, 700], fb: 1500, age: [5, 12], dur: 75, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "19:00"], interests: ["space", "science"], experience: ["show"], tags: ["Космос", "В помещении"], rating: 4.5, parking: false, stroller: false };
    case "library":
      return { category: "museum", subtitle: "Библиотека", title: name, photoSet: "books", price: [0, 0], fb: 0, age: [2, 12], dur: 60, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "19:00"], experience: ["books", "free"], tags: ["Книги", "Бесплатно", "Тихо"], rating: kidName ? 4.4 : 4.0, parking: false, stroller: true };
    case "cafe":
    case "restaurant":
    case "fast_food":
      return { category: "cafe", subtitle: t.amenity === "cafe" ? "Кафе" : t.amenity === "fast_food" ? "Быстрое питание" : "Ресторан", title: name, photoSet: t.cuisine === "pizza" ? "pizza" : "cafe", price: [250, 800], fb: 1800, age: [0, 12], dur: 50, indoor: true, outdoor: false, activity: 1, noise: 2, hours: ["10:00", "22:00"], experience: ["cafe", "food"], tags: ["Поесть"], rating: 4.2, parking: false, stroller: true, kidsMenu: false };
    case "ice_cream":
      return { category: "cafe", subtitle: "Мороженое", title: name, photoSet: "icecream", price: [100, 400], fb: 600, age: [0, 12], dur: 25, indoor: true, outdoor: true, activity: 1, noise: 1, hours: ["10:00", "21:00"], experience: ["icecream"], tags: ["Мороженое"], rating: 4.3, parking: false, stroller: true };
  }
  switch (t.shop) {
    case "toys":
      return { category: "shop", subtitle: "Магазин игрушек", title: name, photoSet: "toys", price: [0, 0], fb: 800, age: [2, 12], dur: 30, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "21:00"], experience: ["toys"], tags: ["Игрушки"], rating: 4.3, parking: false, stroller: true };
    case "books":
      return { category: "shop", subtitle: "Книжный магазин", title: name, photoSet: "books", price: [0, 0], fb: 600, age: [2, 12], dur: 30, indoor: true, outdoor: false, activity: 1, noise: 1, hours: ["10:00", "21:00"], experience: ["books"], tags: ["Книги"], rating: 4.2, parking: false, stroller: true };
  }
  return null;
}

const EMOJI: Record<CategoryId, string> = { park: "🌳", play: "🎈", museum: "🏛️", active: "🧗", animals: "🐾", cafe: "🧁", shop: "🧸" };
const TINT: Record<CategoryId, string> = { park: "#CFEFC4", play: "#FFD6E4", museum: "#E5D9FF", active: "#CDEBFF", animals: "#FFE6B8", cafe: "#FFDCCB", shop: "#FFF0B3" };
const CAP: Record<string, number> = { park: 30, playground: 10, play: 12, museum: 25, active: 15, animals: 10, cafe: 45, shop: 10 };

const centerOf = (e: OsmElement): GeoPoint | null => {
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  return lat != null && lng != null ? { lat, lng } : null;
};

export const osmSlug = (e: Pick<OsmElement, "type" | "id">) => `osm-${e.type[0]}${e.id}`;

/** Элементы OSM → места нашего формата. Ближайшие — в приоритете, дубликаты склеены, лимиты по категориям. */
export function placesFromOsm(els: OsmElement[], origin: GeoPoint): Place[] {
  const rows: { place: Place; km: number }[] = [];
  const seen = new Set<string>();
  for (const e of els) {
    const t = e.tags ?? {};
    const c = centerOf(e);
    if (!c) continue;
    const spec = classify(t);
    if (!spec || !spec.title) continue;
    if (t.access === "private" || t.access === "no") continue;
    const dupKey = `${spec.title.toLowerCase()}|${c.lat.toFixed(3)}|${c.lng.toFixed(3)}`;
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    const slug = osmSlug(e);
    const parsed = parseOpeningHours(t.opening_hours);
    const hours: OpeningHours = parsed ?? (Array(7).fill([spec.hours[0], spec.hours[1]]) as OpeningHours);
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    const address = [t["addr:city"], street].filter(Boolean).join(", ");
    const fee = t.fee === "no" ? [0, 0] : spec.price;
    rows.push({
      km: haversineKm(origin, c),
      place: {
        id: slug,
        title: spec.title,
        slug,
        subtitle: spec.subtitle,
        description: `${spec.subtitle} рядом с вами по данным OpenStreetMap.${address ? ` ${address}.` : ""} ${parsed ? "" : "Режим работы не указан — перед поездкой лучше уточнить. "}Цены и условия мы не проверяли.`.replace(/\s+/g, " ").trim(),
        latitude: c.lat,
        longitude: c.lng,
        address: address || "Адрес не указан в OpenStreetMap",
        source: "OpenStreetMap",
        confidence: "osm",
        category: spec.category,
        photos: photosFor(spec.photoSet, slug, spec.title),
        tint: TINT[spec.category],
        emoji: EMOJI[spec.category],
        rating: spec.rating,
        review_count: 0,
        price_min: fee[0],
        price_max: fee[1],
        price_level: (fee[1] === 0 ? 0 : fee[1] <= 600 ? 1 : fee[1] <= 1500 ? 2 : 3) as Place["price_level"],
        family_budget: fee[1] === 0 ? Math.min(spec.fb, 0) : spec.fb,
        age_min: spec.age[0],
        age_max: spec.age[1],
        average_duration: spec.dur,
        indoor: hasIndoor(spec, t),
        outdoor: spec.outdoor && !(t.indoor === "yes" || t.indoor === "building"),
        activity_level: spec.activity,
        noise_level: spec.noise,
        stroller_friendly: spec.stroller,
        baby_room: false,
        kids_menu: !!spec.kidsMenu,
        parking: spec.parking,
        toilets: spec.category !== "park",
        wardrobe: spec.indoor,
        booking_required: false,
        opening_hours: hours,
        weather_tags: spec.weather ?? (spec.indoor && !spec.outdoor ? ["rain", "cold", "any"] : spec.indoor ? ["any", "rain", "sun"] : ["sun", "any"]),
        season_tags: spec.season ?? ["spring", "summer", "autumn", "winter"],
        interest_tags: spec.interests ?? [],
        experience_tags: spec.experience ?? [],
        tags: spec.tags,
        reviews: [],
      },
    });
  }
  rows.sort((a, b) => a.km - b.km);
  const used: Record<string, number> = {};
  const out: Place[] = [];
  for (const r of rows) {
    // безымянные площадки одинаковы на вид — их берём немного и только ближайшие
    const capKey = r.place.subtitle === "Детская площадка" ? "playground" : r.place.category;
    const n = (used[capKey] ?? 0) + 1;
    if (n > (CAP[capKey] ?? 20)) continue;
    used[capKey] = n;
    out.push(r.place);
  }
  return out;
}

const hasIndoor = (spec: Spec, t: Record<string, string>) => spec.indoor || t.indoor === "yes" || t.indoor === "building";

/** Карта осмысленной подписи «OpenStreetMap» для интерфейса. */
export const isOsmPlace = (p: Pick<Place, "confidence">) => p.confidence === "osm";
