import type { CategoryId, ExperienceTag, InterestId, KidEvent, OpeningHours, Place, SeasonTag, WeatherTag } from "@/lib/types";
import { PH, PHOTO_SETS, ph, photosFor } from "./photos";
export { photosFor };

/**
 * Места и регулярные программы из JSON-файлов `extra/*.places.json` и `extra/*.events.json`.
 * Формат — в `extra/README.md`. Файлы подхватываются автоматически (require.context-аналог
 * сделан явным списком, чтобы бандлер видел зависимости).
 */
import placesW1 from "./extra/mo-west1.places.json";
import placesW2 from "./extra/mo-west2.places.json";
import placesN from "./extra/mo-north-east.places.json";
import placesS from "./extra/mo-south.places.json";
import placesMskCulture from "./extra/msk-culture.places.json";
import placesMskOutdoor from "./extra/msk-outdoor.places.json";
import placesMskParks2 from "./extra/msk-parks2.places.json";
import placesEvents from "./extra/programs.places.json";
import eventsAll from "./extra/programs.events.json";

export interface RawPlace {
  title: string;
  slug: string;
  town?: string;
  region?: "msk" | "mo";
  address: string;
  metro?: string | null;
  lat: number;
  lng: number;
  category: CategoryId;
  subtitle: string;
  description: string;
  price: [number, number];
  family_budget: number;
  age: [number, number];
  duration: number;
  indoor: boolean;
  outdoor: boolean;
  activity: 1 | 2 | 3;
  noise: 1 | 2 | 3;
  stroller?: boolean;
  baby_room?: boolean;
  kids_menu?: boolean;
  parking?: boolean;
  booking?: boolean;
  hours: (string | null)[];
  season?: SeasonTag[];
  weather?: WeatherTag[];
  interests?: InterestId[];
  experience?: ExperienceTag[];
  tags?: string[];
  hit?: boolean;
  photoSet: string;
  rating?: number | null;
  reviews?: number | null;
  source?: string;
  confidence?: "high" | "medium" | "low";
}

export interface RawEvent {
  venue: string;
  title: string;
  description: string;
  schedule: { days: number[]; from: string; to: string };
  age: [number, number];
  price: number;
  photoSet: string;
  source?: string;
  confidence?: "high" | "medium" | "low";
}

export const RAW_PLACES: RawPlace[] = [
  ...(placesW1 as RawPlace[]),
  ...(placesW2 as RawPlace[]),
  ...(placesN as RawPlace[]),
  ...(placesS as RawPlace[]),
  ...(placesMskCulture as RawPlace[]),
  ...(placesMskOutdoor as RawPlace[]),
  ...(placesMskParks2 as RawPlace[]),
  ...(placesEvents as RawPlace[]),
];
export const RAW_EVENTS = eventsAll as RawEvent[];

const TINTS: Record<CategoryId, string> = {
  park: "#CFEFC4",
  play: "#FFD6E4",
  museum: "#E5D9FF",
  active: "#CDEBFF",
  animals: "#FFE6B8",
  cafe: "#FFDCCB",
  shop: "#FFF0B3",
};
const EMOJI: Record<CategoryId, string> = { park: "🌳", play: "🎈", museum: "🏛️", active: "🧗", animals: "🐐", cafe: "🧁", shop: "🧸" };

export function parseHours(h: (string | null)[]): OpeningHours {
  const out: OpeningHours = [];
  for (let i = 0; i < 7; i++) {
    const v = h[i] ?? h[h.length - 1] ?? null;
    const m = typeof v === "string" ? /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(v) : null;
    out.push(m ? [m[1].padStart(5, "0"), m[2].padStart(5, "0")] : null);
  }
  return out;
}

export function buildPlace(r: RawPlace, index: number): Place {
  const level = r.price[1] === 0 ? 0 : r.price[1] <= 600 ? 1 : r.price[1] <= 1500 ? 2 : 3;
  const indoorOnly = r.indoor && !r.outdoor;
  const weather: WeatherTag[] = r.weather?.length ? r.weather : indoorOnly ? ["rain", "cold", "any"] : r.indoor ? ["any", "rain", "sun"] : ["sun", "any"];
  const reviews = r.reviews ?? 0;
  return {
    id: `x${String(index + 1).padStart(3, "0")}`,
    title: r.title,
    slug: r.slug,
    subtitle: r.subtitle,
    description: r.description,
    latitude: r.lat,
    longitude: r.lng,
    address: r.address,
    metro: r.metro || undefined,
    town: r.town,
    region: r.region ?? "mo",
    source: r.source,
    confidence: r.confidence === "high" ? "high" : "medium",
    category: r.category,
    photos: photosFor(r.photoSet, r.slug, r.title),
    tint: TINTS[r.category],
    emoji: EMOJI[r.category],
    // Если реальных цифр нет — нейтральная оценка и 0 отзывов (интерфейс прячет рейтинг без отзывов).
    rating: r.rating ?? 4.4,
    review_count: reviews,
    price_min: r.price[0],
    price_max: r.price[1],
    price_level: level as Place["price_level"],
    family_budget: r.family_budget,
    age_min: r.age[0],
    age_max: Math.min(12, r.age[1]),
    average_duration: r.duration,
    indoor: r.indoor,
    outdoor: r.outdoor,
    activity_level: r.activity,
    noise_level: r.noise,
    stroller_friendly: r.stroller ?? r.outdoor,
    baby_room: r.baby_room ?? false,
    kids_menu: r.kids_menu ?? false,
    parking: r.parking ?? true,
    toilets: true,
    wardrobe: r.indoor,
    booking_required: r.booking ?? false,
    opening_hours: parseHours(r.hours),
    weather_tags: weather,
    season_tags: r.season?.length ? r.season : ["spring", "summer", "autumn", "winter"],
    interest_tags: r.interests ?? [],
    experience_tags: r.experience ?? [],
    tags: r.tags ?? [],
    is_hit: r.hit,
    reviews: [],
  };
}

export function buildPlaces(startIndex: number, existingSlugs: Set<string>): Place[] {
  const seen = new Set(existingSlugs);
  const res: Place[] = [];
  for (const r of RAW_PLACES) {
    if (r.confidence === "low" || seen.has(r.slug)) continue;
    seen.add(r.slug);
    res.push(buildPlace(r, startIndex + res.length));
  }
  return res;
}

/** Регулярные программы → ближайшее вхождение по расписанию (от сегодняшнего дня по Москве). */
export function buildEvents(placeBySlug: Map<string, Place>, now = new Date()): KidEvent[] {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(d);
  const weekdayOf = (d: Date) => {
    const w = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(d);
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(w) + 1;
  };
  const out: KidEvent[] = [];
  RAW_EVENTS.forEach((e, i) => {
    const place = placeBySlug.get(e.venue);
    if (!place || e.confidence === "low") return;
    for (let off = 0; off < 7; off++) {
      const d = new Date(now.getTime() + off * 86400000);
      if (!e.schedule.days.includes(weekdayOf(d))) continue;
      out.push({
        id: `r${i + 1}-${off}`,
        place_id: place.id,
        title: e.title,
        description: e.description,
        start_at: `${ymd(d)}T${e.schedule.from}:00+03:00`,
        end_at: `${ymd(d)}T${e.schedule.to}:00+03:00`,
        age_min: e.age[0],
        age_max: e.age[1],
        price: e.price,
        image: ph(PH[(PHOTO_SETS[e.photoSet] ?? PHOTO_SETS.park).keys[0]], e.title),
      });
    }
  });
  return out;
}
