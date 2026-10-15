/**
 * Аудит картинок мест: у места — только его настоящие фото (Wikimedia Commons или присланные самим местом) либо иллюстрация, чужих и «похожих» кадров нет.
 *   npx tsx scripts/audit-photos.ts [--warn]
 *
 * ERROR:
 *  1. у кадра PH (сток для подборок и приключений) нет темы в photo-themes.ts;
 *  2. у места есть фото не из Commons (сток, чужой адрес), хотя STOCK_FALLBACK выключен;
 *  3. у снимка нет автора, лицензии или ссылки на страницу файла, лицензия не из разрешённых (CC0, общественное достояние, CC BY, CC BY-SA);
 *  4. один и тот же снимок показывается у двух мест (или дважды внутри места);
 *  5. id своей копии не совпадает с именем файла (place-photos.json устарел или правился руками), id повторяется;
 *  6. в place-photos.json есть slug, которого нет в каталоге;
 *  7. у места нет ни одного кадра, пустой alt, одинаковые alt внутри места;
 *  8. у места с иллюстрацией в списке остался настоящий снимок или наоборот;
 *  9. фото от места (partner-photos.json): нет автора, сайта или пометки «предоставлено…», id не совпадает с именем файла,
 *     нет копий в public/partner/ (три WebP, а у первого кадра — ещё превью для ссылок), нет подписи к снимку, снимок слишком мал.
 * WARN (--warn): сколько мест без настоящих фото и каких, кадры PH, которые нигде не используются.
 * Выход ≠ 0 при любой ERROR.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { allPlaces } from "../src/lib/data/repository";
import { PH } from "../src/lib/data/photos";
import { PH_THEME } from "../src/lib/data/photo-themes";
import { PARTNER_PHOTOS, REAL_PHOTOS, STOCK_FALLBACK, commonsPageUrl, licenseUrl, partnerCredit } from "../src/lib/data/place-photos";
import { commonsInfo } from "../src/lib/commons";
import { partnerId, partnerSrc } from "../src/lib/partner";

const SHOW_WARN = process.argv.includes("--warn");
const errors: string[] = [];
const warns: string[] = [];
const E = (m: string) => errors.push(m);
const W = (m: string) => warns.push(m);

const OK_LICENSE = /^(CC BY(-SA)? \d\.\d|CC0|Public domain)$/;

// 1. тема у каждого кадра реестра PH (он остаётся для обложек подборок и приключений)
for (const k of Object.keys(PH)) if (!PH_THEME[k as keyof typeof PH]) E(`кадр ${k}: нет темы в photo-themes.ts`);

// 6. slug из файла фото есть в каталоге
const slugs = new Set(allPlaces.map((p) => p.slug));
for (const s of Object.keys(REAL_PHOTOS)) if (!slugs.has(s)) E(`place-photos.json: места «${s}» нет в каталоге`);

// 5. id своей копии = хеш имени файла; id и файлы не повторяются
const ids = new Map<string, string>();
const files = new Map<string, string>();
for (const [slug, list] of Object.entries(REAL_PHOTOS)) {
  for (const r of list) {
    const want = "cm-" + createHash("sha1").update(r.f).digest("hex").slice(0, 10);
    if (r.i !== want) E(`${slug}: id ${r.i} не совпадает с именем файла «${r.f}» (должен быть ${want})`);
    if (ids.has(r.i)) E(`${slug}: id ${r.i} уже у «${ids.get(r.i)}»`);
    ids.set(r.i, slug);
    // 4. один снимок — одно место
    const prev = files.get(r.f);
    if (prev) E(`снимок «${r.f}» показывается у двух мест: ${prev} и ${slug}`);
    files.set(r.f, slug);
    if (!r.a.trim() || r.a.endsWith("…")) E(`${slug}: у снимка «${r.f}» нет нормального имени автора («${r.a}»)`);
    if (!OK_LICENSE.test(r.l)) E(`${slug}: лицензия «${r.l}» у «${r.f}» не из разрешённых`);
    if (!r.w || r.w < 800) E(`${slug}: снимок «${r.f}» слишком мал (${r.w}px по ширине)`);
  }
}

// 9. фото, присланные самими местами
const PARTNER_DIR = new URL("../public/partner/", import.meta.url);
const fileOk = (name: string) => existsSync(new URL(name, PARTNER_DIR)) && statSync(new URL(name, PARTNER_DIR)).size > 1000;
for (const [slug, set] of Object.entries(PARTNER_PHOTOS)) {
  if (!slugs.has(slug)) E(`partner-photos.json: места «${slug}» нет в каталоге`);
  if (!set.author?.trim()) E(`${slug}: у фото от места нет автора`);
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(set.url ?? "")) E(`${slug}: у фото от места нет ссылки на сайт (https://…): «${set.url}»`);
  if (!set.note?.trim()) E(`${slug}: у фото от места нет пометки «предоставлены …»`);
  if (!set.photos?.length) E(`${slug}: в partner-photos.json нет ни одного кадра`);
  const alts = new Set<string>();
  set.photos.forEach((r, k) => {
    const want = "pt-" + createHash("sha1").update(r.f).digest("hex").slice(0, 10);
    if (r.i !== want) E(`${slug}: id ${r.i} не совпадает с именем файла «${r.f}» (должен быть ${want})`);
    if (ids.has(r.i)) E(`${slug}: id ${r.i} уже у «${ids.get(r.i)}»`);
    ids.set(r.i, slug);
    const prev = files.get(r.f);
    if (prev) E(`снимок «${r.f}» показывается у двух мест: ${prev} и ${slug}`);
    files.set(r.f, slug);
    if (!r.alt?.trim()) E(`${slug}: у снимка «${r.f}» нет подписи (alt)`);
    else if (alts.has(r.alt)) E(`${slug}: одинаковая подпись у двух снимков («${r.alt}»)`);
    alts.add(r.alt);
    if (!r.w || r.w < 500) E(`${slug}: снимок «${r.f}» слишком мал (${r.w}px по ширине)`);
    for (const w of [480, 960, 1440]) {
      if (!fileOk(`${r.i}-${w}.webp`)) E(`${slug}: нет файла public/partner/${r.i}-${w}.webp (запустите scripts/add-partner-photo.mjs)`);
    }
    // первый кадр показывается в превью ссылки (1200×630) — нужен исходник шире 1200 px и готовая копия
    if (k === 0 && (r.w < 1200 || !fileOk(`${r.i}-og.jpg`))) E(`${slug}: первый кадр «${r.f}» не годится для превью ссылки (нужна ширина от 1200 px и файл ${r.i}-og.jpg)`);
  });
}

let withReal = 0;
const without: string[] = [];
for (const p of allPlaces) {
  const commonsList = REAL_PHOTOS[p.slug] ?? [];
  const partnerList = PARTNER_PHOTOS[p.slug]?.photos ?? [];
  // ожидаемый порядок кадров: сначала от самого места, потом с Commons (см. realPhotos в place-photos.ts)
  const real = [...partnerList.map((r) => ({ ...r, partner: true as const })), ...commonsList.map((r) => ({ ...r, partner: false as const }))];
  const srcs = new Set<string>();
  const alts = new Set<string>();
  if (!p.photos.length) E(`${p.slug}: нет ни одного кадра`);
  for (const ph of p.photos) {
    if (!ph.alt?.trim()) E(`${p.slug}: пустой alt у кадра`);
    else if (alts.has(ph.alt)) E(`${p.slug}: одинаковый alt у двух кадров («${ph.alt}»)`);
    alts.add(ph.alt);
    if (ph.src) {
      if (srcs.has(ph.src)) E(`${p.slug}: кадр повторяется внутри места`);
      srcs.add(ph.src);
    }
  }

  if (real.length) {
    withReal++;
    if (p.photos.length !== real.length) E(`${p.slug}: в каталоге ${p.photos.length} кадров, а в place-photos.json и partner-photos.json ${real.length}`);
    p.photos.forEach((ph, i) => {
      const r = real[i];
      if (r?.partner) {
        // фото, присланное самим местом
        if (partnerId(ph.src) !== r.i || ph.src !== partnerSrc(r.i)) E(`${p.slug}: кадр ${i + 1} — не тот снимок, что в partner-photos.json`);
        if (ph.kind !== "partner") E(`${p.slug}: кадр ${i + 1} — kind «${ph.kind}», ожидался partner`);
        if (ph.alt !== r.alt) E(`${p.slug}: кадр ${i + 1} — подпись не совпадает с данными`);
        const c = ph.credit;
        const set = PARTNER_PHOTOS[p.slug];
        const want = partnerCredit(set);
        if (!c || c.kind !== "partner" || !c.author || !c.license || !c.url) E(`${p.slug}: кадр ${i + 1} — нет автора, пометки «предоставлено…» или ссылки на сайт места`);
        else if (c.author !== want.author || c.url !== want.url || c.license !== want.license) E(`${p.slug}: кадр ${i + 1} — подпись автора не совпадает с данными`);
        return;
      }
      const cm = commonsInfo(ph.src);
      if (!cm || !r || cm.id !== r.i) E(`${p.slug}: кадр ${i + 1} — не тот снимок, что в place-photos.json`);
      if (ph.kind !== "commons") E(`${p.slug}: кадр ${i + 1} — kind «${ph.kind}», ожидался commons`);
      const c = ph.credit;
      if (!c || !c.author || !c.license || !c.url) E(`${p.slug}: кадр ${i + 1} — нет автора, лицензии или ссылки`);
      else if (r && !r.partner && (c.url !== commonsPageUrl(r.f) || c.licenseUrl !== licenseUrl(r.l))) E(`${p.slug}: кадр ${i + 1} — ссылки автора не совпадают с данными`);
      else if (!c.url.startsWith("https://commons.wikimedia.org/wiki/File:")) E(`${p.slug}: кадр ${i + 1} — ссылка не на страницу файла Commons`);
    });
  } else if (!STOCK_FALLBACK) {
    without.push(p.slug);
    // нет настоящих фото: ровно одна иллюстрация, никаких стоковых кадров
    if (p.photos.length !== 1 || p.photos[0].src !== "") E(`${p.slug}: нет настоящих фото, но показываются другие кадры (${p.photos.length})`);
  }
  for (const ph of p.photos) if (ph.src && !commonsInfo(ph.src) && !partnerId(ph.src) && !STOCK_FALLBACK) E(`${p.slug}: фото не из Commons и не от самого места: ${ph.src.slice(0, 60)}`);
}

// WARN
if (without.length) {
  const byType = new Map<string, string[]>();
  for (const s of without) {
    const p = allPlaces.find((x) => x.slug === s)!;
    const k = p.place_type ?? p.category;
    byType.set(k, [...(byType.get(k) ?? []), s]);
  }
  W(`мест без настоящих фото: ${without.length} из ${allPlaces.length}`);
  for (const [k, v] of byType) W(`  ${k} (${v.length}): ${v.join(", ")}`);
}
{
  // кадры PH теперь нужны только подборкам и приключениям: места их не показывают
  const used = new Set(allPlaces.flatMap((p) => p.photos.map((x) => x.src)));
  const shownByPlaces = (Object.entries(PH) as [string, string][]).filter(([, v]) => used.has(v)).map(([k]) => k);
  if (shownByPlaces.length && !STOCK_FALLBACK) E(`стоковые кадры PH показываются у мест: ${shownByPlaces.join(", ")}`);
}

const partnerCount = Object.values(PARTNER_PHOTOS).reduce((n, s) => n + s.photos.length, 0);
console.log(`Мест: ${allPlaces.length}; с настоящими фото: ${withReal} (${files.size} снимков, из них от самих мест: ${partnerCount}), с иллюстрацией: ${without.length}`);
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
