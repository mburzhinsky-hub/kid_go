import type { KidEvent } from "@/lib/types";
import { placeBySlug } from "./places";
import { PH, ph } from "./photos";

/**
 * Демо-афиша. Даты строятся относительно «сегодня» (по Москве),
 * чтобы блок «Что происходит сегодня» всегда был живым.
 */
const seeds = [
  { slug: "paleontologichesky-muzey", title: "Раскопки: найди своего динозавра", description: "Мастер-класс с настоящими кисточками и гипсовыми костями.", day: 0, from: "13:00", to: "14:00", age: [5, 10], price: 600, image: PH.childDinoSkull },
  { slug: "eksperimentanium", title: "Шоу с жидким азотом", description: "Замораживаем цветы, надуваем шарики холодом и пускаем облака.", day: 0, from: "15:00", to: "15:40", age: [4, 12], price: 0, image: PH.plasmaBall },
  { slug: "knizhny-chitay-ka", title: "Громкие чтения: «Пых»", description: "Читаем сказку по ролям и рисуем героев.", day: 0, from: "12:00", to: "12:45", age: [2, 6], price: 0, image: PH.childrenReading },
  { slug: "moskvarium", title: "Шоу дельфинов и косаток", description: "Главное шоу океанариума — 40 минут восторга.", day: 0, from: "17:00", to: "17:40", age: [0, 12], price: 1200, image: PH.dolphinsLeap },
  { slug: "piccerija-malenkiy-shef", title: "Пицца своими руками", description: "Колпак, фартук и пицца, которую ребёнок сделал сам.", day: 0, from: "14:30", to: "15:15", age: [4, 12], price: 790, image: PH.pizzaHand },
  { slug: "park-gorkogo", title: "Фестиваль осенних поделок", description: "Мастер-классы из листьев и шишек, бесплатно для всех.", day: 1, from: "12:00", to: "17:00", age: [3, 12], price: 0, image: PH.picnicFamily },
  { slug: "moskovsky-zoopark", title: "Кормление пингвинов", description: "Смотрители рассказывают, как живут пингвины.", day: 0, from: "11:30", to: "12:00", age: [0, 12], price: 0, image: PH.giraffe },
  { slug: "masterskaya-akvarelka", title: "Рисуем осенний лес", description: "Акварель по-мокрому — получится у всех.", day: 1, from: "11:00", to: "12:00", age: [4, 12], price: 1100, image: PH.girlPainting },
];

function moscowDateISO(dayOffset: number, hhmm: string) {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(
    new Date(now.getTime() + dayOffset * 86400000)
  );
  return `${ymd}T${hhmm}:00+03:00`;
}

export function getEventsSeed(): KidEvent[] {
  return seeds.map((s, i) => {
    const place = placeBySlug.get(s.slug)!;
    return {
      id: `e${i + 1}`,
      place_id: place.id,
      title: s.title,
      description: s.description,
      start_at: moscowDateISO(s.day, s.from),
      end_at: moscowDateISO(s.day, s.to),
      age_min: s.age[0],
      age_max: s.age[1],
      price: s.price,
      tickets_url: undefined,
      image: ph(s.image, s.title),
    };
  });
}
