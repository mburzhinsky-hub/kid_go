#!/usr/bin/env node
/**
 * Готовит для сайта фото, которые прислало само место (kind «partner», данные — src/lib/data/partner-photos.json).
 *   node scripts/add-partner-photo.mjs <файл.jpg> [<файл.jpg> …]
 * Для каждого файла кладёт в public/partner/ три WebP (480, 960, 1440 px по ширине, без увеличения) и JPEG 1200×630 для превью ссылок
 * (если исходник шире 1200 px), поворачивает по EXIF и стирает метаданные (геометки и т. п.).
 * id снимка = pt-<первые 10 символов sha1 от имени файла>, адрес в данных — /partner/<id>.
 * В конце печатает строки {f, i, w} для partner-photos.json; подпись (alt) к каждому снимку вписывается вручную.
 * Файлы из письма — чужие данные: проверять глазами, никаких людей в кадре без разрешения.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const WIDTHS = [480, 960, 1440];
const OUT = new URL("../public/partner/", import.meta.url);
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Использование: node scripts/add-partner-photo.mjs <файл.jpg> [...]");
  process.exit(2);
}
const { default: sharp } = await import("sharp");
mkdirSync(OUT, { recursive: true });

const rows = [];
for (const file of files) {
  const name = basename(file);
  const id = "pt-" + createHash("sha1").update(name).digest("hex").slice(0, 10);
  const buf = readFileSync(file);
  const img = () => sharp(buf, { failOn: "none" }).rotate(); // rotate() без аргументов — по EXIF; метаданные в результат не попадают
  const meta = await img().toBuffer({ resolveWithObject: true });
  const w = meta.info.width;
  for (const t of WIDTHS) {
    writeFileSync(new URL(`${id}-${t}.webp`, OUT), await img().resize({ width: t, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer());
  }
  if (w >= 1200) {
    writeFileSync(new URL(`${id}-og.jpg`, OUT), await img().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer());
  } else {
    console.warn(`  · ${name}: ширина ${w} px, превью ссылки не делаю (ставьте этот снимок не первым)`);
  }
  rows.push({ f: name, i: id, w });
}
console.log(JSON.stringify(rows, null, 2));
