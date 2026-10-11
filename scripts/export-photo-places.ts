/**
 * Список мест для поиска настоящих фото: slug, название, координаты, тип.
 *   npx tsx scripts/export-photo-places.ts > places.json
 * Нужен scripts/commons-probe.mjs (он запускается в CI, где есть доступ к Wikimedia).
 */
import { allPlaces } from "../src/lib/data/repository";

const rows = allPlaces.map((p) => ({
  slug: p.slug,
  title: p.title,
  town: p.town ?? "",
  type: p.place_type ?? p.category,
  category: p.category,
  lat: p.latitude,
  lng: p.longitude,
  address: p.address,
  source: p.source ?? "",
}));
process.stdout.write(JSON.stringify(rows, null, 1));
