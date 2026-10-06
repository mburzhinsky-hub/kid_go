import type { ParkingInfo, Place } from "@/lib/types";
import e1 from "./editorial/editorial-1.json";
import e2 from "./editorial/editorial-2.json";
import e3 from "./editorial/editorial-3.json";
import e4 from "./editorial/editorial-4.json";
import e5 from "./editorial/editorial-5.json";
import e6 from "./editorial/editorial-6.json";
import e7 from "./editorial/editorial-7.json";
import e8 from "./editorial/editorial-8.json";
import e9 from "./editorial/editorial-9.json";
import e10 from "./editorial/editorial-10.json";

export interface EditorialPlaceFacts {
  parking: ParkingInfo;
  menu_url?: string | null;
  rating?: number | null;
  rating_source?: string | null;
  editorial_note?: string | null;
}

const EDITORIAL = {
  ...e1, ...e2, ...e3, ...e4, ...e5,
  ...e6, ...e7, ...e8, ...e9, ...e10,
} as unknown as Record<string, EditorialPlaceFacts>;

export function editorialForPlace(slug: string): EditorialPlaceFacts | undefined {
  return EDITORIAL[slug];
}

/**
 * Редакторский overlay из таблицы 06.10.2026.
 * Он не подменяет базовые identity/price/hours, а добавляет подтверждённые
 * parking/menu/rating facts единым слоем для старого и нового каталога.
 */
export function applyEditorialFacts(place: Place): Place {
  const facts = editorialForPlace(place.slug);
  if (!facts) return place;
  const ratingVerified = facts.rating != null && !!facts.rating_source;
  const unknown = (place.unknown_fields ?? []).filter((field) => field !== "parking");
  return {
    ...place,
    parking_info: facts.parking,
    // Legacy boolean нужен старому UI/алгоритмам; partial/unknown не выдаём за полноценную парковку.
    parking: facts.parking.status === "yes",
    menu_url: facts.menu_url || undefined,
    editorial_note: facts.editorial_note || undefined,
    rating: ratingVerified ? facts.rating! : place.rating,
    rating_source: ratingVerified ? facts.rating_source! : place.rating_source,
    unknown_fields: facts.parking.status === "unknown" ? [...unknown, "parking"] : unknown,
  };
}

export const EDITORIAL_SLUGS = Object.freeze(Object.keys(EDITORIAL));
