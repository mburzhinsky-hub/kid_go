/**
 * Данные каталога для сервера (кладутся в api/data/ при деплое, в репозиторий не попадают):
 *  - places.json — допустимые slug мест (сервер отбрасывает чужие id в подборках);
 *  - place-index.json — slug → название и id фото (для описания и картинки превью ссылок).
 *  npx tsx scripts/gen-api-data.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { places } from "../src/lib/data/places";

const dir = new URL("../api/data/", import.meta.url);
mkdirSync(dir, { recursive: true });

const all = places;
const seen = new Set<string>();
const slugs: string[] = [];
const index: Record<string, { n: string; p: string | null }> = {};
for (const p of all) {
  if (!p?.slug || seen.has(p.slug) || p.slug.startsWith("osm-")) continue;
  seen.add(p.slug);
  slugs.push(p.slug);
  const src = p.photos?.[0]?.src ?? "";
  const m = src.match(/^https:\/\/images\.unsplash\.com\/(photo-[0-9a-zA-Z_-]+)/);
  index[p.slug] = { n: p.title, p: m ? m[1] : null };
}
writeFileSync(new URL("places.json", dir), JSON.stringify(slugs));
writeFileSync(new URL("place-index.json", dir), JSON.stringify(index));
console.log(`api/data: мест ${slugs.length}, с фото ${Object.values(index).filter((x) => x.p).length}`);
