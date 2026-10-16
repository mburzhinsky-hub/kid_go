// Ищет официальные сайты мест из списка A/D/F и пишет tmp_verify/targets.json для fetch-targets.mjs.
// Источники: ссылка из списка, кандидаты редактора, Википедия → Викиданные (P856 «официальный сайт»),
// внешние ссылки со страниц справочников (2ГИС, портал Подмосковья и т. п.).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const UA = "KidsGoFactCheck/1.0 (+https://kids-go.fun)";
const NOT_AUTH = /(^|\.)(wikipedia\.org|wikidata\.org|wikimedia\.org|2gis\.ru|2gis\.com|yandex\.(ru|com|net)|kp\.ru|putevka\.com|russpass\.ru|afisha\.ru|kudago\.com|tripadvisor\.ru|google\.com|vk\.com|t\.me|ok\.ru|youtube\.com|instagram\.com|facebook\.com|twitter\.com|x\.com|apple\.com|mosreg\.ru|yastatic\.net|gstatic\.com|googleapis\.com|w3\.org|schema\.org|cloudflare\.com|jsdelivr\.net|creativecommons\.org|mediawiki\.org|wmflabs\.org|dzen\.ru|rutube\.ru|mail\.ru|tiktok\.com)$/i;

async function get(url, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ru" }, redirect: "follow", signal: ctl.signal });
    return { ok: r.ok, status: r.status, url: r.url, text: r.ok ? await r.text() : "" };
  } catch (e) {
    return { ok: false, status: 0, url, text: "" };
  } finally {
    clearTimeout(t);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiSite(title) {
  const api = `https://ru.wikipedia.org/w/api.php?action=query&prop=pageprops&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  const r = await get(api);
  if (!r.ok) return [];
  const pages = Object.values(JSON.parse(r.text).query?.pages ?? {});
  const q = pages[0]?.pageprops?.wikibase_item;
  if (!q) return [];
  await sleep(300);
  const e = await get(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);
  if (!e.ok) return [];
  const claims = JSON.parse(e.text).entities?.[q]?.claims?.P856 ?? [];
  return claims.map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
}

function externalLinks(html, base) {
  const out = [];
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) {
    try {
      const u = new URL(m[0].replace(/[.,;]+$/, ""));
      const host = u.hostname.replace(/^www\./, "");
      if (NOT_AUTH.test(host)) continue;
      if (host === new URL(base).hostname.replace(/^www\./, "")) continue;
      if (/\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ico)(\?|$)/i.test(u.pathname)) continue;
      const root = `${u.protocol}//${u.hostname}/`;
      if (!out.includes(root)) out.push(root);
    } catch {}
  }
  return out.slice(0, 3);
}

const input = JSON.parse(readFileSync("tmp_verify/afd_input.json", "utf8"));
const targets = [];
const log = [];
for (const it of input) {
  const cands = [...it.cands];
  let from = [];
  let host = "";
  try { host = new URL(it.link).hostname.replace(/^www\./, ""); } catch {}
  if (/wikipedia\.org$/.test(host)) {
    const title = decodeURIComponent(new URL(it.link).pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
    from = await wikiSite(title);
    log.push({ slug: it.slug, wiki: title, p856: from });
  } else if (host && NOT_AUTH.test(host)) {
    const r = await get(it.link);
    from = r.ok ? externalLinks(r.text, it.link) : [];
    log.push({ slug: it.slug, page: it.link, status: r.status, external: from });
  } else if (host) {
    cands.unshift(it.link);
  }
  if (it.group === "A" && !from.length && !it.cands.length) {
    // поиск статьи по названию
    const s = await get(`https://ru.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(it.name)}`);
    const t = s.ok ? JSON.parse(s.text).query?.search?.[0]?.title : null;
    if (t) {
      from = await wikiSite(t);
      log.push({ slug: it.slug, search: t, p856: from });
    }
  }
  const all = [...new Set([...cands, ...from])].filter((u) => /^https?:\/\//.test(u)).slice(0, 4);
  all.forEach((u, i) => targets.push({ slug: i ? `${it.slug}__${i}` : it.slug, urls: [u], follow: true }));
  if (!all.length) log.push({ slug: it.slug, unresolved: true });
  await sleep(250);
}
mkdirSync("tmp_verify", { recursive: true });
writeFileSync("tmp_verify/targets.json", JSON.stringify(targets, null, 1));
writeFileSync("tmp_verify/resolve-log.json", JSON.stringify(log, null, 1));
console.log("targets", targets.length, "unresolved", log.filter((l) => l.unresolved).length);
