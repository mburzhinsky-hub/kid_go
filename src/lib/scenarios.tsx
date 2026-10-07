import type { ComponentType, SVGProps } from "react";
import type { BudgetId, DurationId, MoodId, ScenarioConstraints } from "@/lib/types";
import { isSchoolBreak } from "@/lib/school-calendar";
import { startToday, tomorrowStart } from "@/lib/day-window";
import { GlyphSparkle, GlyphClock, GlyphRain, GlyphTreeWalk, GlyphPizza, GlyphGift, GlyphHeart, GlyphSmile } from "@/components/icons/brand-icons";

/**
 * Библиотека жизненных ситуаций. Сценарий = ситуация + рецепт (параметры и ограничения для движка).
 * Главная показывает 8 самых уместных сейчас: по погоде, дню недели, времени и возрасту детей.
 */

export type ScenarioGroup = "weather" | "time" | "trip" | "party" | "occasion" | "mood" | "effort";

export const GROUP_LABEL: Record<ScenarioGroup, string> = {
  weather: "Погода и сезон",
  time: "Когда",
  trip: "За город",
  party: "Кто идёт",
  occasion: "Повод",
  mood: "Настроение",
  effort: "Бюджет и силы",
};

export interface ScenarioCtx {
  weekday: number; // 0 — пн
  hour: number;
  month: number; // 1..12
  /** Число месяца, 1..31 (нужно для каникул). */
  day: number;
  rainAllDay: boolean;
  rainLater: boolean;
  snow: boolean;
  cold: boolean;
  hot: boolean;
  sunny: boolean;
  warm: boolean;
  kidsCount: number;
  youngest: number;
  oldest: number;
  interests: string[];
  /** Включена география «Москва + область»: на главной уместны поездки за город. */
  region?: boolean;
}

export interface ScenarioDef {
  id: string;
  label: string;
  group: ScenarioGroup;
  emoji?: string;
  Glyph?: ComponentType<SVGProps<SVGSVGElement>>;
  bg: string;
  bubble: string;
  mood: MoodId;
  duration: DurationId;
  budget?: BudgetId;
  food?: boolean;
  constraints?: ScenarioConstraints;
  /** Только «сейчас»: если сегодня уже не успеть и план уехал бы на завтра, на главной не показываем («Выехали поздно»). */
  todayOnly?: boolean;
  /** Насколько уместно сейчас: 0 — не показывать на главной. */
  relevance: (c: ScenarioCtx) => number;
  /** Короткое пояснение в результатах. */
  hint?: string;
}

const C = {
  pink: ["#FDE7F0", "#FFD1E5"],
  green: ["#E6F6E6", "#CDEFD2"],
  blue: ["#E2EEFF", "#C9DEFF"],
  leaf: ["#E8F6E1", "#D2EFC6"],
  orange: ["#FFF1D9", "#FFE2AE"],
  purple: ["#F3E8FF", "#E4D0FF"],
  mint: ["#E5F7EC", "#C8EED6"],
  yellow: ["#FFF3D6", "#FFE7A8"],
  sky: ["#DAEEFB", "#BFE2F8"],
  peach: ["#FFE3D4", "#FFCDB3"],
} as const;
const col = (k: keyof typeof C) => ({ bg: C[k][0], bubble: C[k][1] });

const H = (h: number) => h * 60;
/** Попадает ли дата (месяц, число) в период [от; до] — период может переходить через Новый год. */
const between = (m: number, d: number, from: [number, number], to: [number, number]) => {
  const v = m * 100 + d;
  const a = from[0] * 100 + from[1];
  const b = to[0] * 100 + to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};

/** Закат в Москве (час, дробью) на 1-е число месяца: нужен, чтобы не звать гулять по парку в темноте. */
const SUNSET = [15.9, 16.9, 17.9, 19.5, 20.8, 21.0, 21.2, 20.8, 19.8, 18.2, 16.8, 15.6, 15.9];
const sunsetHour = (m: number, d: number) => SUNSET[m - 1] + ((SUNSET[m] - SUNSET[m - 1]) * (d - 1)) / 30;
/** Хватает ли светлого времени на прогулку: старт — через час от «сейчас», нужно `need` часов до заката. */
const daylit = (c: { month: number; day: number; hour: number }, need = 2) => sunsetHour(c.month, c.day) - (c.hour + 1) >= need;

export const SCENARIO_LIBRARY: ScenarioDef[] = [
  /* ── погода ── */
  { id: "rain", label: "Если дождь", group: "weather", Glyph: GlyphRain, ...col("blue"), mood: "surprise", duration: "mid", constraints: { indoorOnly: true }, relevance: (c) => (c.rainAllDay ? 12 : c.rainLater ? 6 : 1.5), hint: "Всё под крышей" },
  { id: "before-rain", label: "Успеть до дождя", group: "weather", emoji: "⛅", ...col("sky"), mood: "outdoor", duration: "mid", constraints: { outdoorPreferred: true, minStops: 2 }, relevance: (c) => (c.rainLater && !c.rainAllDay ? 11 : 0), hint: "Гуляем, пока сухо, потом — под крышу" },
  { id: "frost", label: "Мороз — греемся", group: "weather", emoji: "🧣", ...col("purple"), mood: "surprise", duration: "short", food: true, constraints: { indoorOnly: true }, relevance: (c) => (c.cold ? 10 : 0), hint: "Тёплые места и горячий шоколад" },
  { id: "first-snow", label: "Играть в снегу", group: "weather", emoji: "☃️", ...col("sky"), mood: "outdoor", duration: "short", constraints: { onlyCategories: ["park"], outdoorPreferred: true }, relevance: (c) => (c.snow ? (c.cold ? 6 : 9) : 0), hint: "Парки, где можно погулять по снегу" },
  { id: "heat", label: "Жара — в прохладу", group: "weather", emoji: "🌊", ...col("sky"), mood: "calm", duration: "mid", constraints: { indoorOnly: true, preferCategories: ["museum", "animals"] }, relevance: (c) => (c.hot ? 10 : 0), hint: "Прохладные музеи и океанариум" },
  { id: "walk", label: "Погулять", group: "weather", Glyph: GlyphTreeWalk, ...col("leaf"), mood: "outdoor", duration: "mid", constraints: { outdoorPreferred: true, onlyCategories: ["park"] }, relevance: (c) => (c.rainAllDay || c.cold || c.hot || !daylit(c, 2.5) ? 0 : (c.sunny ? 8 : 4) * (between(c.month, c.day, [9, 15], [10, 25]) ? 0.5 : 1)) },
  { id: "golden-autumn", label: "Золотая осень", group: "weather", emoji: "🍂", ...col("orange"), mood: "outdoor", duration: "mid", constraints: { onlyCategories: ["park"], outdoorPreferred: true }, relevance: (c) => (between(c.month, c.day, [9, 15], [10, 25]) && daylit(c, 2.5) && !c.rainAllDay && !c.cold && !c.hot ? 7 : 0), hint: "Листья, парки и фотографии" },
  { id: "picnic", label: "Пикник", group: "weather", emoji: "🧺", ...col("green"), mood: "outdoor", duration: "short", constraints: { onlyCategories: ["park"], outdoorPreferred: true, startAt: H(11), endBy: H(18) }, relevance: (c) => (c.sunny && c.warm && !c.hot && daylit(c, 1.5) ? 7 : 0), hint: "Парк, плед и еда с собой" },
  { id: "spring", label: "Весна пришла", group: "weather", emoji: "🌷", ...col("mint"), mood: "outdoor", duration: "mid", constraints: { outdoorPreferred: true, onlyCategories: ["park", "animals"] }, relevance: (c) => ([3, 4, 5].includes(c.month) && daylit(c, 2.5) && !c.rainAllDay && !c.cold && !c.hot ? (c.sunny ? 9 : 6) : 0), hint: "Парки и фермы: просыпается природа" },
  { id: "warm-evening", label: "Тёплый вечер", group: "weather", emoji: "🌇", ...col("orange"), mood: "calm", duration: "short", food: true, constraints: { onlyCategories: ["park"], outdoorPreferred: true, minStops: 2, startAt: H(17), endBy: H(21) }, relevance: (c) => (c.month >= 5 && c.month <= 9 && c.hour >= 14 && c.hour < 19 && c.warm && !c.rainAllDay && !c.hot ? 8 : 0), hint: "Прогулка после работы и ужин" },
  { id: "winter-tale", label: "Зимняя сказка", group: "weather", emoji: "❄️", ...col("sky"), mood: "surprise", duration: "half", food: true, constraints: { preferCategories: ["park", "museum"], experiences: ["unusual", "show"] }, relevance: (c) => ([12, 1, 2].includes(c.month) ? (c.snow ? 9 : 6.5) : 0), hint: "Заснеженные парки и тёплые музеи" },
  { id: "rink", label: "На каток", group: "weather", emoji: "⛸", ...col("blue"), mood: "energy", duration: "mid", food: true, constraints: { onlyTypes: ["ice_rink"] }, relevance: (c) => ([12, 1, 2].includes(c.month) && (c.cold || c.snow) && !c.rainAllDay && (!c.kidsCount || c.youngest >= 3) ? 9 : 0), hint: "Коньки и горячий чай" },
  { id: "hot-water", label: "Вода в жару", group: "weather", emoji: "💦", ...col("sky"), mood: "energy", duration: "mid", budget: "any", food: true, constraints: { indoorOnly: true, onlyTypes: ["waterpark", "aquarium"] }, relevance: (c) => (c.hot ? 9 : 0), hint: "Аквапарк, бассейны и океанариум" },
  { id: "rain-play", label: "Дождь: игровой день", group: "weather", emoji: "🎡", ...col("purple"), mood: "energy", duration: "mid", food: true, constraints: { indoorOnly: true, preferCategories: ["play", "active"], experiences: ["playzone", "workshop"], bookingOk: true }, relevance: (c) => ((!c.kidsCount || c.youngest >= 2) && c.rainAllDay ? 9 : (!c.kidsCount || c.youngest >= 2) && c.rainLater ? 3 : 0), hint: "Под крышей: игровые и интерактивные места" },

  /* ── когда ── */
  { id: "short", label: "На пару часов", group: "time", Glyph: GlyphClock, ...col("green"), mood: "surprise", duration: "short", relevance: (c) => (c.hour >= 19 ? 6.5 : c.hour >= 15 ? 2 : 3), hint: "Недолго: час-два" },
  { id: "before-nap", label: "До дневного сна", group: "time", emoji: "😴", ...col("purple"), mood: "calm", duration: "short", constraints: { endBy: H(13), maxTravelMin: 25, quiet: true, stroller: true }, relevance: (c) => (c.kidsCount && c.youngest >= 1 && c.youngest <= 3 ? 11 : 0), hint: "Дома к 13:00" },
  { id: "morning", label: "Утро до обеда", group: "time", emoji: "🌤", ...col("yellow"), mood: "surprise", duration: "mid", constraints: { endBy: H(14) }, relevance: (c) => (c.hour < 11 ? 6 : 0) },
  { id: "breakfast-kids", label: "Завтрак с ребёнком", group: "time", emoji: "🥐", ...col("peach"), mood: "calm", duration: "short", food: true, constraints: { parentBreak: true, indoorOnly: true, onlyCategories: ["cafe"], startAt: H(10), endBy: H(12) + 30, maxTravelMin: 25 }, relevance: (c) => (c.hour < 11 ? (c.weekday >= 5 ? 8 : 6) : 0), hint: "Семейное кафе утром: поесть и дать ребёнку поиграть" },
  { id: "after-school", label: "После садика", group: "time", emoji: "🎒", ...col("orange"), mood: "energy", duration: "short", constraints: { maxTravelMin: 25, startAt: H(16), endBy: H(20) + 30 }, relevance: (c) => ((!c.kidsCount || c.youngest <= 6) && c.weekday < 5 && c.hour >= 14 && c.hour < 19 ? 9 : 0), hint: "Рядом и недолго" },
  { id: "weekday-evening", label: "Вечер буднего дня", group: "time", emoji: "🌆", ...col("blue"), mood: "calm", duration: "short", constraints: { maxTravelMin: 25, startAt: H(17), endBy: H(20) + 30 }, relevance: (c) => (c.weekday < 4 && c.hour >= 17 ? 6 : 0), hint: "После работы и школы — с 17:00" },
  { id: "friday", label: "Вечер пятницы", group: "time", emoji: "🎉", ...col("pink"), mood: "surprise", duration: "short", food: true, constraints: { startAt: H(16) + 30 }, relevance: (c) => (c.weekday === 4 && c.hour >= 14 ? 10 : 0), hint: "С 16:30, с ужином" },
  { id: "big-saturday", label: "Большая суббота", group: "time", emoji: "🗓", ...col("pink"), mood: "surprise", duration: "day", relevance: (c) => (c.weekday === 5 ? 8 : 1), hint: "Целый день приключений" },
  { id: "slow-sunday", label: "Воскресенье без спешки", group: "time", emoji: "☕", ...col("yellow"), mood: "calm", duration: "half", constraints: { parentBreak: true, maxTravelMin: 30 }, relevance: (c) => (c.weekday === 6 && c.hour < 14 ? 8 : 1) },
  { id: "weekend-morning", label: "Утро выходного", group: "time", emoji: "🥞", ...col("yellow"), mood: "surprise", duration: "mid", food: true, constraints: { startAt: H(10), endBy: H(15) }, relevance: (c) => (c.weekday >= 5 && c.hour < 11 ? 9 : 0), hint: "С 10:00 и с обедом" },
  { id: "lunch-walk", label: "Обед и прогулка", group: "time", emoji: "🍲", ...col("peach"), mood: "calm", duration: "short", food: true, constraints: { parentBreak: true, outdoorPreferred: true }, relevance: (c) => (c.hour >= 11 && c.hour < 14 && !c.rainAllDay && !c.cold ? 7 : 0) },
  { id: "holidays", label: "Каникулы", group: "time", emoji: "🏖", ...col("green"), mood: "surprise", duration: "day", constraints: { minStops: 4 }, relevance: (c) => (c.weekday < 5 && isSchoolBreak(c.month, c.day) && (c.kidsCount === 0 || c.oldest >= 6) && c.hour < 12 ? 8 : 0), hint: "Насыщенный будний день без школы" },
  { id: "late-start", label: "Выехали поздно", group: "time", emoji: "🕓", ...col("blue"), mood: "surprise", duration: "short", todayOnly: true, constraints: { startAt: H(15), endBy: H(20) }, relevance: (c) => (c.hour >= 15 && c.hour < 19 ? 6 : 0), hint: "Успеем за пару часов" },
  { id: "sunday-eve", label: "Воскресный вечер", group: "time", emoji: "🌙", ...col("purple"), mood: "calm", duration: "short", constraints: { startAt: H(15), endBy: H(19) + 30, maxTravelMin: 25, quiet: true }, relevance: (c) => (c.weekday === 6 && c.hour >= 14 && c.hour < 17 ? 9 : 0), hint: "Тихо и домой к ужину" },
  { id: "weekday-off", label: "Будний день без толпы", group: "time", emoji: "🍃", ...col("mint"), mood: "learn", duration: "half", constraints: { quiet: true, preferCategories: ["museum", "animals"] }, relevance: (c) => (c.weekday < 5 && c.hour < 14 && (!c.kidsCount || (c.youngest >= 2 && (c.youngest < 7 || isSchoolBreak(c.month, c.day)))) ? 5.5 : 0), hint: "Музеи и зоопарки, когда там свободно" },

  /* ── за город: поездки из Москвы (дорога считается от центра и показана в карточке) ── */
  { id: "day-trip", label: "Выезд на день", group: "trip", emoji: "🚗", ...col("sky"), mood: "surprise", duration: "day", food: true, constraints: { regionOnly: true }, relevance: (c) => (c.region && !(c.kidsCount && c.oldest < 1) ? (c.weekday >= 5 ? 9 : 5) : 0), hint: "Поездка из Москвы: дорога указана в карточке" },
  { id: "estate-park", label: "Усадьба и парк", group: "trip", emoji: "🏡", ...col("leaf"), mood: "outdoor", duration: "half", constraints: { regionOnly: true, onlyCategories: ["park"], outdoorPreferred: true }, relevance: (c) => (c.region && !(c.kidsCount && c.oldest < 1) && !c.rainAllDay && !c.cold ? (c.weekday >= 5 ? 8 : 4) : 0), hint: "Парки и усадьбы за городом" },
  { id: "museums-away", label: "Музеи за городом", group: "trip", emoji: "🏛", ...col("purple"), mood: "learn", duration: "half", constraints: { regionOnly: true, onlyCategories: ["museum"] }, /* музеи области в базе — от 3 лет */ relevance: (c) => (c.region && !(c.kidsCount && c.oldest < 3) ? (c.rainAllDay || c.cold ? 8 : c.weekday >= 5 ? 6 : 4) : 0), hint: "Музеи Звенигорода, Коломны, Сергиева Посада" },
  { id: "play-away", label: "Игровые и ферма за городом", group: "trip", emoji: "🐴", ...col("orange"), mood: "energy", duration: "half", constraints: { regionOnly: true, onlyCategories: ["play", "animals", "active"] }, relevance: (c) => (c.region && !(c.kidsCount && c.oldest < 1) ? (c.weekday >= 5 ? 6.5 : 3.5) : 0), hint: "Парки развлечений, фермы и зоопарки области" },

  /* ── кто идёт ── */
  { id: "baby", label: "С малышом до года", group: "party", emoji: "🍼", ...col("mint"), mood: "calm", duration: "short", constraints: { stroller: true, quiet: true, maxTravelMin: 25 }, relevance: (c) => (c.kidsCount && c.youngest < 1 ? 10 : 0), hint: "Спокойно, недалеко и удобно с коляской" },
  { id: "toddler", label: "Малышу 1–3", group: "party", emoji: "🧸", ...col("peach"), mood: "calm", duration: "mid", constraints: { stroller: true }, relevance: (c) => (c.kidsCount && c.youngest >= 1 && c.youngest <= 3 ? 7 : 0) },
  { id: "siblings", label: "Старший и младший", group: "party", emoji: "👧", ...col("purple"), mood: "surprise", duration: "half", relevance: (c) => (c.kidsCount >= 2 && c.oldest - c.youngest >= 4 ? 9 : 0), hint: "Чтобы интересно было обоим" },
  { id: "grandma", label: "С бабушкой", group: "party", emoji: "👵", ...col("yellow"), mood: "calm", duration: "short", constraints: { quiet: true, maxActivity: 2, maxTravelMin: 30, parentBreak: true }, relevance: (c) => (c.weekday === 6 && c.hour >= 10 && c.hour < 15 ? 5.8 : c.weekday >= 5 ? 5 : 2.5), hint: "Меньше ходьбы, есть где присесть" },
  { id: "friends", label: "С друзьями ребёнка", group: "party", emoji: "🎈", ...col("pink"), mood: "energy", duration: "mid", food: true, constraints: { bookingOk: true, preferCategories: ["play", "active"] }, relevance: (c) => (c.oldest >= 6 && c.weekday === 5 && c.hour >= 11 && c.hour < 17 ? 5.2 : c.oldest >= 5 ? 4 : 1), hint: "Компанией: где можно разгуляться" },
  { id: "dad-day", label: "Папа-день", group: "party", emoji: "💪", ...col("sky"), mood: "energy", duration: "half", constraints: { preferCategories: ["active"], outdoorPreferred: true }, relevance: (c) => (c.weekday === 5 && c.hour < 14 ? 5.5 : c.weekday === 6 ? 3.5 : 1.5), hint: "Побегать, полазать, размяться" },
  { id: "tweens", label: "Для 10–12 лет", group: "party", emoji: "🧪", ...col("blue"), mood: "learn", duration: "mid", relevance: (c) => (c.oldest >= 10 && (!c.kidsCount || c.youngest >= 8) ? 9 : 0), hint: "Не «малышовое»" },
  { id: "preschool", label: "Дошкольнику 4–6", group: "party", emoji: "🎠", ...col("pink"), mood: "surprise", duration: "mid", constraints: { preferCategories: ["play", "animals"], experiences: ["playzone", "show"] }, relevance: (c) => (c.kidsCount && c.youngest >= 4 && c.oldest <= 6 ? 8 : 0), hint: "Игровые и спектакли по росту" },
  { id: "primary", label: "Школьнику 7–9", group: "party", emoji: "📚", ...col("blue"), mood: "learn", duration: "mid", constraints: { preferCategories: ["museum", "active"] }, relevance: (c) => (c.kidsCount && c.youngest >= 7 && c.oldest <= 9 ? 8 : 0), hint: "Интересно, но не скучно" },
  { id: "big-family", label: "Большая семья", group: "party", emoji: "👨‍👩‍👧‍👦", ...col("orange"), mood: "energy", duration: "half", food: true, constraints: { preferCategories: ["park", "play"], bookingOk: true }, relevance: (c) => (c.kidsCount >= 3 ? 11 : 0), hint: "Где хватит места всем" },
  { id: "grandpa", label: "С дедушкой", group: "party", emoji: "👴", ...col("leaf"), mood: "calm", duration: "mid", constraints: { quiet: true, maxTravelMin: 30, preferCategories: ["museum", "park"] }, relevance: (c) => (c.weekday === 5 && c.hour >= 10 && c.hour < 15 ? 5 : c.weekday >= 5 ? 4.5 : 2), hint: "Неспешно, с музеями и скамейками" },
  { id: "mom-friends", label: "С подругой и малышами", group: "party", emoji: "👭", ...col("peach"), mood: "calm", duration: "mid", food: true, constraints: { stroller: true, parentBreak: true, maxTravelMin: 25 }, relevance: (c) => (c.kidsCount && c.youngest <= 3 ? 6.5 : 0), hint: "Коляски, кофе и место поболтать" },
  { id: "first-grader", label: "Первоклассник после школы", group: "party", emoji: "✏️", ...col("yellow"), mood: "calm", duration: "short", constraints: { maxTravelMin: 25, startAt: H(15), endBy: H(20), preferCategories: ["park", "play"] }, relevance: (c) => (c.kidsCount && c.oldest >= 6 && c.oldest <= 7 && c.weekday < 5 && c.hour >= 13 && c.hour < 19 ? 9 : 0), hint: "Выдохнуть после уроков" },
  { id: "twins", label: "Погодки и двойняшки", group: "party", emoji: "👯", ...col("mint"), mood: "energy", duration: "mid", constraints: { preferCategories: ["play", "park"] }, relevance: (c) => (c.kidsCount >= 2 && c.oldest - c.youngest <= 2 ? 7 : 0), hint: "Одинаково интересно обоим" },

  /* ── повод ── */
  { id: "joy", label: "Порадовать ребёнка", group: "occasion", Glyph: GlyphGift, ...col("purple"), mood: "surprise", duration: "half", budget: "any", relevance: (c) => (c.rainAllDay || c.cold || c.snow ? 6 : 3) },
  { id: "birthday", label: "День рождения", group: "occasion", emoji: "🎂", ...col("pink"), mood: "energy", duration: "half", budget: "any", food: true, constraints: { bookingOk: true }, relevance: (c) => (c.kidsCount && c.weekday >= 5 ? (c.hour < 14 ? 5.5 : 4.5) : 2), hint: "Бронируйте заранее" },
  { id: "guests", label: "Гости из другого города", group: "occasion", emoji: "🏛", ...col("orange"), mood: "learn", duration: "day", constraints: { preferCategories: ["museum", "park", "animals"] }, relevance: (c) => ([5, 6, 7, 8].includes(c.month) && c.weekday >= 5 ? 7 : [12, 1].includes(c.month) && c.weekday >= 5 ? 5 : 2) },
  { id: "reward", label: "Награда за пятёрку", group: "occasion", emoji: "⭐", ...col("yellow"), mood: "surprise", duration: "short", constraints: { onlyCategories: ["shop", "active", "play", "animals"] }, relevance: (c) => (c.oldest >= 8 ? 6 : 0) },
  { id: "first-time", label: "Впервые в жизни", group: "occasion", emoji: "✨", ...col("mint"), mood: "surprise", duration: "mid", constraints: { onlyCategories: ["animals", "museum"] }, relevance: (c) => (c.kidsCount && c.youngest <= 4 ? 6 : 2), hint: "Зоопарк, океанариум, планетарий" },
  { id: "new-year", label: "Новогодние каникулы", group: "occasion", emoji: "🎄", ...col("green"), mood: "surprise", duration: "half", food: true, constraints: { experiences: ["show"], preferCategories: ["museum"], bookingOk: true }, relevance: (c) => (between(c.month, c.day, [12, 20], [1, 10]) ? 10 : between(c.month, c.day, [12, 10], [12, 19]) ? 4 : 0), hint: "Спектакли и ёлки: билеты лучше взять заранее" },
  { id: "gift", label: "Выбрать подарок", group: "occasion", emoji: "🎁", ...col("peach"), mood: "surprise", duration: "short", constraints: { onlyCategories: ["shop"], experiences: ["toys", "books"] }, relevance: (c) => (c.month === 12 ? 9 : c.weekday === 4 && c.hour >= 15 ? 5.5 : 2.5), hint: "Книги и игрушки" },
  { id: "family-dinner", label: "Семейный праздник", group: "occasion", emoji: "🥂", ...col("pink"), mood: "calm", duration: "half", food: true, constraints: { parentBreak: true, bookingOk: true }, relevance: (c) => (c.weekday >= 5 && c.hour >= 11 && c.hour < 15 ? 5.8 : c.weekday >= 5 && c.hour >= 9 && c.hour < 15 ? 5.2 : 2.5), hint: "Стол лучше забронировать" },
  { id: "summer-farewell", label: "Проводы лета", group: "occasion", emoji: "🌻", ...col("yellow"), mood: "outdoor", duration: "half", food: true, constraints: { outdoorPreferred: true, onlyCategories: ["park", "animals"] }, relevance: (c) => (c.rainAllDay ? 0 : between(c.month, c.day, [8, 10], [8, 31]) ? 9 : between(c.month, c.day, [8, 1], [8, 9]) ? 6 : between(c.month, c.day, [9, 1], [9, 10]) ? 5 : 0), hint: "Последние тёплые деньки" },

  /* ── настроение ── */
  { id: "cool", label: "Куда-нибудь классное", group: "mood", Glyph: GlyphSparkle, ...col("pink"), mood: "surprise", duration: "mid", relevance: (c) => (c.kidsCount === 0 ? 9 : 4) },
  { id: "playeat", label: "Поиграть и поесть", group: "mood", Glyph: GlyphPizza, ...col("orange"), mood: "energy", duration: "mid", food: true, constraints: { preferCategories: ["play", "active"], experiences: ["playzone"] }, relevance: (c) => (c.hour >= 10 && c.hour <= 15 ? 5.5 : 3) },
  { id: "energy", label: "Выплеснуть энергию", group: "mood", emoji: "⚡", ...col("peach"), mood: "energy", duration: "mid", relevance: (c) => (c.youngest >= 4 ? 5 : 1) },
  { id: "creative", label: "Творческий день", group: "mood", emoji: "🎨", ...col("pink"), mood: "creative", duration: "mid", constraints: { interests: ["drawing", "cooking"] }, relevance: (c) => (c.interests.includes("drawing") || c.interests.includes("cooking") ? 7 : 3) },
  { id: "science", label: "Опыты и наука", group: "mood", emoji: "🔬", ...col("blue"), mood: "learn", duration: "mid", constraints: { interests: ["science", "space"] }, relevance: (c) => (c.interests.includes("science") || c.interests.includes("space") ? 7 : 2) },
  { id: "animals", label: "К животным", group: "mood", emoji: "🐾", ...col("orange"), mood: "surprise", duration: "mid", constraints: { onlyCategories: ["animals"], interests: ["animals"] }, relevance: (c) => (c.kidsCount && c.youngest < 1 ? 0 : c.interests.includes("animals") ? 8 : 3) },
  { id: "calm", label: "Успокоиться и отдохнуть", group: "mood", emoji: "🍃", ...col("leaf"), mood: "calm", duration: "short", constraints: { quiet: true, maxActivity: 2 }, relevance: (c) => (c.hour >= 16 && c.hour < 20 ? 5.5 : c.rainAllDay ? 4 : 2.5) },
  { id: "coffee", label: "Ребёнок играет, я пью кофе", group: "mood", emoji: "☕", ...col("peach"), mood: "calm", duration: "short", constraints: { parentBreak: true, maxTravelMin: 25 }, relevance: (c) => (c.cold || c.rainAllDay ? 7 : c.kidsCount && c.youngest >= 2 && c.youngest <= 6 ? 6 : 3) },
  { id: "theatre-circus", label: "В театр или цирк", group: "mood", emoji: "🎭", ...col("purple"), mood: "surprise", duration: "mid", constraints: { indoorOnly: true, onlyTypes: ["theatre", "circus"], experiences: ["show"], bookingOk: true }, relevance: (c) => (c.kidsCount && c.youngest < 3 ? 0 : c.rainAllDay || c.cold ? 7 : c.weekday >= 5 ? 5 : 2.5), hint: "Кукольные, цирк и театр зверей" },
  { id: "dino-day", label: "Динозавры и древности", group: "mood", emoji: "🦖", ...col("leaf"), mood: "learn", duration: "mid", constraints: { interests: ["dinosaurs", "nature"], preferCategories: ["museum"] }, relevance: (c) => (c.interests.includes("dinosaurs") ? 8 : 2) },
  { id: "transport-day", label: "Поезда, машины, техника", group: "mood", emoji: "🚂", ...col("sky"), mood: "learn", duration: "mid", constraints: { interests: ["transport", "construction"], preferCategories: ["museum", "play"] }, relevance: (c) => (c.interests.includes("transport") || c.interests.includes("construction") ? 8 : 2) },
  { id: "music-fairy", label: "Музыка и сказки", group: "mood", emoji: "🎻", ...col("purple"), mood: "creative", duration: "mid", constraints: { interests: ["music", "fairy"], onlyExperiences: ["show"] }, relevance: (c) => (c.kidsCount && c.youngest < 2 ? 0 : c.interests.includes("music") || c.interests.includes("fairy") ? 8 : 2) },
  { id: "nature-walk", label: "Природа и тропинки", group: "mood", emoji: "🥾", ...col("leaf"), mood: "outdoor", duration: "mid", constraints: { interests: ["nature"], outdoorPreferred: true, onlyCategories: ["park"] }, relevance: (c) => (!daylit(c, 3) ? 0 : c.interests.includes("nature") ? (c.rainAllDay || c.cold || c.hot ? 2 : 8) : c.sunny && c.warm ? 3.5 : 1.5) },
  { id: "sport-day", label: "Лазать и прыгать", group: "mood", emoji: "🧗", ...col("peach"), mood: "energy", duration: "mid", constraints: { interests: ["sport"], preferCategories: ["active", "play"] }, relevance: (c) => (c.interests.includes("sport") ? 8 : c.youngest >= 5 ? 2.5 : 1) },
  { id: "sweet-workshop", label: "Мастер-класс и сладкое", group: "mood", emoji: "🧁", ...col("pink"), mood: "creative", duration: "mid", food: true, constraints: { interests: ["cooking", "drawing"], onlyExperiences: ["workshop"] }, relevance: (c) => (c.interests.includes("cooking") || c.interests.includes("drawing") ? 7 : 2.5) },
  { id: "bookish", label: "Книги и тишина", group: "mood", emoji: "📖", ...col("blue"), mood: "calm", duration: "short", constraints: { indoorOnly: true, quiet: true, onlyExperiences: ["books"] }, relevance: (c) => (c.rainAllDay || c.cold ? 8 : c.hour >= 16 ? 4 : 2), hint: "Книжные и тихие уголки" },

  /* ── бюджет и силы ── */
  { id: "free", label: "Бесплатно", group: "effort", Glyph: GlyphHeart, ...col("mint"), mood: "outdoor", duration: "mid", budget: "free", relevance: (c) => (c.rainAllDay ? 2 : c.sunny && c.warm && !c.hot ? 6 : 3.5), hint: "Парки, площадки и всё, что без билета" },
  { id: "cheap", label: "Недорого", group: "effort", emoji: "👛", ...col("green"), mood: "surprise", duration: "short", budget: "2000", relevance: (c) => (c.weekday < 5 ? 4.5 : 3) },
  { id: "easy", label: "Без сложностей", group: "effort", Glyph: GlyphSmile, ...col("yellow"), mood: "calm", duration: "short", constraints: { maxTravelMin: 20, maxStops: 1 }, relevance: (c) => (c.kidsCount && c.youngest < 1 ? 1.5 : c.youngest <= 3 ? 6 : 3), hint: "Одно место рядом — без пересадок и подготовки" },
  { id: "no-crowd", label: "Без толпы", group: "effort", emoji: "🤫", ...col("mint"), mood: "calm", duration: "mid", constraints: { quiet: true, avoidHits: true }, relevance: (c) => (c.weekday >= 5 ? (c.hour >= 12 ? 5.2 : 4.8) : 2) },
  { id: "gentle", label: "Мягкий день после болезни", group: "effort", emoji: "🌱", ...col("leaf"), mood: "calm", duration: "short", constraints: { quiet: true, indoorOnly: true, maxTravelMin: 20, maxActivity: 1, avoidCategories: ["active", "play"] }, relevance: (c) => (c.cold || c.rainAllDay || c.snow ? (c.kidsCount && c.youngest <= 7 ? 6.5 : 2) : 1), hint: "Тихо, недалеко и без беготни" },
  { id: "near-home", label: "Ближе всего", group: "effort", emoji: "📍", ...col("mint"), mood: "surprise", duration: "short", constraints: { maxTravelMin: 15, preferCategories: ["park", "play"] }, relevance: (c) => (c.kidsCount && c.youngest <= 4 ? (c.hour >= 14 && c.hour < 19 ? 7 : 4.5) : 3), hint: "Рядом с вами — выберите округ или адрес" },
  { id: "free-indoors", label: "Бесплатно и под крышей", group: "effort", emoji: "🏠", ...col("sky"), mood: "calm", duration: "mid", budget: "free", constraints: { indoorOnly: true }, relevance: (c) => (c.rainAllDay || c.cold || c.snow ? 9 : c.hot ? 4 : 1.5), hint: "Что бесплатно работает в непогоду" },
  { id: "splurge", label: "Можно потратиться", group: "effort", emoji: "💎", ...col("purple"), mood: "surprise", duration: "day", budget: "any", constraints: { preferCategories: ["animals", "active", "play"] }, relevance: (c) => (c.weekday === 5 && c.hour < 13 ? 5.5 : c.weekday >= 5 ? 5 : 2), hint: "Большой день без оглядки на цены" },
  { id: "cheap-lunch", label: "Недорого и с обедом", group: "effort", emoji: "🥪", ...col("green"), mood: "surprise", duration: "mid", budget: "2000", food: true, constraints: { preferCategories: ["park", "cafe"] }, relevance: (c) => (c.weekday < 5 && c.hour >= 9 && c.hour < 15 ? 5 : 3) },
  { id: "low-energy", label: "Мало сил", group: "effort", emoji: "🛋", ...col("yellow"), mood: "calm", duration: "short", constraints: { indoorOnly: true, parentBreak: true }, relevance: (c) => (c.weekday <= 4 && c.hour >= 17 ? 5 : c.rainAllDay || c.cold ? 4.5 : 2.5), hint: "Тепло, сидя и без подвигов" },
];

export const scenarioById = (id?: string | null) => (id ? SCENARIO_LIBRARY.find((s) => s.id === id) : undefined);

export function scenarioHref(s: ScenarioDef) {
  return `/planner/results?s=${s.id}`;
}

/**
 * Контекст главной: «сегодня» и «завтра». Для каждого сценария берётся тот день, на который движок реально построит план
 * (хватает ли сегодня времени — решает `startToday`, то же правило, что в движке), иначе «Вечер пятницы» в 17:30
 * показывался бы по сегодняшнему вечеру, а план уезжал на субботу.
 */
export interface HomeCtx {
  today: ScenarioCtx;
  tomorrow: ScenarioCtx;
  /** Минуты от полуночи, Москва. */
  nowMin: number;
}
const isHomeCtx = (c: ScenarioCtx | HomeCtx): c is HomeCtx => "today" in c;

/** Контекст, в котором сценарий «живёт» на главной: сегодняшний — или завтрашний, если сегодня уже не успеть. */
export function scenarioCtx(s: ScenarioDef, c: ScenarioCtx | HomeCtx): ScenarioCtx {
  if (!isHomeCtx(c)) return c;
  if (!startToday(c.nowMin, s.duration, s.constraints).tomorrow) return c.today;
  return { ...c.tomorrow, hour: Math.floor(tomorrowStart(s.constraints) / 60) };
}

/**
 * Лёгкая «ротация»: сценариев много, и без неё одни и те же попадали бы на главную каждый день.
 * Добавка детерминирована (день недели, месяц, часть суток) и невелика — главное по-прежнему решает уместность.
 */
function rotation(id: string, c: ScenarioCtx): number {
  const part = c.hour < 11 ? 0 : c.hour < 16 ? 1 : c.hour < 20 ? 2 : 3;
  let h = 2166136261;
  const k = `${id}:${c.weekday}:${c.month}:${part}`;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** 8 самых уместных сценариев сейчас, по одному-двум из разных групп. */
export function pickScenarios(ctx: ScenarioCtx | HomeCtx, n = 8): ScenarioDef[] {
  const region = isHomeCtx(ctx) ? ctx.today.region : ctx.region;
  const ranked = SCENARIO_LIBRARY.map((s, i) => {
    const c = scenarioCtx(s, ctx);
    const rel = s.todayOnly && isHomeCtx(ctx) && c !== ctx.today ? 0 : s.relevance(c);
    return { s, r: rel > 0 ? rel + rotation(s.id, c) * 2.2 - i * 0.001 : 0 };
  })
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r);
  const out: ScenarioDef[] = [];
  const perGroup = new Map<ScenarioGroup, number>();
  for (const { s } of ranked) {
    const g = perGroup.get(s.group) ?? 0;
    if (g >= 3) continue;
    out.push(s);
    perGroup.set(s.group, g + 1);
    if (out.length >= n) break;
  }
  // выбрано «Москва + область»: хотя бы одна поездка за город всегда на виду (иначе область теряется среди городских ситуаций)
  if (region && !out.some((s) => s.group === "trip")) {
    const trip = ranked.find((x) => x.s.group === "trip")?.s;
    if (trip) {
      if (out.length >= n) out.pop();
      out.splice(Math.min(2, out.length), 0, trip);
    }
  }
  return out;
}
