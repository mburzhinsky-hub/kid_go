import type { Adventure, MoodId, InterestId, WeatherTag, Photo } from "@/lib/types";
import { placeBySlug } from "./places";
import { PH, ph } from "./photos";
import { buildPlan } from "@/lib/plan";

interface AdventureSeed {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  cover: Photo;
  emoji: string;
  tint: string;
  start: string;
  moods: MoodId[];
  interests: InterestId[];
  steps: { slug: string; duration: number; travel?: number; note?: string }[];
  ageOverride?: [number, number];
}

/** Обложка выезда за город — первое фото его главного места. */
const coverOf = (slug: string): Photo => {
  const p = placeBySlug.get(slug);
  if (!p) throw new Error(`Adventure cover: unknown or unpublished place ${slug}`);
  return { ...p.photos[0] };
};

/**
 * Curated adventures use only places that remain publishable after the Block 1 trust audit.
 * Recommendation percentages were removed: real social proof must come from real user data later.
 */
const seeds: AdventureSeed[] = [
  {
    slug: "den-dinozavrov",
    title: "День динозавров",
    tagline: "Скелеты динозавров и прогулка рядом с природой",
    description:
      "Начинаем с настоящих скелетов и палеонтологии, а после музея переключаемся на спокойную прогулку по Битцевскому лесу.",
    cover: ph(PH.dinoHall, "Палеонтологический музей"),
    emoji: "🦖",
    tint: "#E5D9FF",
    start: "11:30",
    moods: ["learn", "surprise", "calm"],
    interests: ["dinosaurs", "science", "nature"],
    ageOverride: [5, 12],
    steps: [
      { slug: "paleontologichesky-muzey", duration: 120, travel: 20, note: "На музей лучше заложить не меньше двух часов." },
      { slug: "bitsevsky-les", duration: 60, note: "Финальный шаг зависит от погоды: при дожде оставьте только музей." },
    ],
  },
  {
    slug: "kosmicheskaya-subbota",
    title: "Космическая суббота",
    tagline: "Ракеты, космос и прогулка по ВДНХ",
    description:
      "Сначала изучаем космическую технику и историю полётов, затем продолжаем день прогулкой по территории ВДНХ.",
    cover: ph(PH.rocketStatue, "Монумент покорителям космоса"),
    emoji: "🚀",
    tint: "#DCE8FF",
    start: "11:00",
    moods: ["learn", "surprise", "outdoor"],
    interests: ["space", "science", "transport"],
    steps: [
      { slug: "muzey-kosmonavtiki", duration: 120, travel: 8 },
      { slug: "vdnh", duration: 90 },
    ],
  },
  {
    slug: "zhirafy-i-syrniki",
    title: "Жирафы и звёзды",
    tagline: "Зоопарк и планетарий в одном районе",
    description:
      "Большой день в центре: несколько часов в Московском зоопарке, затем — звёзды и космос в Московском планетарии.",
    cover: ph(PH.giraffe, "Жираф"),
    emoji: "🦒",
    tint: "#FFE6B8",
    start: "10:00",
    moods: ["learn", "surprise", "outdoor"],
    interests: ["animals", "space"],
    steps: [
      { slug: "moskovsky-zoopark", duration: 150, travel: 10 },
      { slug: "moskovsky-planetariy", duration: 90 },
    ],
  },
  {
    slug: "skazka-ryadom",
    title: "Сказка рядом",
    tagline: "Кукольный театр и прогулка в саду",
    description:
      "Смотрим спектакль в Театре кукол имени Образцова, а затем выходим на спокойную прогулку в сад «Эрмитаж».",
    cover: ph(PH.marionette, "Кукольный театр"),
    emoji: "🎭",
    tint: "#FFD6E4",
    start: "11:00",
    moods: ["calm", "surprise", "learn"],
    interests: ["fairy", "music"],
    steps: [
      { slug: "teatr-obrazcova", duration: 90, travel: 15, note: "Время спектакля нужно сверить с актуальной афишей театра." },
      { slug: "sad-ermitazh", duration: 60 },
    ],
  },
  {
    slug: "podvodny-mir",
    title: "Подводный мир",
    tagline: "Океанариум и большая прогулка по ВДНХ",
    description:
      "Главный акцент дня — Москвариум. После него можно без спешки пройтись по ВДНХ и выбрать продолжение по погоде.",
    cover: ph(PH.dolphinsLeap, "Морские животные"),
    emoji: "🐬",
    tint: "#CDEBFF",
    start: "12:00",
    moods: ["surprise", "learn", "calm"],
    interests: ["animals", "nature"],
    steps: [
      { slug: "moskvarium", duration: 150, travel: 15, note: "Проверьте доступные сеансы и билеты на официальном сайте." },
      { slug: "vdnh", duration: 75 },
    ],
  },
  {
    slug: "dozhdiku-nazlo",
    title: "Дождику назло",
    tagline: "Научный музей и большой фудмолл — всё под крышей",
    description:
      "Проводим первую половину дня в интерактивном музее науки, затем едем на обед в «Депо.Москва».",
    cover: ph(PH.plasmaBall, "Научный музей"),
    emoji: "🧪",
    tint: "#E5D9FF",
    start: "12:00",
    moods: ["learn", "surprise"],
    interests: ["science", "cooking"],
    steps: [
      { slug: "eksperimentanium", duration: 120, travel: 25 },
      { slug: "depo-food-hall", duration: 75 },
    ],
  },
  {
    slug: "zolotye-sokolniki",
    title: "Золотые Сокольники",
    tagline: "Парк и верёвочные трассы в одном месте",
    description:
      "Прогулка по Сокольникам и активная часть дня в ПандаПарке. Маршрут лучше всего подходит для сухой погоды.",
    cover: ph(PH.autumnPath, "Осенняя аллея"),
    emoji: "🍂",
    tint: "#FFE1C2",
    start: "11:30",
    moods: ["outdoor", "energy"],
    interests: ["nature", "sport"],
    steps: [
      { slug: "park-sokolniki", duration: 60, travel: 15 },
      { slug: "panda-park-sokolniki", duration: 90 },
    ],
  },
  {
    slug: "besplatny-den-u-reki",
    title: "День у реки",
    tagline: "Парк Горького, Нескучный сад и Музеон",
    description:
      "Большой прогулочный маршрут вдоль Москвы-реки: Парк Горького, Нескучный сад и Парк искусств «Музеон».",
    cover: ph(PH.parkGreen, "Парк у реки"),
    emoji: "🌿",
    tint: "#CFEFC4",
    start: "12:00",
    moods: ["outdoor", "calm", "energy"],
    interests: ["nature", "sport", "drawing"],
    steps: [
      { slug: "park-gorkogo", duration: 60, travel: 15 },
      { slug: "neskuchny-sad", duration: 60, travel: 20 },
      { slug: "muzeon", duration: 60 },
    ],
  },
  {
    slug: "myagkiy-den-dlya-malysha",
    title: "Мягкий день для малыша",
    tagline: "Ровные дорожки, зелень и спокойная прогулка",
    description:
      "Неспешный день без плотного расписания: прогулка в Парке Горького и продолжение в Музеоне. Хороший вариант с коляской, если погода позволяет.",
    cover: ph(PH.familyWalk, "Семейная прогулка"),
    emoji: "🧸",
    tint: "#FFF0B3",
    start: "10:00",
    moods: ["calm", "outdoor"],
    interests: ["nature"],
    ageOverride: [0, 4],
    steps: [
      { slug: "park-gorkogo", duration: 75, travel: 10 },
      { slug: "muzeon", duration: 50 },
    ],
  },
  {
    slug: "bolshoy-pohod-v-centr",
    title: "Большой поход в центр",
    tagline: "Зарядье, Детский магазин и большой книжный",
    description:
      "Начинаем в Зарядье, затем идём к Центральному Детскому Магазину и заканчиваем маршрут в «Библио-Глобусе».",
    cover: ph(PH.parkGreen, "Прогулка по центру"),
    emoji: "🌉",
    tint: "#DCE8FF",
    start: "11:00",
    moods: ["surprise", "outdoor", "calm"],
    interests: ["nature", "construction", "fairy"],
    steps: [
      { slug: "park-zaryadye", duration: 75, travel: 20 },
      { slug: "centralny-detsky-magazin", duration: 75, travel: 10 },
      { slug: "biblio-globus", duration: 45 },
    ],
  },
  {
    slug: "energiya-na-maksimum",
    title: "Энергия и высота",
    tagline: "Игровой парк и вид на Москву-Сити",
    description:
      "Сначала активная часть в Кидзании, затем меняем ритм и смотрим на город со смотровой площадки PANORAMA360.",
    cover: ph(PH.indoorPlay, "Активный семейный день"),
    emoji: "🤸",
    tint: "#CDEBFF",
    start: "13:00",
    moods: ["energy", "surprise"],
    interests: ["sport", "construction"],
    steps: [
      { slug: "kidzania-aviapark", duration: 120, travel: 20 },
      { slug: "panorama360-federation", duration: 60 },
    ],
  },
  {
    slug: "tvorcheskaya-subbota",
    title: "Творческая суббота",
    tagline: "Искусство, скульптуры и прогулка",
    description:
      "Начинаем с Третьяковской галереи, затем идём в Музеон и заканчиваем день прогулкой по Парку Горького.",
    cover: ph(PH.girlPainting, "Творческий день"),
    emoji: "🎨",
    tint: "#FFE3EE",
    start: "11:00",
    moods: ["creative", "calm", "learn"],
    interests: ["drawing", "nature"],
    steps: [
      { slug: "tretyakovka-lavrushinsky", duration: 120, travel: 20 },
      { slug: "muzeon", duration: 60, travel: 10 },
      { slug: "park-gorkogo", duration: 60 },
    ],
  },
  /* ── выезды за город: «Москва + область»; дорога от Москвы считается на карточке и странице ── */
  {
    slug: "arkhangelskoe-i-tekhnika",
    title: "Техника и усадьба",
    tagline: "Танки, паровозы и прогулка по парку над Москвой-рекой",
    description:
      "Музей техники Вадима Задорожного — автомобили, танки, самолёты и поезда, часть на открытой площадке. После — неспешная прогулка по парку усадьбы «Архангельское»: дворец на реставрации, зато аллеи и павильоны открыты.",
    cover: coverOf("muzey-tekhniki-zadorozhnogo"),
    emoji: "🚂",
    tint: "#DCE8FF",
    start: "11:30",
    moods: ["learn", "outdoor", "surprise"],
    interests: ["transport", "construction", "nature"],
    steps: [
      { slug: "muzey-tekhniki-zadorozhnogo", duration: 150, travel: 12, note: "В понедельник музей закрыт." },
      { slug: "arkhangelskoe", duration: 90, note: "Если похолодало или дождь — оставьте только музей." },
    ],
  },
  {
    slug: "istra-derevyannoe-zodchestvo",
    title: "День в Истре",
    tagline: "Деревянное зодчество, парк и лабиринты",
    description:
      "В музее «Новый Иерусалим» детям интереснее всего деревянное зодчество в парке: часовня, крестьянская усадьба и ветряная мельница. Потом — Истринский парк с площадками и каруселями, а в дождь или холод — лабиринты и батуты «Лаки Лама».",
    cover: coverOf("muzey-novy-ierusalim"),
    emoji: "🛖",
    tint: "#E3F1D6",
    start: "11:30",
    moods: ["learn", "outdoor", "energy"],
    interests: ["construction", "nature", "transport"],
    ageOverride: [4, 10],
    steps: [
      { slug: "muzey-novy-ierusalim", duration: 120, travel: 8, note: "В понедельник музей закрыт." },
      { slug: "istrinsky-park-kultury", duration: 45, travel: 3, note: "Площадки и карусели — на воздухе, при дожде пропустите." },
      { slug: "lucky-llama-istra", duration: 90 },
    ],
  },
  {
    slug: "zvenigorod-tri-muzeya",
    title: "Звенигород: три музея",
    tagline: "Пряники, Lego и советское детство",
    description:
      "Три небольших музея в одном городе: чаепитие и мастер-класс по пряникам, музей Lego с интерактивным городом и «Назад в СССР» с вещами и игрушками времён бабушек и дедушек. Всё под крышей — день подходит и для дождя.",
    cover: coverOf("muzey-lego-lets-go-zvenigorod"),
    emoji: "🧱",
    tint: "#EEE5FE",
    start: "11:00",
    moods: ["learn", "creative", "calm"],
    interests: ["construction", "cooking", "science"],
    steps: [
      { slug: "muzey-russkogo-deserta-zvenigorod", duration: 90, travel: 5 },
      { slug: "muzey-nazad-v-sssr-zvenigorod", duration: 60, travel: 8 },
      { slug: "muzey-lego-lets-go-zvenigorod", duration: 90, note: "Музей Lego открыт с четверга по воскресенье, на экскурсию лучше записаться заранее." },
    ],
  },
  {
    slug: "kolomna-kreml-i-pastila",
    title: "Коломна: кремль и пастила",
    tagline: "Крепость, театрализованная экскурсия и музей игрушек",
    description:
      "Поездка на день: белокаменный кремль с башнями, театрализованная экскурсия с дегустацией коломенской пастилы и маленький Музей любимой игрушки в соседних кварталах Старой Коломны.",
    cover: coverOf("kolomna-kreml"),
    emoji: "🏰",
    tint: "#FFE6B8",
    start: "12:30",
    moods: ["learn", "creative", "surprise"],
    interests: ["fairy", "cooking"],
    steps: [
      { slug: "kolomna-kreml", duration: 120, travel: 10 },
      { slug: "kolomna-pastila-muzey", duration: 90, travel: 4, note: "Музей пастилы принимает группами по записи — запишитесь заранее." },
      { slug: "kolomna-muzey-lyubimoy-igrushki", duration: 45 },
    ],
  },
];

export const adventures: Adventure[] = seeds.map((s, i) => {
  const stepPlaces = s.steps.map((st) => {
    const place = placeBySlug.get(st.slug);
    if (!place) throw new Error(`Adventure ${s.slug}: unknown or unpublished place ${st.slug}`);
    return { ...st, place };
  });
  const plan = buildPlan(
    stepPlaces.map((st) => ({ place: st.place, duration: st.duration, travelOverride: st.travel })),
    { key: s.slug, title: s.title, start: s.start, transport: "transit" }
  );
  const weather: WeatherTag[] = plan.rainProof ? ["rain", "cold", "any"] : ["sun", "any"];
  return {
    id: `a${String(i + 1).padStart(2, "0")}`,
    slug: s.slug,
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    cover_image: s.cover,
    tint: s.tint,
    emoji: s.emoji,
    age_min: s.ageOverride?.[0] ?? plan.ageMin,
    age_max: s.ageOverride?.[1] ?? plan.ageMax,
    estimated_duration: plan.totalMinutes,
    estimated_budget: plan.budget,
    distance_km: plan.distanceKm,
    weather_tags: weather,
    interest_tags: s.interests,
    moods: s.moods,
    start_time: s.start,
    steps: stepPlaces.map((st, idx) => ({
      place_id: st.place.id,
      position: idx + 1,
      recommended_duration: st.duration,
      travel_time_to_next: st.travel,
      note: st.note,
    })),
  };
});

export const adventureBySlug = new Map(adventures.map((a) => [a.slug, a]));
