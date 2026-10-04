import { NextResponse } from "next/server";
import { generatePlans } from "@/lib/recommend/engine";
import { parseQuery } from "@/lib/recommend/nlu";
import { getWeather } from "@/lib/weather";
import { DEFAULT_LOCATION } from "@/lib/geo";
import type { PlannerInput } from "@/lib/types";

/**
 * POST /api/plan — тот же recommendation layer, что и в приложении.
 * Body: { children:[{name,age,interests}], duration, mood, budget, transport, location?, query? }
 * query (естественный язык) превращается в фильтры правилами из nlu.ts; места — только из базы.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PlannerInput> & { query?: string };
  const parsed = body.query ? parseQuery(body.query) : null;
  const now = new Date();
  const input: PlannerInput = {
    children: body.children ?? [],
    duration: parsed?.duration ?? body.duration ?? "mid",
    mood: parsed?.mood ?? body.mood ?? "surprise",
    budget: parsed?.budget ?? body.budget ?? "any",
    transport: parsed?.transport ?? body.transport ?? "transit",
    location: body.location ?? DEFAULT_LOCATION,
    // без точки в запросе — «вся Москва»: дорогу от дома не считаем
    locationMode: body.location ? "exact" : "any",
    weather: getWeather(now, parsed?.indoor ? "rain" : undefined),
    now,
    foodAfter: parsed?.foodAfter,
    maxDistanceKm: parsed?.maxDistanceKm,
    activity: parsed?.activity,
  };
  const result = generatePlans(input);
  return NextResponse.json({
    parsed,
    startLabel: result.startLabel,
    tomorrow: result.tomorrow,
    plans: result.plans.map((p) => ({
      title: p.title,
      explanation: p.explanation,
      why: p.why,
      totalMinutes: p.totalMinutes,
      budget: p.budget,
      distanceKm: p.distanceKm,
      stops: p.stops.map((s) => ({ slug: s.place.slug, title: s.place.title, start: s.start, duration: s.duration, travelToNext: s.travelToNext })),
    })),
    suggestions: result.suggestions,
  });
}
