/**
 * Фикстура Overpass для всех 11 округов: npx tsx scripts/gen-okrug-osm-fixture.ts > scripts/fixtures/okrug-osm.json
 * В каждом округе — точки на сетке вокруг центра, оставляем только те, что по нашей модели в этом округе. Типы чередуются
 * (парк, детский музей, зоопарк, каток, площадка, театр, библиотека, аквапарк), чтобы покрыть разные ситуации.
 * `meta` — какому округу принадлежит каждый элемент: по нему браузерный тест проверяет, что в план попали только «свои».
 */
import { OKRUGS } from "../src/lib/location";
import { okrugAtPoint } from "../src/lib/moscow";

const KINDS: { tags: Record<string, string>; cat: string }[] = [
  { tags: { leisure: "park", name: "Парк «Тестовый»" }, cat: "park" },
  { tags: { tourism: "museum", name: "Детский музей науки «Тест»" }, cat: "museum" },
  { tags: { tourism: "zoo", name: "Контактный зоопарк «Тест»" }, cat: "animals" },
  { tags: { leisure: "ice_rink", name: "Каток «Тест»" }, cat: "active" },
  { tags: { leisure: "playground", name: "Детская площадка «Тест»" }, cat: "park" },
  { tags: { amenity: "theatre", name: "Детский театр «Тест»" }, cat: "museum" },
  { tags: { amenity: "library", name: "Детская библиотека «Тест»" }, cat: "museum" },
  { tags: { leisure: "water_park", name: "Аквапарк «Тест»" }, cat: "active" },
  { tags: { leisure: "garden", name: "Сад «Тест»" }, cat: "park" },
  { tags: { amenity: "cafe", name: "Кафе «Тест»" }, cat: "cafe" },
  { tags: { shop: "toys", name: "Магазин игрушек «Тест»" }, cat: "shop" },
];

const elements: Record<string, unknown[]> = {};
const meta: Record<string, { okrug: string; cat: string }> = {};
let id = 9_000_000;
for (const o of OKRUGS) {
  const pts: { lat: number; lng: number }[] = [];
  const span = o.id === "nao" ? 0.2 : 0.09;
  const step = span / 6;
  for (let dy = -span; dy <= span; dy += step) {
    for (let dx = -span * 1.6; dx <= span * 1.6; dx += step * 1.6) {
      const p = { lat: +(o.lat + dy).toFixed(5), lng: +(o.lng + dx).toFixed(5) };
      if (okrugAtPoint(p) === o.id) pts.push(p);
    }
  }
  const els: unknown[] = [];
  pts.slice(0, 44).forEach((p, i) => {
    const k = KINDS[i % KINDS.length];
    id++;
    els.push({ type: "way", id, tags: { ...k.tags, name: `${k.tags.name} ${o.short} ${i + 1}` }, center: { lat: p.lat, lon: p.lng } });
    meta[`osm-w${id}`] = { okrug: o.id, cat: k.cat };
  });
  elements[o.id] = els;
}
console.log(JSON.stringify({ elements, meta }));
