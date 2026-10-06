import assert from "node:assert/strict";
import { places } from "../src/lib/data/places";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";
import { buildPlan } from "../src/lib/plan";
import { withPlanMeals, mealsFromSearch } from "../src/lib/food";
import { generatePlans, rankPlaces } from "../src/lib/recommend/engine";
import { buildPlannerInput } from "../src/lib/recommend/build-input";
import { demoForecast } from "../src/lib/forecast";
import { DEFAULT_ORIGIN } from "../src/lib/location";
import newCafes from "../src/lib/data/extra/msk-family-cafes.places.json";

assert.equal(places.length, 146);
assert.equal(SCENARIO_LIBRARY.length, 78);
assert.equal(places.filter((p) => p.menu_url).length, 64);
assert.ok(!places.some((p) => ["joki-joya", "katok-na-poyme-pavshino"].includes(p.slug)));
const cafe = places.find((p) => p.slug === "dream-kids")!;
const venue = places.find((p) => p.slug === "moskvarium")!;
assert.ok(cafe && venue && cafe.menu_url && venue.menu_url);
const opts = { key: "regression", title: "Проверка", start: "12:00" };
const withoutFood = buildPlan([{ place: venue, duration: 240, foodOption: false }], opts);
assert.ok(withoutFood.stops.every((s) => s.foodOption === false), "Explicit no-food must survive rebuilding");
const onsite = buildPlan([{ place: venue, duration: 120, foodOption: true }], opts);
assert.equal(onsite.stops[0].foodOption, true, "Explicit food is retained even in a short plan");
const short = buildPlan([{ place: venue, duration: 100 }], opts);
assert.equal(short.stops[0].foodOption, false, "A menu URL alone must not add food to a short outing");
const curated = buildPlan([{ place: venue, duration: 240 }], opts);
assert.equal(curated.stops[0].foodOption, true, "Long curated day can use food on site");
for (const plan of [withoutFood, onsite]) {
  const href = withPlanMeals("/day?steps=moskvarium&d=120", plan);
  const selected = mealsFromSearch(href.split("?")[1]);
  assert.ok(selected !== null);
  const restored = buildPlan(plan.stops.map((s) => ({ place: s.place, duration: s.duration, foodOption: selected!.has(s.place.slug) })), opts);
  assert.deepEqual(restored.stops.map((s) => s.foodOption), plan.stops.map((s) => s.foodOption));
}
assert.equal(mealsFromSearch("steps=moskvarium"), null);
assert.equal(mealsFromSearch("meals=")!.size, 0);
const now = new Date("2026-10-10T08:00:00Z");
const forecast = demoForecast(DEFAULT_ORIGIN, "sun", now);
const input = buildPlannerInput({ query: { s: "coffee", budget: "any" }, kids: [{ name: "", age: 5, interests: [] }], origin: DEFAULT_ORIGIN, prefs: { budget: "any", transport: "transit", maxTravelMin: 40 }, forecast, now });
const newSlugs = new Set(newCafes.map((p) => p.slug));
const ranked = rankPlaces(input, (p) => p.category === "cafe");
assert.ok(ranked.some((p) => newSlugs.has(p.place.slug)), "New cafes must enter the real ranking pool");
const plans = generatePlans(input).plans;
assert.ok(plans.length > 0);
assert.ok(plans.some((p) => p.stops.some((s) => newSlugs.has(s.place.slug))), "New family cafes must appear in relevant generated itineraries");
for (const p of plans) for (const s of p.stops) {
  if (s.foodOption) assert.ok(s.place.category === "cafe" || s.place.menu_url);
}
console.log("Editorial regression tests passed: catalog, menu links, no-food round trip, new cafes in planner");
