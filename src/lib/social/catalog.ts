/**
 * Чтение подборок без состояния устройства — безопасно на сервере (SSG, метаданные, sitemap).
 * Здесь только демо-каталог и чистые функции; всё, что зависит от устройства, — в repo.ts.
 */
import type { Photo, Place } from "@/lib/types";
import type { AuthorRef, Collection, CollectionCover, CollectionItem, CreatorProfile, ResolvedCollection } from "./types";
import { SEED_COLLECTIONS, SEED_CREATORS } from "./seed";
import { getPlaceSync } from "@/lib/data/repository";
import { plural, formatAgeRange } from "@/lib/format";

export const authorOf = (c: CreatorProfile, hasPage = true): AuthorRef => ({ id: c.user_id, name: c.display_name, username: c.username, avatar: c.avatar, tint: c.tint, hasPage });

export const normalizeHandle = (h: string) => {
  let v = h;
  try {
    v = decodeURIComponent(h);
  } catch {
    /* оставляем как есть */
  }
  return v.replace(/^@/, "").toLowerCase();
};

export const seedCreators = () => SEED_CREATORS.filter((c) => c.status === "APPROVED");
export const seedCreatorByHandle = (handle: string) => SEED_CREATORS.find((c) => c.username === normalizeHandle(handle));
export const seedCreatorById = (id: string) => SEED_CREATORS.find((c) => c.user_id === id);

export const seedCollectionsOf = (creator: CreatorProfile): ResolvedCollection[] =>
  SEED_COLLECTIONS.filter((c) => c.user_id === creator.user_id && c.status === "PUBLISHED").map((collection) => ({ collection, author: authorOf(creator), source: "seed" as const }));

export const seedCollection = (handle: string, slug: string): ResolvedCollection | null => {
  const creator = seedCreatorByHandle(handle);
  if (!creator) return null;
  return seedCollectionsOf(creator).find((r) => r.collection.slug === slug) ?? null;
};

export const seedViews = (): ResolvedCollection[] => seedCreators().flatMap(seedCollectionsOf);

/** Кириллица → латиница для адреса вида /@автор/slug. */
const TR: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
export function slugify(s: string, max = 48): string {
  const out = s
    .toLowerCase()
    .split("")
    .map((ch) => TR[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return out || "collection";
}

export interface PlacedItem {
  item: CollectionItem;
  place: Place;
}

/** Места подборки в порядке автора. Недоступные (убрали из каталога) отдельно — их считаем, но не показываем пустыми карточками. */
export function placesOf(c: Collection): { placed: PlacedItem[]; missing: number } {
  const placed: PlacedItem[] = [];
  let missing = 0;
  for (const item of [...c.items].sort((a, b) => a.position - b.position)) {
    const place = getPlaceSync(item.place_id);
    if (place) placed.push({ item, place });
    else missing++;
  }
  return { placed, missing };
}

export type CoverTile = { photo: Photo; tint: string; emoji: string };
export type CoverArt = { kind: "photo"; tile: CoverTile } | { kind: "collage"; tiles: CoverTile[] };

const tileOf = (p: Place): CoverTile => ({ photo: p.photos[0], tint: p.tint, emoji: p.emoji });

export function coverOf(c: Collection, placed: PlacedItem[]): CoverArt {
  const first = placed[0]?.place;
  if (c.cover.kind === "collage" && placed.length >= 2) return { kind: "collage", tiles: placed.slice(0, 4).map((x) => tileOf(x.place)) };
  const slug = c.cover.kind === "place" ? c.cover.slug : undefined;
  const chosen = (slug && placed.find((x) => x.place.slug === slug)?.place) || first;
  if (chosen) return { kind: "photo", tile: tileOf(chosen) };
  if (c.cover_image) return { kind: "photo", tile: { photo: c.cover_image, tint: "#FFE3EE", emoji: "🗺️" } };
  return { kind: "photo", tile: { photo: { src: "", alt: c.title }, tint: "#FFE3EE", emoji: "🗺️" } };
}

export const placesWord = (n: number) => `${n} ${plural(n, "место", "места", "мест")}`;

export function settingLabel(placed: PlacedItem[]): string | undefined {
  if (!placed.length) return undefined;
  if (placed.every((x) => x.place.indoor && !x.place.outdoor)) return "В помещении";
  if (placed.every((x) => x.place.outdoor && !x.place.indoor)) return "На воздухе";
  return "В помещении и на воздухе";
}

/** «7 мест · Москва · 3–8 лет · В помещении» */
export function metaLine(c: Collection, placed: PlacedItem[]): string {
  return [placesWord(placed.length), c.city, formatAgeRange(c.age_min, c.age_max), settingLabel(placed)].filter(Boolean).join(" · ");
}

export const coverCoverSlug = (cv: CollectionCover) => (cv.kind === "place" ? cv.slug : undefined);

/** Сколько мест стоят денег / бесплатных — для карточки «бесплатно». */
export function freePlaces(placed: PlacedItem[]) {
  return placed.filter((x) => x.place.price_max === 0).length;
}
