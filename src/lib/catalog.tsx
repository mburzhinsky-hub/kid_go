import type { ComponentType, SVGProps } from "react";
import type { CategoryId, InterestId, PlaceType } from "@/lib/types";
import {
  IconStar, IconTree, IconSlide, IconMuseum, IconWaves, IconCafe, IconPaw, IconBag,
  GlyphSparkle, GlyphClock, GlyphRain, GlyphTreeWalk, GlyphPizza, GlyphGift, GlyphHeart, GlyphSmile,
} from "@/components/icons/brand-icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface CategoryDef {
  id: CategoryId | "all";
  label: string;
  short: string;
  name: string; // в единственном числе для подписей
  bg: string;
  fg: string;
  Icon: Icon;
}

/** Палитра категорий снята с референса. */
export const CATEGORIES: CategoryDef[] = [
  { id: "all", label: "Все", short: "Все", name: "Все места", bg: "#FFC21A", fg: "#FFFFFF", Icon: IconStar },
  { id: "park", label: "Парки", short: "Парки", name: "Парк", bg: "#E4F4DD", fg: "#22A33C", Icon: IconTree },
  { id: "play", label: "Площадки", short: "Площадки", name: "Игровое пространство", bg: "#FFE3E8", fg: "#F5334F", Icon: IconSlide },
  { id: "museum", label: "Музеи", short: "Музеи", name: "Музей", bg: "#EEE5FE", fg: "#7A3DF0", Icon: IconMuseum },
  { id: "active", label: "Активный отдых", short: "Активное", name: "Активный отдых", bg: "#DAEEFB", fg: "#1EA3F0", Icon: IconWaves },
  { id: "animals", label: "Животные", short: "Животные", name: "Животные", bg: "#FFEFCF", fg: "#F29A0B", Icon: IconPaw },
  { id: "cafe", label: "Кафе", short: "Кафе", name: "Кафе", bg: "#FFE3D4", fg: "#FF6A2B", Icon: IconCafe },
  { id: "shop", label: "Магазины", short: "Магазины", name: "Магазин", bg: "#FFE4F1", fg: "#FF2E88", Icon: IconBag },
];

export const categoryDef = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

const PLACE_TYPE_NAMES: Partial<Record<PlaceType, string>> = {
  park: "Парк",
  play_center: "Игровое пространство",
  museum: "Музей",
  active: "Активный отдых",
  zoo: "Зоопарк",
  aquarium: "Океанариум",
  cafe: "Кафе",
  restaurant: "Ресторан",
  shop: "Магазин",
  bookstore: "Книжный",
  theatre: "Театр",
  circus: "Цирк",
  workshop: "Мастерская",
  landmark: "Достопримечательность",
  heritage: "Усадьба / музей-заповедник",
  food_hall: "Фуд-холл",
  ice_rink: "Каток",
  waterpark: "Аквапарк",
  other: "Место",
};

export const placeTypeName = (type?: PlaceType) => type ? PLACE_TYPE_NAMES[type] : undefined;

export interface Scenario {
  id: string;
  label: string;
  bg: string;
  bubble: string;
  Glyph?: Icon;
  emoji?: string;
  href: string;
}

const R = "/planner/results";
/** «Что хочется сегодня?» — один тап до готового дня. */
export const SCENARIOS: Scenario[] = [
  { id: "cool", label: "Куда-нибудь классное", bg: "#FDE7F0", bubble: "#FFD1E5", Glyph: GlyphSparkle, href: `${R}?mood=surprise&duration=mid&from=cool` },
  { id: "short", label: "На пару часов", bg: "#E6F6E6", bubble: "#CDEFD2", Glyph: GlyphClock, href: `${R}?mood=surprise&duration=short&from=short` },
  { id: "rain", label: "Если дождь", bg: "#E2EEFF", bubble: "#C9DEFF", Glyph: GlyphRain, href: `${R}?mood=surprise&duration=mid&weather=rain&from=rain` },
  { id: "walk", label: "Погулять", bg: "#E8F6E1", bubble: "#D2EFC6", Glyph: GlyphTreeWalk, href: `${R}?mood=outdoor&duration=mid&weather=sun&from=walk` },
  { id: "playeat", label: "Поиграть и поесть", bg: "#FFF1D9", bubble: "#FFE2AE", Glyph: GlyphPizza, href: `${R}?mood=energy&duration=mid&food=1&from=playeat` },
  { id: "joy", label: "Порадовать ребёнка", bg: "#F3E8FF", bubble: "#E4D0FF", Glyph: GlyphGift, href: `${R}?mood=surprise&duration=half&budget=any&from=joy` },
  { id: "free", label: "Бесплатно", bg: "#E5F7EC", bubble: "#C8EED6", Glyph: GlyphHeart, href: `${R}?mood=outdoor&duration=mid&budget=free&weather=sun&from=free` },
  { id: "easy", label: "Без сложностей", bg: "#FFF3D6", bubble: "#FFE7A8", Glyph: GlyphSmile, href: `${R}?mood=calm&duration=short&near=1&from=easy` },
];

export const INTERESTS: { id: InterestId; label: string; emoji: string; bg: string; fg: string }[] = [
  { id: "dinosaurs", label: "Динозавры", emoji: "🦖", bg: "#E4F4DD", fg: "#1F8F35" },
  { id: "animals", label: "Животные", emoji: "🐾", bg: "#FFEFCF", fg: "#B86E00" },
  { id: "transport", label: "Транспорт", emoji: "🚂", bg: "#DAEEFB", fg: "#0F7FC6" },
  { id: "sport", label: "Спорт", emoji: "⚽", bg: "#FFE3E8", fg: "#D61F3D" },
  { id: "drawing", label: "Рисование", emoji: "🎨", bg: "#FFE4F1", fg: "#D4146D" },
  { id: "music", label: "Музыка", emoji: "🎵", bg: "#EEE5FE", fg: "#6327D9" },
  { id: "science", label: "Наука", emoji: "🔬", bg: "#E2EEFF", fg: "#1F62E0" },
  { id: "cooking", label: "Готовка", emoji: "🧁", bg: "#FFE3D4", fg: "#D24E12" },
  { id: "construction", label: "Конструкторы", emoji: "🧱", bg: "#FFF3D6", fg: "#A06A00" },
  { id: "nature", label: "Природа", emoji: "🌿", bg: "#E5F7EC", fg: "#16803E" },
  { id: "space", label: "Космос", emoji: "🪐", bg: "#E9E7FF", fg: "#4B3BD6" },
  { id: "fairy", label: "Сказки", emoji: "🧚", bg: "#FDE7F0", fg: "#C2186B" },
];

export const interestDef = (id: InterestId) => INTERESTS.find((i) => i.id === id)!;

export const MOODS = [
  { id: "energy", label: "Выплеснуть энергию", emoji: "⚡", bg: "#FFE3E8" },
  { id: "creative", label: "Что-нибудь творческое", emoji: "🎨", bg: "#FFE4F1" },
  { id: "learn", label: "Познавательное", emoji: "🔬", bg: "#E2EEFF" },
  { id: "outdoor", label: "На воздух", emoji: "🌳", bg: "#E4F4DD" },
  { id: "calm", label: "Спокойно", emoji: "🍃", bg: "#FFF3D6" },
  { id: "surprise", label: "Удивите нас", emoji: "✨", bg: "#EEE5FE" },
] as const;

export const DURATIONS = [
  { id: "short", label: "1–2 часа", hint: "быстро и без усталости", emoji: "⏱" },
  { id: "mid", label: "3–4 часа", hint: "самое то для выходного", emoji: "☀️" },
  { id: "half", label: "Полдня", hint: "с обедом и прогулкой", emoji: "🌤" },
  { id: "day", label: "Весь день", hint: "большое приключение", emoji: "🗓" },
] as const;

export const BUDGETS = [
  { id: "free", label: "Бесплатно", emoji: "💚" },
  { id: "2000", label: "до 2 000 ₽", emoji: "👛" },
  { id: "5000", label: "до 5 000 ₽", emoji: "💳" },
  { id: "any", label: "Неважно", emoji: "🎉" },
] as const;

export const TRANSPORTS = [
  { id: "walk", label: "Пешком", emoji: "🚶" },
  { id: "car", label: "На машине", emoji: "🚗" },
  { id: "transit", label: "Общественный транспорт", emoji: "🚇" },
] as const;
