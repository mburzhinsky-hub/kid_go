import type { Place, Plan, PlannerInput, MoodId, BudgetId, DurationId } from "@/lib/types";
import { places as ALL_PLACES } from "@/lib/data/places";
import { buildPlan, chainLabel } from "@/lib/plan";
import { haversineKm, pt } from "@/lib/geo";
import { ceilTo, fromMinutes, isOpenDuring, moscowNow } from "@/lib/format";
import { explainPlan } from "./explain";

/**
 * Recommendation layer (без LLM): фильтрация → скоринг → сборка комбинаций.
 * LLM, если подключён, работает только поверх результата (explain.ts / nlu.ts).
 */

export const DURATION_MIN: Record<DurationId, number> = { short: 120, mid: 240, half: 330, day: 450 };
export const BUDGET_MAX: Record<BudgetId, number> = { free: 0, "2000": 2000, "5000": 5000, any: Infinity };
const RADIUS: Record<PlannerInput["transport"], number> = { walk: 3.5, transit: 16, car: 30 };

const ACTIVITY: Place["category"][] = ["park", "play", "museum", "active", "animals"];

export interface ScoredPlace {
  place: Place;
  score: number;
  km: number;
  parts: Record<string, number>;
}

/* ───────── 1. Контекст: когда стартуем ───────── */

export function planStart(now: Date): { start: number; weekday: number; tomorrow: boolean } {
  const { weekday, minutes } = moscowNow(now);
  const start = ceilTo(minutes + 40, 30); // собраться и доехать
  if (start > 18 * 60) return { start: 11 * 60, weekday: (weekday + 1) % 7, tomorrow: true };
  return { start: Math.max(start, 10 * 60), weekday, tomorrow: false };
}

/* ───────── 2. Фильтры ───────── */

function ageFit(p: Place, ages: number[]): number {
  if (!ages.length) return 1;
  const ok = ages.filter((a) => a >= p.age_min && a <= p.age_max).length;
  return ok / ages.length;
}

function weatherFit(p: Place, input: PlannerInput): number {
  const bad = input.weather.condition === "rain" || input.weather.condition === "snow";
  if (bad) {
    if (p.indoor) return 1;
    return input.mood === "outdoor" ? 0.4 : 0;
  }
  if (input.weather.condition === "sun" && p.outdoor) return 1;
  return p.indoor && !p.outdoor ? 0.75 : 0.9;
}

const isFreeEligible = (p: Place) => p.price_min === 0;

function moodFit(p: Place, mood: MoodId): number {
  switch (mood) {
    case "energy":
      return p.activity_level === 3 ? 1 : p.activity_level === 2 ? 0.3 : 0;
    case "creative":
      if (p.experience_tags.includes("workshop")) return 1;
      if (p.interest_tags.some((t) => t === "drawing" || t === "music")) return 0.7;
      if (p.interest_tags.some((t) => t === "cooking" || t === "construction")) return 0.5;
      return 0.1;
    case "learn":
      return p.category === "museum" ? 1 : p.category === "animals" ? 0.75 : p.interest_tags.includes("science") ? 0.7 : 0.1;
    case "outdoor":
      return p.outdoor ? 1 : 0.05;
    case "calm":
      return p.activity_level === 1 ? 1 : p.noise_level <= 2 && p.activity_level === 2 ? 0.5 : 0;
    case "surprise":
      return (p.experience_tags.includes("unusual") ? 0.7 : 0.3) + (p.is_hit ? 0.3 : 0);
  }
}

/* ───────── 3. Скоринг ───────── */

export function scorePlace(p: Place, input: PlannerInput, ages: number[]): ScoredPlace | null {
  const km = haversineKm(input.location, pt(p));
  const radius = input.maxDistanceKm ?? RADIUS[input.transport];
  if (km > radius) return null;

  const age = ageFit(p, ages);
  if (age === 0) return null;
  const weather = weatherFit(p, input);
  if (weather === 0) return null;

  const budgetMax = BUDGET_MAX[input.budget];
  if (input.budget === "free" ? !isFreeEligible(p) : p.family_budget > budgetMax) return null;

  const interests = new Set(input.children.flatMap((c) => c.interests));
  const interest = interests.size
    ? Math.min(1, p.interest_tags.filter((t) => interests.has(t)).length / 1.5)
    : 0.5;
  const distance = Math.max(0, 1 - km / radius);
  const rating = (p.rating - 4) / 1; // 0..1
  const mood = moodFit(p, input.mood);
  const activityMatch = input.activity ? 1 - Math.abs(p.activity_level - input.activity) / 2 : 0.5;
  const personalization = (p.is_hit ? 0.5 : 0) + Math.min(0.5, p.review_count / 8000);

  const parts = {
    age: age * 3,
    weather: weather * 3,
    distance: distance * 2,
    interest: interest * 2,
    rating,
    mood: mood * 4,
    activity: activityMatch,
    personalization,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { place: p, score, km, parts };
}

/* ───────── 4. Сборка приключений ───────── */

function nearbyFrom(base: Place, pool: ScoredPlace[], maxKm: number) {
  return pool
    .map((s) => ({ ...s, legKm: haversineKm(pt(base), pt(s.place)) }))
    .filter((s) => s.legKm <= maxKm && s.place.id !== base.id);
}

function titleFor(anchor: Place, input: PlannerInput): { title: string; emoji: string } {
  const t = anchor.interest_tags;
  if (t.includes("dinosaurs")) return { title: "День динозавров", emoji: "🦖" };
  if (t.includes("space")) return { title: "Космический день", emoji: "🚀" };
  if (anchor.slug === "moskvarium") return { title: "Подводный мир", emoji: "🐬" };
  if (anchor.category === "animals") return { title: "День с животными", emoji: "🐾" };
  if (t.includes("science")) return { title: "День открытий", emoji: "🧪" };
  if (anchor.category === "active") return { title: "Энергия на максимум", emoji: "⚡" };
  if (anchor.category === "play" && t.includes("fairy")) return { title: "Сказочный день", emoji: "🧚" };
  if (t.includes("drawing") || t.includes("cooking") || anchor.experience_tags.includes("workshop")) return { title: "Творческий день", emoji: "🎨" };
  if (anchor.category === "play") return { title: "Игровой день", emoji: "🎈" };
  if (input.budget === "free") return { title: "Бесплатный день", emoji: "💚" };
  return { title: "Прогулка и приключения", emoji: "🌿" };
}

export interface PlannerResult {
  plans: Plan[];
  startLabel: string;
  tomorrow: boolean;
  considered: number;
  suggestions: Relaxation[];
}

export interface Relaxation {
  label: string;
  patch: Partial<Pick<PlannerInput, "budget" | "transport" | "duration" | "mood">>;
}

export function generatePlans(input: PlannerInput, count = 3, offset = 0): PlannerResult {
  const ages = input.children.map((c) => c.age);
  const { start, weekday, tomorrow } = planStart(input.now);
  const total = DURATION_MIN[input.duration];

  const scored = ALL_PLACES.map((p) => scorePlace(p, input, ages)).filter(Boolean) as ScoredPlace[];
  // open-check: место должно работать в своё окно
  const openOk = (p: Place, at: number, dur: number) => isOpenDuring(p.opening_hours, weekday, at, dur);

  const anchors = scored
    .filter((s) => ACTIVITY.includes(s.place.category))
    .filter((s) => openOk(s.place, start, Math.min(s.place.average_duration, total)))
    .sort((a, b) => b.score - a.score);

  const cafes = scored.filter((s) => s.place.category === "cafe");
  const extras = scored.filter((s) => s.place.category !== "cafe");
  const legMax = input.transport === "walk" ? 1.8 : 4.5;

  const plans: Plan[] = [];
  const usedAnchors = new Set<string>();
  const usedCategories = new Map<string, number>();

  for (const anchor of anchors) {
    if (plans.length >= count + offset) break;
    if (usedAnchors.has(anchor.place.id)) continue;
    // разнообразие: не больше двух якорей одной категории
    if ((usedCategories.get(anchor.place.category) ?? 0) >= (plans.length < 2 ? 1 : plans.length < 4 ? 2 : 3)) continue;

    const anchorDur = Math.min(anchor.place.average_duration, Math.round(total * (total <= 120 ? 0.65 : 0.5)));
    const stops: { place: Place; duration: number }[] = [{ place: anchor.place, duration: ceilTo(anchorDur, 5) }];
    let used = anchorDur;
    let clock = start + anchorDur;

    const budgetMax = BUDGET_MAX[input.budget];
    const fitsBudget = (extra: Place[]) =>
      input.budget === "free" || [anchor.place, ...extra].reduce((s, p) => s + p.family_budget, 0) <= budgetMax * 1.1;

    // еда после активности (если не влезает в бюджет — берём кафе подешевле)
    const wantFood = input.foodAfter || total - used >= 50;
    if (wantFood && input.budget !== "free") {
      const food = nearbyFrom(anchor.place, cafes, legMax)
        .filter((c) => !c.place.experience_tags.includes("icecream") || total <= 120)
        .filter((c) => openOk(c.place, clock + 15, 45))
        .filter((c) => fitsBudget([c.place]))
        .sort((a, b) => b.score - b.legKm * 1.5 - (a.score - a.legKm * 1.5))[0];
      if (food) {
        const d = total <= 120 ? 40 : 55;
        stops.push({ place: food.place, duration: d });
        used += d + 15;
        clock += d + 15;
      }
    }

    // третья точка: дополняем, а не повторяем; только если влезает в бюджет
    if (total - used >= 45) {
      const last = stops[stops.length - 1].place;
      const third = nearbyFrom(last, extras, legMax)
        .filter((c) => !stops.some((s) => s.place.id === c.place.id))
        .filter((c) => c.place.category !== anchor.place.category)
        .filter((c) => openOk(c.place, clock + 15, 30))
        .filter((c) => fitsBudget([...stops.slice(1).map((s) => s.place), c.place]))
        .map((c) => ({
          ...c,
          bonus:
            (c.place.category === "shop" ? 1.2 : 0) +
            (c.place.category === "park" && input.weather.condition !== "rain" ? 1 : 0) -
            c.legKm,
        }))
        .sort((a, b) => b.score + b.bonus - (a.score + a.bonus))[0];
      if (third) {
        const d = Math.min(third.place.average_duration, Math.max(30, total - used - 15));
        stops.push({ place: third.place, duration: ceilTo(d, 5) });
      }
    }

    if (!fitsBudget(stops.slice(1).map((s) => s.place))) continue;
    // не повторяем почти тот же набор мест в другом порядке
    const ids = new Set(stops.map((s) => s.place.id));
    if (plans.some((p) => p.stops.filter((s) => ids.has(s.place.id)).length >= 2)) continue;

    const { title, emoji } = titleFor(anchor.place, input);
    const draft = buildPlan(stops, {
      key: stops.map((s) => s.place.slug).join("+"),
      title,
      emoji,
      start: fromMinutes(start),
      transport: input.transport,
      description: chainLabel(stops.map((s) => s.place)),
    });

    const { why, explanation } = explainPlan(draft, input);
    plans.push({
      ...draft,
      why,
      explanation,
      score: anchor.score,
    });
    usedAnchors.add(anchor.place.id);
    usedCategories.set(anchor.place.category, (usedCategories.get(anchor.place.category) ?? 0) + 1);
  }

  return {
    plans: plans.slice(offset),
    startLabel: fromMinutes(start),
    tomorrow,
    considered: scored.length,
    suggestions: plans.length ? [] : diagnose(input),
  };
}

/** «Ничего не нашлось» — подсказываем, какое ослабление условий даст результат. */
function diagnose(input: PlannerInput): Relaxation[] {
  const tries: Relaxation[] = [
    { label: "Увеличить бюджет до 5 000 ₽", patch: { budget: "5000" } },
    { label: "Разрешить общественный транспорт", patch: { transport: "transit" } },
    { label: "Выделить 3–4 часа", patch: { duration: "mid" } },
    { label: "Положиться на нас — «Удивите нас»", patch: { mood: "surprise" } },
  ];
  return tries.filter((t) => {
    const k = Object.keys(t.patch)[0] as keyof Relaxation["patch"];
    if (input[k] === t.patch[k]) return false;
    return generatePlansQuick({ ...input, ...t.patch }) > 0;
  });
}

function generatePlansQuick(input: PlannerInput): number {
  const ages = input.children.map((c) => c.age);
  return ALL_PLACES.filter((p) => ACTIVITY.includes(p.category)).filter((p) => scorePlace(p, input, ages)).length;
}

/* ───────── Персональные рекомендации мест (главная, «Что потом?») ───────── */

export function rankPlaces(input: PlannerInput, filter?: (p: Place) => boolean): ScoredPlace[] {
  const ages = input.children.map((c) => c.age);
  return ALL_PLACES.filter((p) => !filter || filter(p))
    .map((p) => scorePlace(p, input, ages))
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as ScoredPlace[];
}
