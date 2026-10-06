import type { MetadataRoute } from "next";
import { repo } from "@/lib/data/repository";
import { SEED_CREATORS } from "@/lib/social/seed";
import { seedCollectionsOf } from "@/lib/social/catalog";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kidgo.app";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, adventures] = await Promise.all([repo.listPlaces(), repo.listAdventures()]);
  const now = new Date();
  // публичные авторы и подборки; «по ссылке» и приватные в карту сайта не попадают
  const creators = SEED_CREATORS.filter((c) => c.status === "APPROVED");
  const collections = creators.flatMap(seedCollectionsOf).filter((r) => r.collection.visibility === "PUBLIC" && r.collection.status === "PUBLISHED");
  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/adventures`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/map`, lastModified: now, priority: 0.6 },
    ...adventures.map((a) => ({ url: `${SITE}/adventures/${a.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...creators.map((c) => ({ url: `${SITE}/@${c.username}/`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...collections.map((r) => ({ url: `${SITE}/@${r.author.username}/${r.collection.slug}/`, lastModified: new Date(r.collection.updated_at), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...places.map((p) => ({ url: `${SITE}/places/${p.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
