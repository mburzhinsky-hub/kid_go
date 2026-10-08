#!/usr/bin/env node
/**
 * Скачивает фотографии из реестра (src/lib/data/photos.ts) в public/photos/,
 * чтобы сайт не зависел от images.unsplash.com (на части мобильных сетей он не открывается).
 * Три размера на фото: 480, 960, 1440 px, формат WebP. Уже скачанное пропускается.
 * Запуск: node scripts/fetch-photos.mjs   (нужен доступ в интернет — в CI он есть)
 */
import { readFileSync, mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";

export const WIDTHS = [480, 960, 1440];
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

console.log(`Фото: ${ids.length}, файлов ${jobs.length}: скачано ${done}, уже было ${skipped}, не удалось ${failed.length}`);
if (failed.length) console.log("Не скачались:", failed.slice(0, 20).join(", "));
if (done + skipped === 0) { console.error("Ни одного фото не скачано — проверьте доступ к images.unsplash.com"); process.exit(1); }
if (failed.length > jobs.length * 0.2) { console.error("Слишком много неудач (>20%)"); process.exit(1); }
