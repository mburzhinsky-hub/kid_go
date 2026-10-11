#!/usr/bin/env node
/**
 * Поиск настоящих фото мест в Wikimedia Commons (свободные лицензии).
 *   node scripts/commons-probe.mjs places.json outdir [--only=slug1,slug2]
 *
 * Для каждого места собираем кандидатов из трёх источников и оцениваем:
 *   1. геопоиск Commons вокруг координат места (дальше — только если снимок назван или описан этим местом);
 *   2. категория Commons и главное фото элемента Wikidata (P373, P18), если такой элемент рядом с местом и его название совпадает;
 *   3. поиск по названию (низкая уверенность: снимок должен быть привязан к координатам не дальше 3 км).
 * Берём только JPEG/PNG от 900 px с лицензией CC0 / общественное достояние / CC BY / CC BY-SA, с указанием автора.
 * Результат: outdir/candidates.json (все кандидаты с оценкой), outdir/thumbs/<slug>/<n>.jpg (превью для просмотра глазами),
 * outdir/summary.txt. Нужен доступ в интернет — в CI он есть.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [, , PLACES, OUT, ...rest] = process.argv;
if (!PLACES || !OUT) { console.error("node scripts/commons-probe.mjs places.json outdir [--only=a,b]"); process.exit(2); }
const ONLY = (rest.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const TOP = 6; // сколько кандидатов оставляем на место
const UA = "KidsGoPhotoAudit/1.0 (https://kids-go.fun; https://github.com/mburzhinsky-hub/kid_go) node";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA = "https://www.wikidata.org/w/api.php";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function api(base, params, tries = 6) {
  const u = new URL(base);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", maxlag: "8", ...params })) u.searchParams.set(k, String(v));
  for (let a = 1; a <= tries; a++) {
    const wait = Math.max(0, last + 140 - Date.now()); // не чаще ~7 запросов в секунду
    last = Date.now() + wait;
    if (wait) await sleep(wait);
    try {
      const res = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (res.status === 429 || res.status >= 500) throw new Error("HTTP " + res.status);
      const j = await res.json();
      if (j.error?.code === "maxlag") throw new Error("maxlag");
      return j;
    } catch (e) {
      if (a === tries) { console.warn("  api fail:", String(e).slice(0, 80), u.search.slice(0, 80)); return {}; }
      await sleep(900 * a);
    }
  }
}

/* ───── слова: сравнение названия места с названием файла/описанием (кириллица ↔ латиница) ───── */
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const translit = (s) => [...s.toLowerCase()].map((c) => TR[c] ?? c).join("");
const STOP = new Set("парк музей усадьба центр детский детская детское игровой игровая кафе ресторан театр цирк имени города района области московской москвы москва московский клуб площадка сад зона зал дом".split(" "));
function stems(title) {
  const words = title.toLowerCase().replace(/[«»"“”().,:;!?—–\-/]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set(words.flatMap((w) => [w.slice(0, 5), translit(w).slice(0, 5)]))];
}
const hits = (stemList, text) => { const t = (text + " " + translit(text)).toLowerCase(); return stemList.filter((s) => s.length >= 4 && t.includes(s)).length; };
const strip = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
const km = (a, b, c, d) => { const R = 6371, rad = Math.PI / 180, dl = (c - a) * rad, dn = (d - b) * rad; const x = Math.sin(dl / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

const OK_LICENSE = /^(CC0|Public domain|PD[- ]|CC[- ]BY(-SA)?[- ]?\d|CC[- ]BY(-SA)?$|Attribution|No restrictions)/i;
const BAD_NAME = /\b(map|plan|scheme|logo|flag|coat[ _]of[ _]arms|diagram|scan|poster|stamp|icon|sign|plaque|signature|screenshot)\b|\.(svg|tif|tiff|pdf|gif|webm|ogv|ogg)$|карта|схема|герб|логотип|флаг|мемориальн[а-я]+ доск/i;

/* ───── кандидаты для одного места ───── */
async function wikidataFor(p) {
  const clean = p.title.replace(/[«»"“”]/g, "").replace(/\s+—.*$/, "").trim();
  const queries = [...new Set([clean, p.title.replace(/^(Парк|Музей|Усадьба|Театр)\s+/i, "").replace(/[«»"“”]/g, "").trim()])].filter((q) => q.length > 3);
  const ids = new Set();
  for (const q of queries) {
    const r = await api(WIKIDATA, { action: "wbsearchentities", search: q, language: "ru", uselang: "ru", limit: 6, type: "item" });
    for (const e of r.search ?? []) ids.add(e.id);
  }
  if (!ids.size) return null;
  const ents = await api(WIKIDATA, { action: "wbgetentities", ids: [...ids].join("|"), props: "claims|labels", languages: "ru|en" });
  const sv = stems(p.title);
  let best = null;
  for (const e of Object.values(ents.entities ?? {})) {
    const c = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (!c) continue;
    const d = km(p.lat, p.lng, c.latitude, c.longitude);
    if (d > 3) continue;
    const label = (e.labels?.ru?.value ?? "") + " " + (e.labels?.en?.value ?? "");
    const h = hits(sv, label);
    if (sv.length && !h) continue;
    const cat = e.claims?.P373?.[0]?.mainsnak?.datavalue?.value;
    const img = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!cat && !img) continue;
    const sc = h * 2 - d;
    if (!best || sc > best.sc) best = { id: e.id, label: e.labels?.ru?.value ?? e.labels?.en?.value, cat, img, d, sc };
  }
  return best;
}

async function collect(p) {
  const pool = new Map(); // File:… → { via:Set, dist }
  const add = (title, via, dist) => {
    if (!/^File:/i.test(title)) return;
    const c = pool.get(title) ?? { via: new Set(), dist: Infinity };
    c.via.add(via);
    if (dist != null) c.dist = Math.min(c.dist, dist);
    pool.set(title, c);
  };
  const wide = p.type === "park" || /усадьб|парк|заповедник|сад\b|лес|ферм|зоопарк|музей-/i.test(p.title);
  const g = await api(COMMONS, { action: "query", list: "geosearch", gscoord: `${p.lat}|${p.lng}`, gsradius: wide ? 800 : 250, gslimit: 80, gsnamespace: 6 });
  for (const x of g.query?.geosearch ?? []) add(x.title, "geo", x.dist);

  const wd = await wikidataFor(p);
  if (wd?.img) add("File:" + wd.img, "wikidata-image", null);
  if (wd?.cat) {
    const cm = await api(COMMONS, { action: "query", list: "categorymembers", cmtitle: "Category:" + wd.cat, cmtype: "file", cmlimit: 60 });
    for (const x of cm.query?.categorymembers ?? []) add(x.title, "category", null);
  }
  // поиск по названию: только если больше ничего не нашли (низкая уверенность)
  if (pool.size < 6) {
    const q = p.title.replace(/[«»"“”]/g, "") + (p.town ? " " + p.town.replace(/\(.*\)/, "").trim() : "");
    const s = await api(COMMONS, { action: "query", list: "search", srsearch: q, srnamespace: 6, srlimit: 12 });
    for (const x of s.query?.search ?? []) add(x.title, "search", null);
  }
  return { pool, wd };
}

async function details(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const r = await api(COMMONS, {
      action: "query", titles: titles.slice(i, i + 40).join("|"), prop: "imageinfo|coordinates", iiprop: "url|size|mime|extmetadata", coprop: "globe", colimit: 40,
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ImageDescription|Categories|Restrictions|ObjectName|AttributionRequired|DateTimeOriginal",
    });
    for (const pg of r.query?.pages ?? []) {
      const ii = pg.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      out.push({
        title: pg.title, url: ii.url, descUrl: ii.descriptionurl, width: ii.width, height: ii.height, mime: ii.mime,
        license: strip(m.LicenseShortName?.value), licenseUrl: strip(m.LicenseUrl?.value), artist: strip(m.Artist?.value).slice(0, 120),
        desc: strip(m.ImageDescription?.value).slice(0, 220), cats: strip(m.Categories?.value.replace(/\|/g, "; ")).slice(0, 300),
        restrictions: strip(m.Restrictions?.value), date: strip(m.DateTimeOriginal?.value).slice(0, 40),
        geo: pg.coordinates?.[0] ? { lat: pg.coordinates[0].lat, lng: pg.coordinates[0].lon } : null,
      });
    }
  }
  return out;
}

function score(p, c, meta, sv) {
  const text = [c.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""), c.desc, c.cats].join(" ");
  const h = hits(sv, text);
  const via = meta.via;
  const dist = meta.dist !== Infinity ? meta.dist : c.geo ? km(p.lat, p.lng, c.geo.lat, c.geo.lng) * 1000 : Infinity;
  let s = 0;
  if (via.has("category")) s += 4;
  if (via.has("wikidata-image")) s += 4;
  if (dist <= 60) s += 3; else if (dist <= 150) s += 2; else if (dist <= 350) s += 1;
  s += Math.min(3, h);
  if (c.width >= 1600) s += 0.5;
  // далеко и не названо этим местом: не берём (чужой кадр рядом)
  const named = h > 0 || via.has("category") || via.has("wikidata-image");
  if (!named && dist > 120) s -= 4;
  if (via.size === 1 && via.has("search") && !(c.geo && dist <= 3000)) s -= 3;
  return { s: Math.round(s * 10) / 10, h, dist: Number.isFinite(dist) ? Math.round(dist) : null, named };
}

mkdirSync(OUT, { recursive: true });
const places = JSON.parse(readFileSync(PLACES, "utf8")).filter((p) => !ONLY.length || ONLY.includes(p.slug));
const result = {};
let n = 0;
for (const p of places) {
  n++;
  const sv = stems(p.title);
  const { pool, wd } = await collect(p);
  const det = await details([...pool.keys()]);
  const cands = [];
  for (const c of det) {
    if (!/^image\/(jpeg|png)$/.test(c.mime)) continue;
    if (c.width < 900 || c.height < 500) continue;
    if (!OK_LICENSE.test(c.license)) continue;
    if (BAD_NAME.test(c.title) || /map|карта|схема|plan\b/i.test(c.cats.slice(0, 120))) continue;
    if (!c.artist) continue;
    const sc = score(p, c, pool.get(c.title), sv);
    if (sc.s < 3) continue;
    cands.push({ ...c, score: sc.s, nameHits: sc.h, dist: sc.dist, via: [...pool.get(c.title).via] });
  }
  cands.sort((a, b) => b.score - a.score || (b.width - a.width));
  // не больше двух снимков одного автора в один день подряд (серии одного кадра): дальше выбираем разнообразнее
  const picked = [];
  for (const c of cands) {
    if (picked.length >= TOP) break;
    if (picked.filter((x) => x.artist === c.artist && x.date.slice(0, 10) === c.date.slice(0, 10)).length >= 2) continue;
    picked.push(c);
  }
  result[p.slug] = { title: p.title, type: p.type, town: p.town, wikidata: wd ? { id: wd.id, label: wd.label, category: wd.cat ?? null } : null, pool: pool.size, candidates: picked };
  console.log(`${String(n).padStart(3)}/${places.length} ${p.slug}: пул ${pool.size}, подходит ${cands.length}, оставлено ${picked.length}${wd ? ` · wikidata ${wd.id}` : ""}`);
}
writeFileSync(`${OUT}/candidates.json`, JSON.stringify(result, null, 1));

// превью для просмотра глазами (стандартная ширина 330 px)
mkdirSync(`${OUT}/thumbs`, { recursive: true });
const jobs = Object.entries(result).flatMap(([slug, r]) => r.candidates.map((c, i) => ({ slug, i, c })));
let ji = 0, thumbFail = 0;
async function thumb({ slug, i, c }) {
  const file = c.title.replace(/^File:/, "");
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=330`;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(`${OUT}/thumbs/${slug}`, { recursive: true });
      writeFileSync(`${OUT}/thumbs/${slug}/${i}.jpg`, buf);
      return;
    } catch { await sleep(1000 * a); }
  }
  thumbFail++;
}
await Promise.all(Array.from({ length: 3 }, async () => { while (ji < jobs.length) await thumb(jobs[ji++]); }));

// сводка
const vals = Object.values(result);
const by = (f) => vals.filter(f).length;
const lines = [
  `мест: ${vals.length}`,
  `с кандидатами (хоть один): ${by((r) => r.candidates.length > 0)}`,
  `с 3+ кандидатами: ${by((r) => r.candidates.length >= 3)}`,
  `с уверенным кандидатом (оценка ≥ 6): ${by((r) => r.candidates.some((c) => c.score >= 6))}`,
  `без кандидатов: ${by((r) => r.candidates.length === 0)}`,
  `превью не скачались: ${thumbFail} из ${jobs.length}`,
  "",
  ...Object.entries(result).map(([s, r]) => `${s}\t${r.type}\t${r.candidates.length}\t${r.candidates[0]?.score ?? "-"}`),
];
writeFileSync(`${OUT}/summary.txt`, lines.join("\n"));
console.log(lines.slice(0, 6).join("\n"));
