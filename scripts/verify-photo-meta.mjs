#!/usr/bin/env node
/**
 * Сверка src/lib/data/place-photos.json с самим Wikimedia Commons: файл существует, это JPEG/PNG,
 * лицензия и автор в данных совпадают с теми, что указаны на странице файла, ширина не меньше заявленной.
 *   node scripts/verify-photo-meta.mjs [--only=slug1,slug2]
 * Нужен доступ в интернет (в CI он есть, workflow «Photo verify»). Выход ≠ 0, если нашлась ошибка (нет файла, другая лицензия).
 * Расхождение в написании автора — только предупреждение.
 */
import { readFileSync } from "node:fs";

const FILE = new URL("../src/lib/data/place-photos.json", import.meta.url);
const data = JSON.parse(readFileSync(FILE, "utf8"));
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const UA = "KidsGoPhotoAudit/1.0 (https://kids-go.fun; https://github.com/mburzhinsky-hub/kid_go) node";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const entries = Object.entries(data)
  .filter(([s]) => !ONLY.length || ONLY.includes(s))
  .flatMap(([slug, list]) => list.map((p) => ({ slug, ...p, title: "File:" + p.f.replace(/_/g, " ") })));

const strip = (h) =>
  String(h ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
const norm = (s) => strip(s).toLowerCase().replace(/[^a-z0-9а-яё]+/g, " ").trim();
const normLic = (s) => String(s ?? "").replace(/^Creative Commons\s+/i, "").replace(/\s+/g, " ").trim().toUpperCase();

async function api(titles, tries = 6) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  const q = { action: "query", format: "json", formatversion: "2", redirects: "1", prop: "imageinfo", iiprop: "extmetadata|size|mime", iiextmetadatafilter: "LicenseShortName|Artist|NonFree|Restrictions", titles: titles.join("|"), maxlag: "8" };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (res.status === 429 || res.status >= 500) throw new Error("HTTP " + res.status);
      const j = await res.json();
      if (j.error?.code === "maxlag") throw new Error("maxlag");
      if (j.error) throw new Error(j.error.info);
      return j.query ?? {};
    } catch (e) {
      if (a === tries) throw e;
      await sleep(1200 * a);
    }
  }
}

const errors = [];
const warns = [];
let ok = 0;
for (let i = 0; i < entries.length; i += 25) {
  const chunk = entries.slice(i, i + 25);
  const q = await api(chunk.map((e) => e.title));
  const alias = new Map(); // название из запроса → итоговое (после нормализации и перенаправлений)
  for (const n of q.normalized ?? []) alias.set(n.from, n.to);
  const redirect = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
  const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
  for (const e of chunk) {
    let t = alias.get(e.title) ?? e.title;
    const moved = redirect.get(t);
    if (moved) { warns.push(`${e.slug}: «${e.f}» на Commons переименован в «${moved}»`); t = moved; }
    const p = pages.get(t);
    const info = p?.imageinfo?.[0];
    const where = `${e.slug}: «${e.f}»`;
    if (!p || p.missing || !info) { errors.push(`${where} — такого файла нет на Commons`); continue; }
    if (!/^image\/(jpeg|png)$/.test(info.mime ?? "")) errors.push(`${where} — формат ${info.mime}, нужен JPEG или PNG`);
    const m = info.extmetadata ?? {};
    const lic = normLic(m.LicenseShortName?.value);
    if (normLic(e.l) !== lic) errors.push(`${where} — лицензия на Commons «${m.LicenseShortName?.value ?? "не указана"}», в данных «${e.l}»`);
    if (m.NonFree?.value && m.NonFree.value !== "false") errors.push(`${where} — файл помечен как несвободный`);
    const author = norm(m.Artist?.value);
    const mine = norm(e.a);
    if (!author) warns.push(`${where} — на Commons не указан автор`);
    else if (!author.includes(mine) && !mine.includes(author)) warns.push(`${where} — автор в данных «${e.a}», на Commons «${strip(m.Artist.value).slice(0, 80)}»`);
    if (info.width < Math.min(e.w, 1920)) errors.push(`${where} — ширина на Commons ${info.width}px, в данных ${e.w}px`);
    else if (info.width < e.w) warns.push(`${where} — ширина на Commons ${info.width}px, в данных ${e.w}px`);
    ok++;
  }
}

console.log(`Снимков проверено: ${entries.length}, без замечаний по файлу: ${ok}`);
console.log(`::notice::Сверка с Commons: снимков ${entries.length}, найдено и проверено ${ok}, ошибок ${errors.length}, предупреждений ${warns.length}`);
for (const w of warns) { console.log("  ·", w); console.log(`::warning::${w}`); }
for (const e of errors) { console.log("  ✗", e); console.log(`::error::${e}`); }
if (errors.length) process.exit(1);
console.log("Сверка с Commons пройдена ✓");
