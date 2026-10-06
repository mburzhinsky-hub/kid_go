/**
 * Демо-данные: пример автора и его подборки из мест, которые уже есть в каталоге.
 * Это ТОЛЬКО пример страницы автора — код нигде не опирается на конкретного человека или ник:
 * любой пользователь создаёт такие же подборки в конструкторе, а в проде этот файл заменяется таблицами БД.
 * Заметки — практические советы, выведенные из карточек мест (возраст, запись, гардероб, цена), без выдуманных историй.
 */
import type { Collection, CollectionItem, CreatorProfile, User } from "./types";

const T0 = "2026-09-20T09:00:00.000Z";

export const SEED_USERS: User[] = [
  { id: "u-weekend-parents", name: "Родители на выходных", username: "weekend-parents", avatar: "🧸", type: "CREATOR", bio: "Пример автора подборок" },
];

export const SEED_CREATORS: CreatorProfile[] = [
  {
    user_id: "u-weekend-parents",
    display_name: "Родители на выходных",
    username: "weekend-parents",
    bio: "Это пример страницы автора: так выглядят профиль и подборки родителей, которые делятся любимыми местами для детей. Создайте свою — это занимает пару минут.",
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
      ["eksperimentanium", "Здесь всё можно трогать, а по расписанию бывают шоу — сверьтесь на входе. Есть гардероб и пеленальная; закладывайте часа два."],
      ["paleontologichesky-muzey", "Настоящие скелеты динозавров. На осмотр хватает полутора часов, гардероб есть."],
      ["moskvarium", "Нужна запись заранее. Внутри есть кафе, так что можно совместить с обедом."],
      ["joki-joya", "Игровой парк в торговом центре: лабиринты и батуты. Подходит с года, рядом есть кафе."],
      ["skazochny-les", "Игровая зона плюс кафе — можно и поиграть, и пообедать на месте. Подходит с года."],
      ["moskovsky-planetariy", "Нужна запись заранее. Кино под куполом лучше выбирать с 4 лет."],
      ["darvinovsky-muzey", "Интерактив и квесты, от 3 лет. Гардероб есть."],
    ],
  }),
  make(U, {
    id: "col-favorites",
    slug: "favorites",
    title: "Наши любимые места с детьми",
    description: "Проверенная классика на весь день: зоопарк, сады, наука и вкусный перекус рядом.",
    age: [2, 10],
    cover: "moskovsky-zoopark",
    items: [
      ["moskovsky-zoopark", "Дети до 7 лет — бесплатно. Закладывайте полдня и берите воду."],
      ["kolomenskoe", "Яблоневые сады и просторные лужайки для пикника; прогулка бесплатная."],
      ["eksperimentanium", "Музей науки, где всё можно трогать. Есть гардероб."],
      ["park-sokolniki", "Бесплатный парк с площадками и прокатом."],
      ["vdnh", "Колесо обозрения и фонтаны. Рядом блинная «Ладушки» — удобно для перекуса."],
      ["kafe-ponchik", "Блины, пончики и игровая комната, пока взрослые пьют кофе."],
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
      ["moskvarium", "Океанариум с шоу. Нужна запись заранее."],
      ["moskovsky-zoopark", "Дети до 7 лет — бесплатно, на осмотр уйдёт полдня."],
      ["park-zaryadye", "Парящий мост и ледяная пещера. Вход в парк бесплатный."],
      ["akvapark-volna", "Детский аквапарк с тёплой водой, подходит с 2 лет."],
      ["tsaritsyno-park", "Пруды, катамараны и четыре детские площадки; есть комната матери."],
      ["muzey-kosmonavtiki", "Ракеты, скафандры и Белка со Стрелкой. Лучше с 5 лет."],
    ],
  }),
  make(U, {
    id: "col-kids-cafes",
    slug: "kids-cafes",
    title: "Кафе, где детям не скучно",
    description: "Игровые уголки, мастер-классы и настолки: пока ждёте заказ, ребёнок занят.",
    age: [1, 10],
    cover: "kafe-ponchik",
    items: [
      ["kafe-ponchik", "Игровая комната и пеленальная, в меню блины и пончики."],
      ["kafe-zelyony-slon", "Тихое семейное кафе у зоопарка с детским уголком."],
      ["piccerija-malenkiy-shef", "Пицца и мастер-классы для детей от 3 лет."],
      ["kofeynya-sovushka", "Какао, булочки и настолки — подойдёт, если ребёнок не любит ждать."],
      ["kafe-oblaka", "Обед с видом на Кремль, есть детское меню и терраса."],
      ["blinnaya-ladushki", "Блины и сырники на ВДНХ, недорого и быстро."],
      ["kafe-morozhenoe-plombir", "Сорок вкусов мороженого — удобно закончить прогулку."],
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
      ["piratskaya-ploshchadka", "Большая деревянная площадка с песочницей, подходит с 2 до 10 лет."],
      ["park-gorkogo", "Набережная и прокат рядом, прогулка бесплатная."],
      ["neskuchny-sad", "Тихий старинный парк над рекой, рядом с парком Горького."],
      ["muzeon", "Скульптуры под открытым небом у набережной."],
      ["park-sokolniki", "Площадки и аллеи, велопрокат — по желанию."],
      ["izmailovsky-park", "Лесопарк с прудами, где легко найти тихое место для пикника."],
      ["park-druzhby", "Пять детских площадок и пруды."],
    ],
  }),
];
