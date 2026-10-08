/**
 * Демо-данные: пример автора и его подборки из мест, которые уже есть в каталоге.
 * Это ТОЛЬКО пример страницы автора — код нигде не опирается на конкретного человека или ник:
 * любой пользователь создаёт такие же подборки в конструкторе, а в проде этот файл заменяется таблицами БД.
 * Заметки — практические советы, выведенные из карточек мест (возраст, запись, гардероб, цена), без выдуманных историй.
 */
import type { Collection, CollectionItem, CreatorProfile, User } from "./types";

const T0 = "2026-09-20T09:00:00.000Z";

export const SEED_USERS: User[] = [
  { id: "u-weekend-parents", name: "Родители на выходных", username: "weekend-parents", avatar: "🧸", type: "CREATOR", bio: "Подборки от команды Kids Go" },
];

export const SEED_CREATORS: CreatorProfile[] = [
  {
    user_id: "u-weekend-parents",
    display_name: "Родители на выходных",
    username: "weekend-parents",
    bio: "Подборки от команды Kids Go: проверенные места на выходные, дождливые дни и бесплатные прогулки. Соберите и свою — это займёт пару минут.",
    avatar: "🧸",
    tint: "#FFE4F1",
    featured: true,
    status: "APPROVED",
    city: "Москва",
  },
];

type Draft = {
  id: string;
  slug: string;
  title: string;
  description: string;
  age: [number, number];
  cover: string;
  items: [slug: string, note?: string][];
};

const make = (user_id: string, d: Draft): Collection => ({
  id: d.id,
  user_id,
  title: d.title,
  slug: d.slug,
  description: d.description,
  cover: { kind: "place", slug: d.cover },
  city: "Москва",
  visibility: "PUBLIC",
  status: "PUBLISHED",
  age_min: d.age[0],
  age_max: d.age[1],
  created_at: T0,
  updated_at: T0,
  published_at: T0,
  items: d.items.map(
    ([place_id, creator_note], position): CollectionItem => ({ id: `${d.id}-${position + 1}`, collection_id: d.id, place_id, position, creator_note })
  ),
});

const U = "u-weekend-parents";

export const SEED_COLLECTIONS: Collection[] = [
  make(U, {
    id: "col-rainy-day",
    slug: "rainy-day",
    title: "7 мест, куда сходить с ребёнком в дождь",
    description: "Всё под крышей: музеи, где можно трогать, игровые парки и океанариум. У каждого места указаны возраст, запись и гардероб — часы и билеты лучше сверить перед выходом.",
    age: [3, 8],
    cover: "eksperimentanium",
    items: [
      ["eksperimentanium", "Здесь всё можно трогать. Закладывайте часа два; расписание шоу и билеты сверьте на сайте музея."],
      ["paleontologichesky-muzey", "Настоящие скелеты динозавров. На осмотр хватает полутора часов."],
      ["moskvarium", "Океанариум под крышей. Билеты лучше купить заранее; по понедельникам закрыто."],
      ["kidzania-aviapark", "Город профессий для детей: можно «поработать» и заработать. Лучше с 4–5 лет, билеты — заранее."],
      ["littles-kids-play-cafe", "Кафе, где игровые зоны вокруг столиков: можно спокойно пообедать и видеть ребёнка."],
      ["moskovsky-planetariy", "Кино под куполом лучше выбирать с 4 лет — сеансы смотрите на сайте."],
      ["darvinovsky-muzey", "Интерактив и квесты, подходит с 3 лет."],
    ],
  }),
  make(U, {
    id: "col-favorites",
    slug: "favorites",
    title: "Наши любимые места с детьми",
    description: "Классика на весь день: зоопарк, сады, наука и перекус рядом.",
    age: [2, 10],
    cover: "moskovsky-zoopark",
    items: [
      ["moskovsky-zoopark", "Закладывайте полдня и берите воду."],
      ["kolomenskoe", "Яблоневые сады и просторные лужайки для пикника; прогулка бесплатная."],
      ["eksperimentanium", "Музей науки, где всё можно трогать."],
      ["park-sokolniki", "Парк с площадками, аллеями и прокатом."],
      ["vdnh", "Колесо обозрения и фонтаны — удобно совместить с перекусом."],
      ["depo-food-hall", "Фуд-холл с детским меню: у каждого в семье найдётся своё."],
    ],
  }),
  make(U, {
    id: "col-weekend",
    slug: "weekend",
    title: "Куда сходить всей семьёй в выходные",
    description: "Места, где найдётся занятие и малышу, и школьнику, и взрослым.",
    age: [2, 12],
    cover: "vdnh",
    items: [
      ["vdnh", "Колесо обозрения, фонтаны и павильоны — на весь день."],
      ["moskvarium", "Океанариум с шоу. Билеты лучше купить заранее; по понедельникам закрыто."],
      ["moskovsky-zoopark", "На осмотр уйдёт полдня."],
      ["park-zaryadye", "Парящий мост и ледяная пещера. Вход в парк бесплатный."],
      ["akvapark-moreon", "Аквапарк с зонами для малышей и для школьников; тарифы смотрите на сайте."],
      ["tsaritsyno-park", "Пруды, просторные аллеи и дворцовый ансамбль."],
      ["muzey-kosmonavtiki", "Ракеты, скафандры и Белка со Стрелкой. Лучше с 5 лет."],
    ],
  }),
  make(U, {
    id: "col-kids-cafes",
    slug: "kids-cafes",
    title: "Кафе, где детям не скучно",
    description: "Игровые комнаты, студии и аниматоры: пока ждёте заказ, ребёнок занят.",
    age: [1, 10],
    cover: "littles-kids-play-cafe",
    items: [
      ["littles-kids-play-cafe", "Игровые зоны по периметру зала: родители сидят за столиком и видят ребёнка."],
      ["jooie-presnya", "Игровая комната, детские мероприятия и отдельное детское меню."],
      ["anderson-ostrovityanova", "Игровая комната с аниматором и детское меню."],
      ["dream-kids", "Игровая площадка, творческая и кулинарная студии."],
      ["kids-castle-mitino", "Большой детский центр с батутами и горками; ресторан внутри."],
      ["iyul-detyam", "Двухуровневая игровая и аниматоры — для малышей до 7 лет."],
      ["local-kids-vnukovo", "Игровые пространства и отдельная детская комната; отмечают бейбиситтеров."],
    ],
  }),
  make(U, {
    id: "col-free",
    slug: "free",
    title: "Куда сходить бесплатно",
    description: "Парки и площадки, где не нужны билеты. Хорошо, когда хочется выйти из дома без трат.",
    age: [1, 10],
    cover: "piratskaya-ploshchadka",
    items: [
      ["piratskaya-ploshchadka", "Площадка «Стройка»: экскаватор, подъёмный кран, лазалки и песочница; подходит с 2 до 10 лет."],
      ["park-gorkogo", "Набережная и прокат рядом, прогулка бесплатная."],
      ["neskuchny-sad", "Тихий старинный парк над рекой, рядом с парком Горького."],
      ["muzeon", "Скульптуры под открытым небом у набережной."],
      ["park-sokolniki", "Площадки и аллеи, велопрокат — по желанию."],
      ["izmailovsky-park", "Лесопарк с прудами, где легко найти тихое место для пикника."],
      ["park-druzhby", "Пять детских площадок и пруды."],
    ],
  }),
];
