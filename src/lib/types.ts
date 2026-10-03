/**
 * Доменные модели КидГоу.
 * Совпадают с prisma/schema.prisma — mocked data layer отдаёт ровно эти формы,
 * поэтому замена на реальную БД не затрагивает UI.
 */

export type CategoryId =
  | "park"
  | "play"
  | "museum"
  | "active"
  | "animals"
  | "cafe"
  | "shop";

export type Level = 1 | 2 | 3; // 1 — спокойно, 2 — умеренно, 3 — активно/шумно

export type WeatherTag = "rain" | "sun" | "cold" | "heat" | "any";
export type SeasonTag = "spring" | "summer" | "autumn" | "winter";

export type InterestId =
  | "dinosaurs"
  | "animals"
  | "transport"
  | "sport"
  | "drawing"
  | "music"
  | "science"
  | "cooking"
  | "construction"
  | "nature"
  | "space"
  | "fairy";

export type ExperienceTag =
  | "playzone"
  | "cafe"
  | "workshop"
  | "show"
  | "walk"
  | "icecream"
  | "toys"
  | "books"
  | "food"
  | "picnic"
  | "unusual"
  | "free"
  | "toddlers";

/** Часы работы: индекс 0 — понедельник. null — выходной. */
export type OpeningHours = ([string, string] | null)[];

export interface Photo {
  /** id фото на CDN (сейчас Unsplash). */
  src: string;
  alt: string;
}

export interface Place {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  metro?: string;
  category: CategoryId;
  photos: Photo[];
  /** Фирменный цвет-подложка под фото (пока грузится / если не загрузилось). */
  tint: string;
  emoji: string;
  rating: number;
  review_count: number;
  price_min: number; // ₽ на человека, 0 — бесплатно
  price_max: number;
  price_level: 0 | 1 | 2 | 3;
  /** Сколько обычно тратит семья (2 взрослых + 2 ребёнка), ₽ */
  family_budget: number;
  age_min: number;
  age_max: number;
  average_duration: number; // минуты
  indoor: boolean;
  outdoor: boolean;
  activity_level: Level;
  noise_level: Level;
  stroller_friendly: boolean;
  baby_room: boolean;
  kids_menu: boolean;
  parking: boolean;
  toilets: boolean;
  wardrobe: boolean;
  booking_required: boolean;
  opening_hours: OpeningHours;
  weather_tags: WeatherTag[];
  season_tags: SeasonTag[];
  interest_tags: InterestId[];
  experience_tags: ExperienceTag[];
  tags: string[]; // человекочитаемые чипы на странице места
  is_hit?: boolean;
  reviews: Review[];
}

export interface Review {
  author: string;
  kids: string;
  rating: number;
  text: string;
  date: string;
}

export interface AdventureStep {
  place_id: string;
  position: number;
  recommended_duration: number; // минуты
  /** Минуты до следующей точки. Если не задано — считаем по расстоянию. */
  travel_time_to_next?: number;
  note?: string;
}

export interface Adventure {
  id: string;
  title: string;
  slug: string;
  description: string;
  tagline: string;
  cover_image: Photo;
  tint: string;
  emoji: string;
  age_min: number;
  age_max: number;
  estimated_duration: number; // минуты, вычисляется из шагов
  estimated_budget: number; // ₽ на семью
  distance_km: number;
  weather_tags: WeatherTag[];
  interest_tags: InterestId[];
  moods: MoodId[];
  start_time: string; // "12:30"
  recommend_percent: number;
  steps: AdventureStep[];
}

export interface KidEvent {
  id: string;
  place_id: string;
  title: string;
  description: string;
  start_at: string; // ISO
  end_at: string;
  age_min: number;
  age_max: number;
  price: number;
  tickets_url?: string;
  image: Photo;
}

/* ---------- Planner / рекомендации ---------- */

export type DurationId = "short" | "mid" | "half" | "day";
export type MoodId = "energy" | "creative" | "learn" | "outdoor" | "calm" | "surprise";
export type BudgetId = "free" | "2000" | "5000" | "any";
export type TransportId = "walk" | "car" | "transit";

export interface Child {
  id: string;
  name: string;
  age: number;
  birthDate?: string;
  interests: InterestId[];
  emoji?: string;
}

export interface Weather {
  temp: number;
  condition: "rain" | "sun" | "cloud" | "snow";
  label: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlannerInput {
  children: Pick<Child, "age" | "interests" | "name">[];
  duration: DurationId;
  mood: MoodId;
  budget: BudgetId;
  transport: TransportId;
  location: GeoPoint;
  weather: Weather;
  now: Date;
  /** из естественного языка: хочется поесть после активности */
  foodAfter?: boolean;
  maxDistanceKm?: number;
  activity?: Level;
}

/** Собранный маршрут: и готовые, и сгенерированные приключения приводятся к нему. */
export interface PlanStop {
  place: Place;
  start: string; // "12:30"
  duration: number;
  travelToNext?: { minutes: number; km: number; mode: TransportId };
  note?: string;
}

export interface Plan {
  key: string;
  title: string;
  description: string;
  emoji: string;
  tint: string;
  cover: Photo;
  stops: PlanStop[];
  totalMinutes: number;
  budget: number;
  distanceKm: number;
  ageMin: number;
  ageMax: number;
  indoor: boolean;
  rainProof: boolean;
  why: string[];
  explanation: string;
  score?: number;
  adventureSlug?: string;
}
