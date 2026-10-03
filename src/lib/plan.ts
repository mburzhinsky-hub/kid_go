import type { Place, Plan, PlanStop, Photo, TransportId } from "@/lib/types";
import { haversineKm, legMode, pt, travelMinutes } from "@/lib/geo";
import { ceilTo, fromMinutes, toMinutes } from "@/lib/format";

export interface StopInput {
  place: Place;
  duration?: number;
  note?: string;
  /** Зафиксированное время в пути (из редакторской Adventure). */
  travelOverride?: number;
}

export interface BuildPlanOptions {
  key: string;
  title: string;
  description?: string;
  emoji?: string;
  tint?: string;
  cover?: Photo;
  start?: string;
  transport?: TransportId;
  why?: string[];
  explanation?: string;
  adventureSlug?: string;
}

/** Буфер на сборы/туалет/одевание между точками — с детьми без него никак. */
const BUFFER = 10;

/**
 * Единая сборка маршрута: и для готовых приключений, и для сгенерированных,
 * и для «Нашего дня». Считает время, бюджет, расстояние и возраст.
 */
export function buildPlan(stopsIn: StopInput[], o: BuildPlanOptions): Plan {
  const transport = o.transport ?? "transit";
  let clock = toMinutes(o.start ?? "12:00");
  let distanceKm = 0;
  const stops: PlanStop[] = stopsIn.map((s, i) => {
    const duration = s.duration ?? s.place.average_duration;
    const stop: PlanStop = { place: s.place, start: fromMinutes(clock), duration, note: s.note };
    const next = stopsIn[i + 1];
    if (next) {
      const km = haversineKm(pt(s.place), pt(next.place));
      const mode = legMode(km, transport);
      const minutes = s.travelOverride ?? travelMinutes(km, mode);
      stop.travelToNext = { minutes, km, mode };
      distanceKm += km;
      clock = ceilTo(clock + duration + minutes + BUFFER, 5);
    } else {
      clock += duration;
    }
    return stop;
  });

  const first = stops[0]?.place;
  const totalMinutes = clock - toMinutes(o.start ?? "12:00");
  const budget = stops.reduce((sum, s) => sum + s.place.family_budget, 0);
  const ageMin = Math.max(...stops.map((s) => s.place.age_min));
  const ageMax = Math.min(...stops.map((s) => s.place.age_max));
  const indoor = stops.every((s) => s.place.indoor);
  const rainProof = stops.every((s) => s.place.indoor || s.place.weather_tags.includes("rain"));

  return {
    key: o.key,
    title: o.title,
    description: o.description ?? "",
    emoji: o.emoji ?? first?.emoji ?? "✨",
    tint: o.tint ?? first?.tint ?? "#FFE3EE",
    cover: o.cover ?? first?.photos[0] ?? { src: "", alt: "" },
    stops,
    totalMinutes,
    budget,
    distanceKm: Math.round(distanceKm * 10) / 10,
    ageMin,
    ageMax: Math.max(ageMin, ageMax),
    indoor,
    rainProof,
    why: o.why ?? [],
    explanation: o.explanation ?? "",
    adventureSlug: o.adventureSlug,
  };
}

/** Цепочка категорий для подписи «Музей → кафе → магазин игрушек». */
const CHAIN_LABEL: Record<Place["category"], string> = {
  park: "прогулка",
  play: "игровая",
  museum: "музей",
  active: "движение",
  animals: "животные",
  cafe: "кафе",
  shop: "магазин",
};

export function chainLabel(places: Place[]): string {
  const words = places.map((p, i) => {
    let w = CHAIN_LABEL[p.category];
    if (p.category === "shop" && p.experience_tags.includes("toys")) w = "магазин игрушек";
    if (p.category === "shop" && p.experience_tags.includes("books")) w = "книжный";
    if (p.category === "cafe" && p.experience_tags.includes("icecream")) w = "мороженое";
    if (p.category === "animals" && p.slug.includes("moskvarium")) w = "океанариум";
    if (p.category === "animals" && p.slug.includes("zoopark")) w = "зоопарк";
    if (p.category === "active" && p.title.includes("Батут")) w = "батуты";
    return i === 0 ? w[0].toUpperCase() + w.slice(1) : w;
  });
  return words.join(" → ");
}
