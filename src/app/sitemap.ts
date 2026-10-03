import type { MetadataRoute } from "next";
import { repo } from "@/lib/data/repository";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kidgo.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, adventures] = await Promise.all([repo.listPlaces(), repo.listAdventures()]);
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/adventures`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/map`, lastModified: now, priority: 0.6 },
    ...adventures.map((a) => ({ url: `${SITE}/adventures/${a.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...places.map((p) => ({ url: `${SITE}/places/${p.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
