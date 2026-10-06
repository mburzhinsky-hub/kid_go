import type { Plan, PlanStop } from "@/lib/types";

/** Store the selected meal stops, including an explicit empty selection. */
export function withPlanMeals(href: string, plan: Pick<Plan, "stops">): string {
  const url = new URL(href, "https://kidgo.invalid");
  if (url.pathname !== "/day") return href;
  url.searchParams.set("meals", plan.stops.filter((s) => s.foodOption === true).map((s) => s.place.slug).join(","));
  return `${url.pathname}${url.search}${url.hash}`;
}

/** null means a legacy/manual link; an empty Set explicitly means no meals. */
export function mealsFromSearch(search: string): Set<string> | null {
  const query = new URLSearchParams(search);
  if (!query.has("meals")) return null;
  return new Set((query.get("meals") ?? "").split(",").filter(Boolean));
}

export function applyPlanMeals(stops: PlanStop[], totalMinutes: number): void {
  const available = (s: PlanStop) => s.place.category === "cafe" || !!s.place.menu_url;
  for (const stop of stops) {
    if (stop.foodOption === true && !available(stop)) stop.foodOption = false;
  }
  // Do not override a generated itinerary's explicit true/false selection.
  if (stops.some((s) => s.foodOption === true) || stops.every((s) => s.foodOption === false)) return;
  const candidates = stops.filter((s) => s.foodOption == null);
  const meal = candidates.find((s) => s.place.category === "cafe") ??
    (totalMinutes >= 180 ? candidates.find((s) => !!s.place.menu_url) : undefined);
  for (const stop of candidates) stop.foodOption = stop === meal;
}
