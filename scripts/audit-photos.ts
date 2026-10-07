/**
 * Аудит картинок: фото на странице места должно быть про это место, а соседние места не должны показывать одно и то же.
 *   npx tsx scripts/audit-photos.ts [--warn]
 *
 * ERROR:
 *  1. у кадра нет темы (PH_THEME) — новый кадр нельзя добавить «без темы»;
 *  2. кадр не по теме места (зоопарк с театром, музей транспорта с игрушечными лодками…);
 *  3. обложка (первый кадр) совпадает с обложкой другого места;
 *  4. два места показывают почти одну и ту же галерею (3 и более общих кадра);
 *  5. места разных типов (зоопарк и театр, музей и магазин…) делят 2 и более кадра;
 *  6. кадр повторяется внутри места, кадров меньше двух.
 * WARN (--warn): места одного типа делят 2 кадра, кадры PH, которые нигде не используются.
 * Выход ≠ 0 при любой ERROR.
 */
import { allPlaces } from "../src/lib/data/repository";
import { PH } from "../src/lib/data/photos";
import { PH_THEME, KEY_OF_SRC, allowedThemes } from "../src/lib/data/photo-themes";
import type { Place } from "../src/lib/types";

const SHOW_WARN = process.argv.includes("--warn");
const errors: string[] = [];
const warns: string[] = [];
const E = (m: string) => errors.push(m);
const W = (m: string) => warns.push(m);

// 1. тема у каждого кадра
for (const k of Object.keys(PH)) if (!PH_THEME[k as keyof typeof PH]) E(`кадр ${k}: нет темы в photo-themes.ts`);

// 2. кадры по теме места; 6. повторы и минимум
const keyOf = (src: string) => KEY_OF_SRC.get(src);
for (const p of allPlaces) {
  const allowed = allowedThemes(p);
  const seen = new Set<string>();
  if (p.photos.length < 2) E(`${p.slug}: кадров меньше двух (${p.photos.length})`);
  for (const ph of p.photos) {
    if (seen.has(ph.src)) E(`${p.slug}: кадр повторяется внутри места`);
    seen.add(ph.src);
    const k = keyOf(ph.src);
    if (!k) {
      W(`${p.slug}: кадр вне реестра PH (${ph.src.slice(-24)}) — тема не проверена`);
      continue;
    }
    const theme = PH_THEME[k];
    if (!allowed.has(theme)) E(`${p.slug} (${p.title.slice(0, 32)}): кадр «${k}» — тема «${theme}», а место про: ${[...allowed].join(", ")}`);
  }
}

// 3. обложки
{
  const covers = new Map<string, string>();
  for (const p of allPlaces) {
    const c = p.photos[0]?.src;
    if (!c) continue;
    if (covers.has(c)) E(`${p.slug}: обложка совпадает с «${covers.get(c)}»`);
    else covers.set(c, p.slug);
  }
}

// 4–5. общие кадры
const kindOf = (p: Place) => p.place_type ?? p.category;
/** Типы, у которых общая тематика: делить кадры между ними не странно. */
const SAME_FAMILY: string[][] = [
  ["park", "play_center"],
  ["cafe", "food_hall", "restaurant"],
];
const sameFamily = (a: string, b: string) => a === b || SAME_FAMILY.some((f) => f.includes(a) && f.includes(b));
const maxShare = new Map<string, number>();
for (let i = 0; i < allPlaces.length; i++) {
  const A = allPlaces[i];
  const a = new Set(A.photos.map((x) => x.src));
  for (let j = i + 1; j < allPlaces.length; j++) {
    const B = allPlaces[j];
    const shared = B.photos.filter((x) => a.has(x.src)).map((x) => keyOf(x.src) ?? "?");
    const n = shared.length;
    if (n > (maxShare.get(A.slug) ?? 0)) maxShare.set(A.slug, n);
    if (n >= 3) E(`${A.slug} ≈ ${B.slug}: почти одинаковые галереи (${n} общих: ${shared.join(", ")})`);
    else if (n >= 2) {
      if (!sameFamily(kindOf(A), kindOf(B))) E(`${A.slug} (${kindOf(A)}) и ${B.slug} (${kindOf(B)}) делят ${n} кадра: ${shared.join(", ")}`);
      else W(`${A.slug} и ${B.slug} (одного типа) делят ${n} кадра: ${shared.join(", ")}`);
    }
  }
}

// WARN: неиспользуемые кадры
{
  const used = new Set(allPlaces.flatMap((p) => p.photos.map((x) => x.src)));
  const unused = (Object.entries(PH) as [string, string][]).filter(([, v]) => !used.has(v)).map(([k]) => k);
  if (unused.length) W(`кадры PH, которые нигде не показываются (${unused.length}): ${unused.join(", ")}`);
}

console.log(`Мест: ${allPlaces.length}, кадров в реестре: ${Object.keys(PH).length}`);
if (SHOW_WARN && warns.length) {
  console.log(`\nПредупреждения (${warns.length}):`);
  for (const w of warns) console.log("  ·", w);
}
if (errors.length) {
  console.log(`\nОШИБКИ (${errors.length}):`);
  for (const e of errors) console.log("  ✗", e);
  process.exit(1);
}
console.log(`\nАудит картинок пройден ✓ (предупреждений: ${warns.length}, --warn — показать)`);
