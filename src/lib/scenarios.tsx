import type { ComponentType, SVGProps } from "react";
import type { BudgetId, DurationId, MoodId, ScenarioConstraints } from "@/lib/types";
import { GlyphSparkle, GlyphClock, GlyphRain, GlyphTreeWalk, GlyphPizza, GlyphGift, GlyphHeart, GlyphSmile } from "@/components/icons/brand-icons";

/**
 * Библиотека жизненных ситуаций. Сценарий = ситуация + рецепт (параметры и ограничения для движка).
 * Главная показывает 8 самых уместных сейчас: по погоде, дню недели, времени и возрасту детей.
 */

export type ScenarioGroup = "weather" | "time" | "party" | "occasion" | "mood" | "effort";

export const GROUP_LABEL: Record<ScenarioGroup, string> = {
  weather: "Погода и сезон",
  time: "Когда",
  party: "Кто идёт",
  occasion: "Повод",
  mood: "Настроение",
  effort: "Бюджет и силы",
};

export interface ScenarioCtx {
  weekday: number; // 0 — пн
  hour: number;
  month: number; // 1..12
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

export const SCENARIO_LIBRARY: ScenarioDef[] = [
  /* ── погода ── */
  { id: "rain", label: "Если дождь", group: "weather", Glyph: GlyphRain, ...col("blue"), mood: "surprise", duration: "mid", constraints: { indoorOnly: true }, relevance: (c) => (c.rainAllDay ? 12 : c.rainLater ? 6 : 1.5), hint: "Всё под крышей" },
  { id: "before-rain", label: "Успеть до дождя", group: "weather", emoji: "⛅", ...col("sky"), mood: "outdoor", duration: "mid", constraints: { outdoorPreferred: true }, relevance: (c) => (c.rainLater && !c.rainAllDay ? 11 : 0), hint: "Гуляем, пока сухо, потом — под крышу" },
  { id: "frost", label: "Мороз — греемся", group: "weather", emoji: "🧣", ...col("purple"), mood: "surprise", duration: "mid", constraints: { indoorOnly: true }, relevance: (c) => (c.cold ? 10 : 0), hint: "Тёплые места и горячий шоколад" },
  { id: "first-snow", label: "Играть в снегу", group: "weather", emoji: "☃️", ...col("sky"), mood: "outdoor", duration: "mid", constraints: { preferCategories: ["park"] }, relevance: (c) => (c.snow ? (c.cold ? 6 : 9) : 0) },
  { id: "heat", label: "Жара — в тень и прохладу", group: "weather", emoji: "🌊", ...col("sky"), mood: "surprise", duration: "mid", constraints: { indoorOnly: true }, relevance: (c) => (c.hot ? 10 : 0), hint: "Кондиционеры, вода, тень" },
  { id: "walk", label: "Погулять", group: "weather", Glyph: GlyphTreeWalk, ...col("leaf"), mood: "outdoor", duration: "mid", constraints: { outdoorPreferred: true }, relevance: (c) => (c.rainAllDay || c.cold || c.hot ? 0 : c.sunny ? 8 : 4) },
  { id: "golden-autumn", label: "Золотая осень", group: "weather", emoji: "🍂", ...col("orange"), mood: "outdoor", duration: "mid", constraints: { preferCategories: ["park"], outdoorPreferred: true }, relevance: (c) => ((c.month === 9 || c.month === 10) && !c.rainAllDay && !c.cold && !c.hot ? 7 : 0), hint: "Листья, парки и фотографии" },
  { id: "picnic", label: "Пикник", group: "weather", emoji: "🧺", ...col("green"), mood: "outdoor", duration: "half", constraints: { preferCategories: ["park"], outdoorPreferred: true }, relevance: (c) => (c.sunny && c.warm && !c.hot ? 7 : 0) },

  /* ── когда ── */
  { id: "short", label: "На пару часов", group: "time", Glyph: GlyphClock, ...col("green"), mood: "surprise", duration: "short", relevance: () => 3 },
  { id: "before-nap", label: "До дневного сна", group: "time", emoji: "😴", ...col("purple"), mood: "calm", duration: "short", constraints: { endBy: H(13), maxTravelMin: 25, quiet: true, stroller: true }, relevance: (c) => (c.kidsCount && c.youngest <= 3 ? (c.hour < 12 ? 11 : 3) : 0), hint: "Дома к 13:00" },
  { id: "morning", label: "Утро до обеда", group: "time", emoji: "🌤", ...col("yellow"), mood: "surprise", duration: "mid", constraints: { endBy: H(14) }, relevance: (c) => (c.hour < 11 ? 6 : 0) },
  { id: "after-school", label: "После садика", group: "time", emoji: "🎒", ...col("orange"), mood: "energy", duration: "short", constraints: { maxTravelMin: 25 }, relevance: (c) => (c.weekday < 5 && c.hour >= 14 && c.hour < 19 ? 9 : 0), hint: "Рядом и недолго" },
  { id: "weekday-evening", label: "Вечер буднего дня", group: "time", emoji: "🌆", ...col("blue"), mood: "calm", duration: "short", constraints: { maxTravelMin: 25 }, relevance: (c) => (c.weekday < 4 && c.hour >= 17 ? 6 : 0) },
  { id: "friday", label: "Вечер пятницы", group: "time", emoji: "🎉", ...col("pink"), mood: "surprise", duration: "short", food: true, relevance: (c) => (c.weekday === 4 && c.hour >= 14 ? 10 : 0) },
  { id: "big-saturday", label: "Большая суббота", group: "time", emoji: "🗓", ...col("pink"), mood: "surprise", duration: "day", relevance: (c) => (c.weekday === 5 ? 8 : c.weekday === 4 ? 6 : 1), hint: "Целый день приключений" },
  { id: "slow-sunday", label: "Воскресенье без спешки", group: "time", emoji: "☕", ...col("yellow"), mood: "calm", duration: "half", constraints: { parentBreak: true }, relevance: (c) => (c.weekday === 6 ? 8 : c.weekday === 5 ? 3 : 1) },

  /* ── кто идёт ── */
  { id: "baby", label: "С малышом до года", group: "party", emoji: "🍼", ...col("mint"), mood: "calm", duration: "short", constraints: { stroller: true, quiet: true, maxTravelMin: 25 }, relevance: (c) => (c.kidsCount && c.youngest < 1 ? 10 : 0), hint: "Коляска, пеленальный столик, тишина" },
  { id: "toddler", label: "Малышу 1–3", group: "party", emoji: "🧸", ...col("peach"), mood: "calm", duration: "mid", constraints: { stroller: true }, relevance: (c) => (c.kidsCount && c.youngest >= 1 && c.youngest <= 3 ? 7 : 0) },
  { id: "siblings", label: "Старший и младший", group: "party", emoji: "👧", ...col("purple"), mood: "surprise", duration: "half", relevance: (c) => (c.kidsCount >= 2 && c.oldest - c.youngest >= 4 ? 9 : 0), hint: "Чтобы интересно было обоим" },
  { id: "grandma", label: "С бабушкой", group: "party", emoji: "👵", ...col("yellow"), mood: "calm", duration: "short", constraints: { quiet: true, maxTravelMin: 30, parentBreak: true }, relevance: () => 3, hint: "Меньше ходьбы, есть где присесть" },
  { id: "friends", label: "С друзьями ребёнка", group: "party", emoji: "🎈", ...col("pink"), mood: "energy", duration: "mid", food: true, relevance: (c) => (c.oldest >= 5 ? 4 : 1) },
  { id: "dad-day", label: "Папа-день", group: "party", emoji: "💪", ...col("sky"), mood: "energy", duration: "mid", relevance: () => 2 },
  { id: "tweens", label: "Для 10–12 лет", group: "party", emoji: "🧪", ...col("blue"), mood: "learn", duration: "mid", relevance: (c) => (c.oldest >= 10 ? 9 : 0), hint: "Не «малышовое»" },

  /* ── повод ── */
  { id: "joy", label: "Порадовать ребёнка", group: "occasion", Glyph: GlyphGift, ...col("purple"), mood: "surprise", duration: "half", budget: "any", relevance: () => 3 },
  { id: "birthday", label: "День рождения", group: "occasion", emoji: "🎂", ...col("pink"), mood: "energy", duration: "half", budget: "any", food: true, constraints: { bookingOk: true }, relevance: () => 2, hint: "Бронируйте заранее" },
  { id: "guests", label: "Гости из другого города", group: "occasion", emoji: "🏛", ...col("orange"), mood: "learn", duration: "day", constraints: { preferCategories: ["museum", "park", "animals"] }, relevance: () => 2 },
  { id: "reward", label: "Награда за пятёрку", group: "occasion", emoji: "⭐", ...col("yellow"), mood: "surprise", duration: "short", constraints: { preferCategories: ["shop", "active"] }, relevance: (c) => (c.oldest >= 7 ? 6 : 0) },
  { id: "first-time", label: "Впервые в жизни", group: "occasion", emoji: "✨", ...col("mint"), mood: "surprise", duration: "mid", constraints: { preferCategories: ["animals", "museum"] }, relevance: (c) => (c.kidsCount && c.youngest <= 4 ? 6 : 2), hint: "Зоопарк, океанариум, планетарий" },

  /* ── настроение ── */
  { id: "cool", label: "Куда-нибудь классное", group: "mood", Glyph: GlyphSparkle, ...col("pink"), mood: "surprise", duration: "mid", relevance: () => 4 },
  { id: "playeat", label: "Поиграть и поесть", group: "mood", Glyph: GlyphPizza, ...col("orange"), mood: "energy", duration: "mid", food: true, relevance: (c) => (c.hour >= 10 && c.hour <= 15 ? 5.5 : 3) },
  { id: "energy", label: "Выплеснуть энергию", group: "mood", emoji: "⚡", ...col("peach"), mood: "energy", duration: "mid", relevance: (c) => (c.youngest >= 4 ? 5 : 1) },
  { id: "creative", label: "Творческий день", group: "mood", emoji: "🎨", ...col("pink"), mood: "creative", duration: "mid", constraints: { interests: ["drawing", "cooking"] }, relevance: (c) => (c.interests.includes("drawing") || c.interests.includes("cooking") ? 7 : 3) },
  { id: "science", label: "Опыты и наука", group: "mood", emoji: "🔬", ...col("blue"), mood: "learn", duration: "mid", constraints: { interests: ["science", "space"] }, relevance: (c) => (c.interests.includes("science") || c.interests.includes("space") ? 7 : 2) },
  { id: "animals", label: "К животным", group: "mood", emoji: "🐾", ...col("orange"), mood: "surprise", duration: "mid", constraints: { preferCategories: ["animals"], interests: ["animals"] }, relevance: (c) => (c.interests.includes("animals") ? 8 : 3) },
  { id: "calm", label: "Успокоиться и отдохнуть", group: "mood", emoji: "🍃", ...col("leaf"), mood: "calm", duration: "short", constraints: { quiet: true }, relevance: () => 3 },
  { id: "coffee", label: "Ребёнок играет, я пью кофе", group: "mood", emoji: "☕", ...col("peach"), mood: "calm", duration: "short", constraints: { parentBreak: true, maxTravelMin: 25 }, relevance: (c) => (c.cold || c.rainAllDay ? 5 : 3) },

  /* ── бюджет и силы ── */
  { id: "free", label: "Бесплатно", group: "effort", Glyph: GlyphHeart, ...col("mint"), mood: "outdoor", duration: "mid", budget: "free", relevance: (c) => (c.rainAllDay ? 2 : 4) },
  { id: "cheap", label: "Недорого", group: "effort", emoji: "👛", ...col("green"), mood: "surprise", duration: "mid", budget: "2000", relevance: () => 3 },
  { id: "easy", label: "Без сложностей", group: "effort", Glyph: GlyphSmile, ...col("yellow"), mood: "calm", duration: "short", constraints: { maxTravelMin: 20 }, relevance: (c) => (c.youngest <= 3 ? 6 : 3), hint: "Рядом и без подготовки" },
  { id: "no-crowd", label: "Без толпы", group: "effort", emoji: "🤫", ...col("mint"), mood: "calm", duration: "mid", constraints: { quiet: true }, relevance: (c) => (c.weekday >= 5 ? 5 : 2) },
  { id: "gentle", label: "Мягкий день после болезни", group: "effort", emoji: "🌱", ...col("leaf"), mood: "calm", duration: "short", constraints: { quiet: true, maxTravelMin: 20 }, relevance: () => 1 },
];

export const scenarioById = (id?: string | null) => (id ? SCENARIO_LIBRARY.find((s) => s.id === id) : undefined);

export function scenarioHref(s: ScenarioDef) {
  return `/planner/results?s=${s.id}`;
}

/** 8 самых уместных сценариев сейчас, по одному-двум из разных групп. */
export function pickScenarios(ctx: ScenarioCtx, n = 8): ScenarioDef[] {
  const ranked = SCENARIO_LIBRARY.map((s, i) => ({ s, r: s.relevance(ctx) - i * 0.001 }))
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
  return out;
}
