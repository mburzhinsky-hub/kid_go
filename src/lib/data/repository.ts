import type { Adventure, CategoryId, KidEvent, Place } from "@/lib/types";
import { places, placeById, placeBySlug } from "./places";
import { adventures, adventureBySlug } from "./adventures";
import { getEventsSeed } from "./events";
import { haversineKm, pt } from "@/lib/geo";

/**
 * Data access layer. Сейчас — in-memory seed, интерфейс асинхронный,
 * чтобы заменить реализацию на Prisma/Drizzle + PostGIS без правок в UI.
 * (См. prisma/schema.prisma и README → «Подключение БД».)
 */
export interface DataRepository {
  listPlaces(filter?: { category?: CategoryId }): Promise<Place[]>;
  getPlace(slug: string): Promise<Place | null>;
  getPlacesByIds(ids: string[]): Promise<Place[]>;
  nearby(place: Place, opts?: { category?: CategoryId; limit?: number; radiusKm?: number }): Promise<(Place & { km: number })[]>;
  listAdventures(): Promise<Adventure[]>;
  getAdventure(slug: string): Promise<Adventure | null>;
  listEvents(): Promise<KidEvent[]>;
}

const mockRepository: DataRepository = {
  async listPlaces(filter) {
    return filter?.category ? places.filter((p) => p.category === filter.category) : places;
  },
  async getPlace(slug) {
    return placeBySlug.get(slug) ?? null;
  },
  async getPlacesByIds(ids) {
    return ids.map((id) => placeById.get(id)).filter(Boolean) as Place[];
  },
  async nearby(place, opts = {}) {
    // В PostGIS: ST_DWithin(geom, $point, radius) ORDER BY geom <-> $point
    return places
      .filter((p) => p.id !== place.id && (!opts.category || p.category === opts.category))
      .map((p) => ({ ...p, km: haversineKm(pt(place), pt(p)) }))
      .filter((p) => p.km <= (opts.radiusKm ?? 6))
      .sort((a, b) => a.km - b.km)
      .slice(0, opts.limit ?? 6);
  },
  async listAdventures() {
    return adventures;
  },
  async getAdventure(slug) {
    return adventureBySlug.get(slug) ?? null;
  },
  async listEvents() {
    return getEventsSeed();
  },
};

export const repo: DataRepository = mockRepository;

/* ---------- синхронные хелперы для клиентских компонентов (mock-only) ---------- */

export const allPlaces = places;
export const allAdventures = adventures;
export const getPlaceSync = (slug: string) => placeBySlug.get(slug) ?? null;

export { distanceFromUser } from "@/lib/geo";

export function adventurePlaces(a: Adventure): Place[] {
  return a.steps.map((s) => placeById.get(s.place_id)!);
}
