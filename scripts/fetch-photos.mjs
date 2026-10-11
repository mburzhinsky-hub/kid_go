#!/usr/bin/env node
/**
 * Скачивает фотографии из реестра (src/lib/data/photos.ts) в public/photos/,
 * чтобы сайт не зависел от images.unsplash.com (на части мобильных сетей он не открывается).
 * Три размера на фото: 480, 960, 1440 px, формат WebP. Уже скачанное пропускается.
 *
 * Настоящие фото мест (Wikimedia Commons, список в src/lib/data/place-photos.json) скачиваются так же: один исходник
 * (до 1920 px по длинной стороне), из него sharp делает те же три WebP-размера и JPEG 1200×630 для превью ссылок.
 * Файлы называются по id из place-photos.json (cm-<хеш имени файла>), поэтому уже скачанное не перекачивается.
 * Запуск: node scripts/fetch-photos.mjs   (нужен доступ в интернет — в CI он есть)
 */
import { readFileSync, mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";

export const WIDTHS = [480, 960, 1440];
const UA = "KidsGoPhotoFetcher/1.0 (https://kids-go.fun; https://github.com/mburzhinsky-hub/kid_go) node";
const OUT = new URL("../public/photos/", import.meta.url);
const SRC = readFileSync(new URL("../src/lib/data/photos.ts", import.meta.url), "utf8");
const ids = [...new Set([...SRC.matchAll(/U\("(photo-[0-9a-zA-Z_-]+)"\)/g)].map((m) => m[1]))];

mkdirSync(OUT, { recursive: true });
const jobs = ids.flatMap((id) => WIDTHS.map((w) => ({ id, w })));
let done = 0, skipped = 0;
const failed = [];

async function one({ id, w, og }) {
  const file = new URL(og ? `${id}-og.jpg` : `${id}-${w}.webp`, OUT);
  if (existsSync(file) && statSync(file).size > 1000) { skipped++; return; }
  const url = og
    ? `https://images.unsplash.com/${id}?w=1200&h=630&q=78&fm=jpg&fit=crop&cs=tinysrgb`
    : `https://images.unsplash.com/${id}?w=${w}&q=70&fm=webp&fit=crop&cs=tinysrgb`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (res.status === 404 || res.status === 403) break; // фото удалено или закрыто — повторять нет смысла
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error("пустой ответ");
      writeFileSync(file, buf);
      done++;
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  failed.push(og ? `${id}-og` : `${id}-${w}`);
}

// Картинка для превью ссылок в мессенджерах: JPEG 1200×630 (WebP показывают не все)
for (const id of ids) jobs.push({ id, w: 1200, og: true });
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < jobs.length) await one(jobs[i++]); }));

// ── Настоящие фото мест из Wikimedia Commons ──
const COMMONS = JSON.parse(readFileSync(new URL("../src/lib/data/place-photos.json", import.meta.url), "utf8"));
const commons = Object.values(COMMONS).flat();
const commonsOut = (c) => [...WIDTHS.map((w) => new URL(`${c.i}-${w}.webp`, OUT)), new URL(`${c.i}-og.jpg`, OUT)];
const commonsFailed = [];
let commonsDone = 0, commonsSkipped = 0;

async function download(c) {
  // у Commons разрешены только стандартные ширины миниатюр; исходники уже 1920 px — берём как есть
  const base = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(c.f);
  const url = c.w > 1920 ? `${base}?width=1920` : base;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
      if (res.status === 404 || res.status === 403) return null; // файл удалён или закрыт — повторять нет смысла
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) || 5 * attempt;
        await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000));
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) throw new Error("пустой ответ");
      return buf;
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function oneCommons(c) {
  const files = commonsOut(c);
  if (files.every((f) => existsSync(f) && statSync(f).size > 1000)) { commonsSkipped++; return; }
  const buf = await download(c);
  if (!buf) { commonsFailed.push(c.i); return; }
  try {
    const { default: sharp } = await import("sharp");
    const img = () => sharp(buf, { failOn: "none" }).rotate();
    for (const w of WIDTHS) {
      writeFileSync(new URL(`${c.i}-${w}.webp`, OUT), await img().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer());
    }
    writeFileSync(new URL(`${c.i}-og.jpg`, OUT), await img().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer());
    commonsDone++;
  } catch (e) {
    console.log(`Не удалось обработать ${c.f}: ${e.message}`);
    commonsFailed.push(c.i);
  }
}

let ci = 0;
// Wikimedia просит не слать много запросов сразу: три потока
await Promise.all(Array.from({ length: 3 }, async () => { while (ci < commons.length) await oneCommons(commons[ci++]); }));

console.log(`Фото: ${ids.length}, файлов ${jobs.length}: скачано ${done}, уже было ${skipped}, не удалось ${failed.length}`);
console.log(`Настоящие фото мест (Commons): ${commons.length}: сделано ${commonsDone}, уже было ${commonsSkipped}, не удалось ${commonsFailed.length}`);
if (failed.length) {
  console.log("Не скачались:", failed.slice(0, 20).join(", "));
  // заметка в сводке выкладки: на сайте эти фото подставятся с фотохостинга или иллюстрацией
  console.log(`::warning title=Фото не скачались (${failed.length})::${failed.slice(0, 40).join(", ")}`);
}
if (commonsFailed.length) {
  console.log(`::warning title=Фото мест с Commons не скачались (${commonsFailed.length})::${commonsFailed.slice(0, 40).join(", ")}`);
}
if (done + skipped === 0) { console.error("Ни одного фото не скачано — проверьте доступ к images.unsplash.com"); process.exit(1); }
if (failed.length > jobs.length * 0.2) { console.error("Слишком много неудач (>20%)"); process.exit(1); }
if (commonsFailed.length > commons.length * 0.2) { console.error("Слишком много неудач с Commons (>20%)"); process.exit(1); }
