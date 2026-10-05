import type { Adventure, Plan } from "@/lib/types";
import type { AdventureCardData } from "@/components/cards/AdventureCard";
import { adventurePlaces } from "@/lib/data/repository";
import { chainLabel } from "@/lib/plan";
import { formatAgeRange, formatDurationShort, priceLevelLabel } from "@/lib/format";
import { areasOfPlaces } from "@/lib/area-fit";

const level = (budget: number) => (budget === 0 ? 0 : budget < 2500 ? 1 : budget < 5000 ? 2 : 3);

export function adventureCardData(a: Adventure): AdventureCardData {
  const places = adventurePlaces(a);
  return {
    href: `/adventures/${a.slug}`,
    title: a.title,
    chain: chainLabel(places),
    cover: a.cover_image,
    tint: a.tint,
    emoji: a.emoji,
    age: formatAgeRange(a.age_min, a.age_max),
    duration: formatDurationShort(a.estimated_duration),
    price: priceLevelLabel(level(a.estimated_budget)),
    indoor: a.weather_tags.includes("rain"),
    recommend: a.recommend_percent,
    thumbs: places.map((p) => ({ ...p.photos[0], tint: p.tint, emoji: p.emoji })),
    areas: areasOfPlaces(places),
  };
}


/** Сгенерированный план → данные карточки. */
export function planCardData(plan: Plan, href: string, fromLabel?: string): AdventureCardData {
  const places = plan.stops.map((s) => s.place);
  return {
    href,
    title: plan.title,
    chain: chainLabel(places),
    cover: plan.cover,
    tint: plan.tint,
    emoji: plan.emoji,
    age: formatAgeRange(plan.ageMin, plan.ageMax),
    duration: formatDurationShort(plan.totalMinutes),
    price: priceLevelLabel(level(plan.budget)),
    indoor: plan.rainProof,
    thumbs: places.map((p) => ({ ...p.photos[0], tint: p.tint, emoji: p.emoji })),
    why: plan.why,
    explanation: plan.explanation,
    fromHome: plan.fromHome ? `📍 ${plan.fromHome.approx ? "≈ " : ""}${plan.fromHome.minutes} мин ${fromLabel ?? "от вас"} · старт ${plan.stops[0]?.start}` : undefined,
  };
}
