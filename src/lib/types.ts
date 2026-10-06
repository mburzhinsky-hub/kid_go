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

/** Уточнённый тип места не ломает широкие продуктовые категории/фильтры. */
export type PlaceType =
  | "park"
  | "play_center"
  | "museum"
  | "active"
  | "zoo"
  | "aquarium"
  | "cafe"
  | "restaurant"
  | "shop"
  | "bookstore"
  | "theatre"
  | "circus"
  | "workshop"
  | "landmark"
  | "heritage"
  | "food_hall"
  | "ice_rink"
  | "waterpark"
  | "other";

export type VerificationStatus = "verified" | "partial" | "demo" | "osm";
export type ParkingStatus = "yes" | "no" | "partial" | "unknown";

export interface ParkingInfo {
  status: ParkingStatus;
  details: string;
  source: string;
  checked_at: string;
}
export type PlaceVerifiedField = "identity" | "address" | "price" | "opening_hours";
export type PhotoKind = "official" | "partner" | "creator" | "ugc" | "stock" | "demo";
export type ParentInfoField =
  | "stroller_friendly"
  | "baby_room"
  | "kids_menu"
  | "parking"
  | "toilets"
  | "wardrobe"
  | "booking_required";

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
  /** Источник визуала: stock/demo не должен восприниматься как фотография конкретного места. */
  kind?: PhotoKind;
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
  /** Город / посёлок (для Подмосковья и окраин). */
  town?: string;
  /** msk — в границах Москвы, mo — Московская область. */
  region?: "msk" | "mo";
  /** Откуда взяты сведения (для редакторской проверки). */
  source?: string;
  source_name?: string;
  /** Дата именно редакторской проверки; отсутствие даты не выдаём за свежую проверку. */
  verified_at?: string;
  verification_status?: VerificationStatus;
  verification_note?: string;
  /** Поля, которые отдельно подтверждены в source audit. */
  verified_fields?: PlaceVerifiedField[];
  /** Legacy confidence сохраняем для импортированных наборов. */
  confidence?: "high" | "medium" | "demo" | "osm";
  category: CategoryId;
  /** Более точный тип места; category остаётся широкой категорией для текущих фильтров. */
  place_type?: PlaceType;
  photos: Photo[];
  /** Фирменный цвет-подложка под фото (пока грузится / если не загрузилось). */
  tint: string;
  emoji: string;
  /** 0/0 означает: подтверждённого рейтинга сейчас нет. */
  rating: number;
  review_count: number;
  /** Рейтинг показываем только когда известен его конкретный источник. */
  rating_source?: string;
  /** Прямая подтверждённая ссылка на меню/варианты еды. */
  menu_url?: string;
  /** Детализированная редакторская информация о парковке. */
  parking_info?: ParkingInfo;
  /** Редакторская заметка из источника данных — используется для описания/тегов, не как системный текст UI. */
  editorial_note?: string;
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
  /** Какие family-specific поля пока не подтверждены и не должны выглядеть как «нет». */
  unknown_fields?: ParentInfoField[];
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
  recommend_percent?: number;
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
  source?: string;
  verification_status?: Exclude<VerificationStatus, "demo" | "osm">;
}

/* ---------- Planner / рекомендации ---------- */

export type DurationId = "short" | "mid" | "half" | "day";
export type MoodId = "energy" | "creative" | "learn" | "outdoor" | "calm" | "surprise";
export type BudgetId = "free" | "2000" | "5000" | "any";
export type TransportId = "walk" | "car" | "transit";
export type GeoScope = "moscow" | "moscow-region";

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

/** Сигналы семьи для персонализации (хотелки, история, оценки). */
export interface FamilySignals {
  want: string[];
  visited: string[];
  loved: string[];
  disliked: string[];
  /** Недавно показанные якоря — чтобы не крутить одно и то же. */
  seen?: string[];
}

/** Ограничения сценария («до дневного сна», «без толпы», «только под крышей»…). */
export interface ScenarioConstraints {
  indoorOnly?: boolean;
  outdoorPreferred?: boolean;
  quiet?: boolean;
  stroller?: boolean;
  maxTravelMin?: number;
  /** Вернуться домой к этому времени (минуты от полуночи). */
  endBy?: number;
  /** Начать не раньше (минуты от полуночи). */
  startAt?: number;
  minStops?: number;
  preferCategories?: CategoryId[];
  avoidCategories?: CategoryId[];
  interests?: InterestId[];
  /** Предпочесть места с таким форматом (спектакль, мастер-класс, книги…). */
  experiences?: ExperienceTag[];
  /** Шаг-«передышка» для родителя: кафе с игровой зоной. */
  parentBreak?: boolean;
  bookingOk?: boolean;
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
  /** Почасовой прогноз — если есть, погода считается на окно каждого шага. */
  forecast?: import("@/lib/forecast").Forecast;
  /** 0 — сегодня, 1 — завтра… */
  dayOffset?: number;
  family?: FamilySignals;
  constraints?: ScenarioConstraints;
  /** Детерминированная «ротация» выдачи (день + семья). */
  seed?: string;
  /** Подпись точки выезда для объяснений. */
  originLabel?: string;
  /** Места рядом из открытых данных (OpenStreetMap) — дополняют каталог там, где он редок. */
  extraPlaces?: Place[];
  /** any — общий поиск без привязки к точке, area — округ/город, exact — точный адрес. По умолчанию exact. */
  locationMode?: "any" | "area" | "exact";
  /** В режиме any: только Москва или Москва вместе с Подмосковьем. */
  geoScope?: GeoScope;
  /**
   * Для округа: strict (по умолчанию) — основные места только в самом округе; adjacent — и в соседних (без дальних);
   * wide — и дальше, в пределах дороги (с предпочтением выбранного). Для «вся Москва», адреса и городов области не используется.
   */
  areaScope?: "strict" | "adjacent" | "wide";
  /** Для округа: показать и то, что «не совсем по теме» ситуации (по умолчанию — только подходящие по типу). */
  looseFit?: boolean;
}

/** Собранный маршрут: и готовые, и сгенерированные приключения приводятся к нему. */
export interface StopWeather {
  temp: number;
  condition: Weather["condition"];
  pop: number;
  /** Плохо для улицы в это окно. */
  bad: boolean;
}

export interface PlanStop {
  place: Place;
  start: string; // "12:30"
  duration: number;
  travelToNext?: { minutes: number; km: number; mode: TransportId };
  note?: string;
  weather?: StopWeather;
  /** Крытая замена рядом для уличного шага. */
  backup?: string;
  /** Этот шаг выбран как точка питания в конкретном плане. */
  foodOption?: boolean;
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
  /** Дорога от точки выезда до первого шага. */
  fromHome?: { minutes: number; km: number; mode: TransportId; /** оценка от центра округа, а не от двери */ approx?: boolean };
  /** Что взять с собой. */
  bring?: string[];
  /** Почему порядок/состав такие из-за погоды. */
  weatherNote?: string;
  dayOffset?: number;
}
