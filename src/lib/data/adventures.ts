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
  recommend: number;
  steps: { slug: string; duration: number; travel?: number; note?: string }[];
  ageOverride?: [number, number];
}

const seeds: AdventureSeed[] = [
  {
    slug: "den-dinozavrov",
    title: "День динозавров",
    tagline: "Три классных места для насыщенного дня с ребёнком",
    description:
      "Сначала — настоящие скелеты тираннозавров и квест по залам, потом пончики и какао в кафе с игровой, а в финале — лавка, где можно выбрать своего динозавра на память.",
    cover: ph(PH.dinoHall, "Скелет динозавра в музее"),
    emoji: "🦖",
    tint: "#E5D9FF",
    start: "12:30",
    moods: ["learn", "surprise", "calm"],
    interests: ["dinosaurs", "science"],
    recommend: 94,
    ageOverride: [4, 7],
    steps: [
      { slug: "paleontologichesky-muzey", duration: 90, travel: 6, note: "Возьмите на кассе детский квест «Найди тираннозавра»" },
      { slug: "kafe-ponchik", duration: 60, travel: 4, note: "Столик у стекла — видно игровую" },
      { slug: "igrushechnaya-lavka-dinozavrik", duration: 40, note: "Наборы раскопок — лучший сувенир" },
    ],
  },
  {
    slug: "kosmicheskaya-subbota",
    title: "Космическая суббота",
    tagline: "Ракеты, блины и колесо обозрения",
    description:
      "Запускаем ракету в центре управления полётами, заправляемся блинами и смотрим на Москву с высоты колеса обозрения на ВДНХ.",
    cover: ph(PH.rocketStatue, "Монумент покорителям космоса"),
    emoji: "🚀",
    tint: "#DCE8FF",
    start: "11:00",
    moods: ["learn", "surprise"],
    interests: ["space", "science", "transport"],
    recommend: 92,
    steps: [
      { slug: "muzey-kosmonavtiki", duration: 90, note: "Не пропустите симулятор стыковки" },
      { slug: "blinnaya-ladushki", duration: 50 },
      { slug: "vdnh", duration: 60, note: "Колесо обозрения — 15 минут ходьбы по главной аллее" },
    ],
  },
  {
    slug: "zhirafy-i-syrniki",
    title: "Жирафы и сырники",
    tagline: "Зоопарк с утра, обед в кафе через дорогу",
    description:
      "Утро у жирафов и красных панд, кормление пингвинов по расписанию — а потом сырники и суп-пюре в тихом семейном кафе в трёх минутах от выхода.",
    cover: ph(PH.giraffe, "Жираф в зоопарке"),
    emoji: "🦒",
    tint: "#FFE6B8",
    start: "10:00",
    moods: ["outdoor", "calm", "learn"],
    interests: ["animals", "nature"],
    recommend: 97,
    steps: [
      { slug: "moskovsky-zoopark", duration: 150, travel: 4, note: "Кормление пингвинов в 11:30" },
      { slug: "kafe-zelyony-slon", duration: 60 },
    ],
  },
  {
    slug: "skazka-ryadom",
    title: "Сказка рядом",
    tagline: "Домики на деревьях и шарики до потолка",
    description:
      "Два часа в игровом лесу с горками и шоу, а потом спокойный обед с детским меню. Подходит даже для малышей — и спасает в любую погоду.",
    cover: ph(PH.slidesBallpit, "Горки над сухим бассейном"),
    emoji: "🌳",
    tint: "#FFD6E4",
    start: "11:00",
    moods: ["energy", "surprise"],
    interests: ["fairy", "sport"],
    recommend: 95,
    steps: [
      { slug: "skazochny-les", duration: 120, note: "Мини-шоу с аниматорами — каждый час" },
      { slug: "kafe-zelyony-slon", duration: 50 },
    ],
  },
  {
    slug: "podvodny-mir",
    title: "Подводный мир",
    tagline: "Тоннель с акулами и шоу дельфинов",
    description:
      "Проходим подводным тоннелем, гладим скатов, смотрим шоу дельфинов — и идём за блинами. Если погода позволит, финал — прогулка к фонтанам.",
    cover: ph(PH.dolphinsLeap, "Дельфины в прыжке"),
    emoji: "🐬",
    tint: "#CDEBFF",
    start: "12:00",
    moods: ["surprise", "learn", "calm"],
    interests: ["animals", "nature"],
    recommend: 91,
    steps: [
      { slug: "moskvarium", duration: 150, note: "Билеты на шоу — заранее онлайн" },
      { slug: "blinnaya-ladushki", duration: 50 },
    ],
  },
  {
    slug: "dozhdiku-nazlo",
    title: "Дождику назло",
    tagline: "Наука, пицца и конструкторы — всё под крышей",
    description:
      "Гигантские мыльные пузыри и шоу с жидким азотом, потом дети сами готовят пиццу, а в конце — собираем модели в конструкторской. Зонтик не понадобится.",
    cover: ph(PH.plasmaBall, "Ребёнок у плазменного шара"),
    emoji: "🧪",
    tint: "#E5D9FF",
    start: "12:00",
    moods: ["learn", "creative", "surprise"],
    interests: ["science", "cooking", "construction"],
    recommend: 96,
    steps: [
      { slug: "eksperimentanium", duration: 120 },
      { slug: "piccerija-malenkiy-shef", duration: 75, note: "Мастер-класс по пицце — каждые полчаса" },
      { slug: "konstruktorskaya-kirpichik", duration: 40 },
    ],
  },
  {
    slug: "zolotye-sokolniki",
    title: "Золотые Сокольники",
    tagline: "Листья, верёвочные мосты и какао",
    description:
      "Гуляем по золотым аллеям, лезем по трассам в кронах деревьев и греемся какао с маршмеллоу в маленькой кофейне у входа.",
    cover: ph(PH.autumnPath, "Осенняя аллея"),
    emoji: "🍂",
    tint: "#FFE1C2",
    start: "11:30",
    moods: ["outdoor", "energy"],
    interests: ["nature", "sport"],
    recommend: 93,
    steps: [
      { slug: "park-sokolniki", duration: 60 },
      { slug: "panda-park-sokolniki", duration: 90 },
      { slug: "kofeynya-sovushka", duration: 40 },
    ],
  },
  {
    slug: "besplatny-den-u-reki",
    title: "Бесплатный день у реки",
    tagline: "Набережная, пиратский корабль и мороженое",
    description:
      "Гуляем по набережной Парка Горького, штурмуем деревянный пиратский корабль в Нескучном саду и награждаем себя мороженым. Почти без трат.",
    cover: ph(PH.woodenPlayground, "Деревянная площадка"),
    emoji: "🏴‍☠️",
    tint: "#CFEFC4",
    start: "12:00",
    moods: ["outdoor", "energy", "calm"],
    interests: ["nature", "sport", "fairy"],
    recommend: 90,
    steps: [
      { slug: "park-gorkogo", duration: 60 },
      { slug: "piratskaya-ploshchadka", duration: 75 },
      { slug: "kafe-morozhenoe-plombir", duration: 30 },
    ],
  },
  {
    slug: "myagkiy-den-dlya-malysha",
    title: "Мягкий день для малыша",
    tagline: "Сенсорная игровая, мороженое и прогулка",
    description:
      "Спокойный маршрут для детей до 4 лет: мягкая игровая без толп, перекус в кафе-мороженом и прогулка с коляской по парку — как раз к дневному сну.",
    cover: ph(PH.balls, "Разноцветные шарики"),
    emoji: "🧸",
    tint: "#FFF0B3",
    start: "10:00",
    moods: ["calm"],
    interests: ["fairy", "music"],
    recommend: 98,
    steps: [
      { slug: "myagkaya-strana-pufik", duration: 90 },
      { slug: "kafe-morozhenoe-plombir", duration: 30 },
      { slug: "park-gorkogo", duration: 50, note: "Ровные дорожки — удобно с коляской" },
    ],
  },
  {
    slug: "bolshoy-pohod-v-centr",
    title: "Большой поход в центр",
    tagline: "Парящий мост, вид на Кремль и шесть этажей игрушек",
    description:
      "Проходим по парящему мосту, обедаем с видом на Кремль и поднимаемся на смотровую площадку Детского мира. День, который запомнится надолго.",
    cover: ph(PH.parkGreen, "Парк в центре"),
    emoji: "🌉",
    tint: "#DCE8FF",
    start: "11:00",
    moods: ["surprise", "outdoor"],
    interests: ["nature", "construction", "transport"],
    recommend: 92,
    steps: [
      { slug: "park-zaryadye", duration: 75 },
      { slug: "kafe-oblaka", duration: 60 },
      { slug: "centralny-detsky-magazin", duration: 75, note: "Смотровая площадка — на 7 этаже" },
    ],
  },
  {
    slug: "energiya-na-maksimum",
    title: "Энергия на максимум",
    tagline: "Батуты, поролоновая яма и своя пицца",
    description:
      "Полтора часа прыжков, ниндзя-трасса и поролоновая яма — а потом голодные чемпионы готовят себе пиццу сами. Вечером уснут без сказки.",
    cover: ph(PH.trampolineIndoor, "Батутный зал"),
    emoji: "🤸",
    tint: "#CDEBFF",
    start: "13:00",
    moods: ["energy"],
    interests: ["sport", "cooking"],
    recommend: 93,
    steps: [
      { slug: "batutny-centr-pryg-skok", duration: 90 },
      { slug: "piccerija-malenkiy-shef", duration: 75 },
    ],
  },
  {
    slug: "tvorcheskaya-subbota",
    title: "Творческая суббота",
    tagline: "Акварель, обед и звёзды под куполом",
    description:
      "Рисуем акварелью в арт-студии, обедаем в тихом кафе и летим к звёздам в планетарии. Для тех, кто любит творить и мечтать.",
    cover: ph(PH.girlPainting, "Девочка рисует"),
    emoji: "🎨",
    tint: "#FFE3EE",
    start: "11:00",
    moods: ["creative", "calm", "learn"],
    interests: ["drawing", "space", "music"],
    recommend: 95,
    steps: [
      { slug: "masterskaya-akvarelka", duration: 60 },
      { slug: "kafe-zelyony-slon", duration: 60 },
      { slug: "moskovsky-planetariy", duration: 90, note: "Сеанс «Тайны звёзд» — для детей 4+" },
    ],
  },
];

export const adventures: Adventure[] = seeds.map((s, i) => {
  const stepPlaces = s.steps.map((st) => {
    const place = placeBySlug.get(st.slug);
    if (!place) throw new Error(`Adventure ${s.slug}: unknown place ${st.slug}`);
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
    recommend_percent: s.recommend,
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
