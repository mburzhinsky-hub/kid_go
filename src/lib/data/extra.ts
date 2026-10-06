import type { CategoryId, ExperienceTag, InterestId, KidEvent, OpeningHours, ParentInfoField, Place, PlaceType, SeasonTag, WeatherTag } from "@/lib/types";
import { auditForPlace, isAuditedPublicPlace, trustedPlaceTags } from "./source-audit";
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
import placesMskOkrugs from "./extra/msk-okrugs.places.json";
import placesFamilyCafes from "./extra/msk-family-cafes.places.json";
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
  place_type?: PlaceType;
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
  toilets?: boolean;
  wardrobe?: boolean;
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
  /** Конкретная страница/сервис, откуда взяты rating и review count. Без неё social proof не публикуем. */
  rating_source?: string | null;
  menu_url?: string | null;
  source?: string;
  confidence?: "high" | "medium" | "low";
}

export interface RawEvent {
  venue: string;
  title: string;
  description: string;
  schedule: { days: number[]; from: string; to: string };
  valid_from?: string;
  valid_until?: string;
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
  ...(placesMskOkrugs as RawPlace[]),
  ...(placesFamilyCafes as RawPlace[]),
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
    const v = h[i] ?? null; // Выходной нельзя подменять расписанием воскресенья.
    const m = typeof v === "string" ? /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(v) : null;
    if (!m) {
      out.push(null);
      continue;
    }
    const from = m[1].padStart(5, "0");
    let to = m[2].padStart(5, "0");
    // «12:00–00:00» — работает до полуночи; без этого место считалось закрытым весь день
    if (to === "00:00" && from !== "00:00") to = "24:00";
    out.push([from, to]);
  }
  return out;
}

export function buildPlace(r: RawPlace, index: number, photoIdx?: number, usedCovers?: ReadonlySet<string>): Place {
  const level = r.price[1] === 0 ? 0 : r.price[1] <= 600 ? 1 : r.price[1] <= 1500 ? 2 : 3;
  const indoorOnly = r.indoor && !r.outdoor;
  const weather: WeatherTag[] = r.weather?.length ? r.weather : indoorOnly ? ["rain", "cold", "any"] : r.indoor ? ["any", "rain", "sun"] : ["sun", "any"];
  const audit = auditForPlace(r.slug);
  const verifiedFields = audit?.verified_fields ?? [];
  const verifiedFamilyFields = audit?.verified_family_fields ?? [];
  const verifiedFamilySet = new Set<ParentInfoField>(verifiedFamilyFields);
  const unknown_fields: ParentInfoField[] = [];
  const bool = (field: ParentInfoField, value: boolean | undefined, fallback = false) => {
    if (!verifiedFamilySet.has(field)) unknown_fields.push(field);
    return value ?? fallback;
  };
  const hasRatingSource = !!r.rating_source && r.rating != null && (r.reviews ?? 0) > 0;
  const broadType: PlaceType =
    r.place_type ??
    (r.category === "play" ? "play_center" :
      r.category === "active" ? "active" :
      r.category === "animals" ? "zoo" :
      r.category === "cafe" ? "cafe" :
      r.category === "shop" ? "shop" :
      r.category);
  let sourceName: string | undefined;
  if (r.source) {
    try { sourceName = new URL(r.source).hostname.replace(/^www\./, ""); } catch { /* invalid source is caught by validation */ }
  }
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
    source_name: sourceName,
    verified_at: audit?.checked_at ?? undefined,
    verification_status:
      audit?.status === "reviewed" && audit.identity && verifiedFields.includes("price") && verifiedFields.includes("opening_hours")
        ? "verified"
        : "partial",
    verification_note:
      audit?.status === "reviewed" && audit.identity
        ? "Существование места проверено по публичному источнику. Точные поля отмечаются отдельно."
        : "Источник места требует повторной проверки.",
    verified_fields: verifiedFields,
    confidence: r.confidence === "high" ? "high" : "medium",
    category: r.category,
    place_type: broadType,
    photos: photosFor(r.photoSet, r.slug, r.title, photoIdx, usedCovers),
    tint: TINTS[r.category],
    emoji: EMOJI[r.category],
    // Social proof публикуем только с отдельным, проверяемым источником рейтинга.
    rating: hasRatingSource ? r.rating! : 0,
    review_count: hasRatingSource ? (r.reviews ?? 0) : 0,
    rating_source: hasRatingSource ? r.rating_source! : undefined,
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
    stroller_friendly: bool("stroller_friendly", r.stroller),
    baby_room: bool("baby_room", r.baby_room),
    kids_menu: bool("kids_menu", r.kids_menu),
    parking: bool("parking", r.parking),
    toilets: bool("toilets", r.toilets),
    wardrobe: bool("wardrobe", r.wardrobe),
    booking_required: bool("booking_required", r.booking),
    unknown_fields,
    opening_hours: parseHours(r.hours),
    weather_tags: weather,
    season_tags: r.season?.length ? r.season : ["spring", "summer", "autumn", "winter"],
    interest_tags: r.interests ?? [],
    experience_tags: r.experience ?? [],
    tags: trustedPlaceTags(r.tags ?? [], verifiedFields, verifiedFamilyFields),
    is_hit: r.hit,
    reviews: [],
  };
}

export function buildPlaces(startIndex: number, existingSlugs: Set<string>, usedCovers: Iterable<string> = []): Place[] {
  const seen = new Set(existingSlugs);
  const covers = new Set(usedCovers);
  const res: Place[] = [];
  const perSet = new Map<string, number>();
  for (const r of RAW_PLACES) {
    if (r.confidence === "low" || seen.has(r.slug) || !isAuditedPublicPlace(r.slug)) continue;
    seen.add(r.slug);
    // Порядковый номер внутри набора: соседние места одного типа получают разные первые кадры.
    const k = perSet.get(r.photoSet) ?? 0;
    perSet.set(r.photoSet, k + 1);
    const place = buildPlace(r, startIndex + res.length, k, covers);
    if (place.photos[0]) covers.add(place.photos[0].src);
    res.push(place);
  }
  return res;
}

/** Регулярные программы → только ближайшее следующее вхождение каждой программы. */
export function buildEvents(placeBySlug: Map<string, Place>, now = new Date()): KidEvent[] {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(d);
  const weekdayOf = (d: Date) => {
    const w = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(d);
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(w) + 1;
  };
  const out: KidEvent[] = [];
  RAW_EVENTS.forEach((e, i) => {
    const place = placeBySlug.get(e.venue);
    if (!place || e.confidence === "low" || !e.source) return;
    for (let off = 0; off <= 7; off++) {
      const d = new Date(now.getTime() + off * 86400000);
      const date = ymd(d);
      if (!e.schedule.days.includes(weekdayOf(d))) continue;
      if (e.valid_from && date < e.valid_from) continue;
      if (e.valid_until && date > e.valid_until) continue;
      const startAt = `${date}T${e.schedule.from}:00+03:00`;
      const endAt = `${date}T${e.schedule.to}:00+03:00`;
      if (new Date(endAt).getTime() <= now.getTime()) continue;
      out.push({
        id: `r${i + 1}`,
        place_id: place.id,
        title: e.title,
        description: e.description,
        start_at: startAt,
        end_at: endAt,
        age_min: e.age[0],
        age_max: e.age[1],
        price: e.price,
        image: ph(PH[(PHOTO_SETS[e.photoSet] ?? PHOTO_SETS.park).keys[0]], e.title),
        source: e.source,
        verification_status: e.confidence === "high" ? "verified" : "partial",
      });
      break;
    }
  });
  return out;
}
