// Сверка фактов с официальными сайтами мест: часы работы, цены, адрес.
// Читает tmp_verify/places.json (наш каталог), скачивает страницы официальных сайтов и вытаскивает фрагменты про часы, цены и адрес.
// Результат: tmp_verify/facts.json. Дальше фрагменты читает человек/Claude и правит каталог: скрипт сам ничего не меняет.
// Вежливо: свой User-Agent, robots.txt уважается, пауза между запросами к одному сайту, не больше 9 страниц на место.
import { readFileSync, writeFileSync } from "node:fs";

const UA = "KidsGoFactCheck/1.0 (+https://kids-go.fun)";
const places = JSON.parse(readFileSync("tmp_verify/places.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// не являются источником часов и цен конкретного места
const NOT_AUTH = /(^|\.)(wikipedia\.org|2gis\.ru|yandex\.(ru|com)|kp\.ru|putevka\.com|russpass\.ru|afisha\.ru|kudago\.com|tripadvisor\.ru|google\.com)$/;

export function robotsDisallows(robotsText, pathWithQuery) {
  const lines = robotsText.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let applies = false, seenRule = false;
  const rules = [];
  for (const l of lines) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") {
      if (seenRule) { applies = false; seenRule = false; }
      if (m[2].trim() === "*") applies = true;
    } else if (k === "disallow" || k === "allow") {
      seenRule = true;
      if (applies && k === "disallow" && m[2].trim()) rules.push(m[2].trim());
    }
  }
  return rules.some((r) => {
    if (r === "/") return true;
    const re = new RegExp("^" + r.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\$$/, "$"));
    return re.test(pathWithQuery);
  });
}

async function get(url, ms = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ru,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    const ct = res.headers.get("content-type") || "";
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, 2_500_000);
    let text = new TextDecoder("utf-8").decode(buf);
    const metaCs = (text.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || "";
    const hdrCs = (ct.match(/charset=([\w-]+)/i) || [])[1] || "";
    if (/1251/.test(hdrCs) || /1251/.test(metaCs)) text = new TextDecoder("windows-1251").decode(buf);
    return { ok: res.ok, status: res.status, url: res.url, text, ct };
  } catch (e) {
    return { ok: false, status: 0, url, text: "", ct: "", error: String(e.cause?.code || e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", rub: "₽" };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

export function htmlToLines(html) {
  const ld = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { ld.push(JSON.parse(m[1].trim())); } catch {}
  }
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/li|\/tr|\/div|\/h[1-6]|\/td|\/th|\/section|\/dd|\/dt)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  h = decode(h).replace(/[ \t ]+/g, " ");
  const lines = h.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 2);
  return { lines, ld };
}

function ldFacts(ld) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const k of ["openingHours", "openingHoursSpecification", "priceRange", "address", "telephone", "name", "@type"]) {
      if (o[k] !== undefined && k !== "@type" && k !== "name") out.push({ [k]: o[k] });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(ld);
  return out.slice(0, 8);
}

const TIME = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/;
const DAYW = /(пн|вт|ср|чт|пт|сб|вс|будн|выходн|ежедневн|понедельник|вторник|сред[аы]|четверг|пятниц|суббот|воскресень|круглосуточ|без выходных|выходной)/i;
const HRS = /(режим|часы|график|время работы|работает|работаем|открыт|закрыт|касса|вход)/i;
const PRICE = /(\d[\d\s]{1,7})\s*(₽|руб|р\.|р\b)|бесплатн|вход свободн|свободный вход/i;
const PRICEW = /(цен|стоимост|тариф|билет|вход|абонемент|детск|взросл|ребён|ребен)/i;
const ADDRW = /(адрес|находимся|мы на|г\.\s|ул\.|улица|проспект|просп\.|шоссе|наб\.|набережная|бульвар|б-р|пр-т|пер\.|переулок|площадь|пл\.)/i;

export function snippets(lines) {
  const hours = [], price = [], addr = [];
  const seen = new Set();
  const cut = (l) => (l.length > 260 ? l.slice(0, 260) + "…" : l);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const ctx = [lines[i - 1] ?? "", l, lines[i + 1] ?? ""].join(" | ");
    if (TIME.test(l) && (DAYW.test(l) || HRS.test(l) || DAYW.test(ctx))) {
      const k = "h" + l; if (!seen.has(k)) { seen.add(k); hours.push(cut(l.length < 40 ? ctx : l)); }
    }
    if (PRICE.test(l) && (PRICEW.test(l) || PRICEW.test(ctx))) {
      const k = "p" + l; if (!seen.has(k)) { seen.add(k); price.push(cut(l)); }
    }
    if (ADDRW.test(l) && /\d/.test(l) && l.length < 220) {
      const k = "a" + l; if (!seen.has(k)) { seen.add(k); addr.push(cut(l)); }
    }
  }
  return { hours: hours.slice(0, 14), price: price.slice(0, 18), addr: addr.slice(0, 6) };
}

const LINK_RE = /(цен|тариф|билет|стоимост|режим|график|часы|контакт|как[-\s]?добраться|посетител|прайс|price|ticket|tarif|bilet|kontakt|contact|schedule|hours)/i;
function candidateLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    if (!(LINK_RE.test(href) || LINK_RE.test(text))) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, "") !== new URL(base).hostname.replace(/^www\./, "")) continue;
      if (/\.(pdf|jpe?g|png|zip|docx?|webp|svg)$/i.test(u.pathname)) continue;
      u.hash = "";
      out.add(u.href);
    } catch {}
  }
  return [...out];
}

const cache = new Map();
const robotsCache = new Map();
async function allowed(url) {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    const r = await get(origin + "/robots.txt", 10000);
    robotsCache.set(origin, r.ok && /text\/plain/i.test(r.ct) ? r.text : "");
  }
  const t = robotsCache.get(origin);
  const u = new URL(url);
  return !t || !robotsDisallows(t, u.pathname + u.search);
}

async function pageFacts(url, hostDelay) {
  if (cache.has(url)) return cache.get(url);
  let rec;
  if (!(await allowed(url))) rec = { url, status: "robots", len: 0 };
  else {
    const r = await get(url);
    await sleep(hostDelay);
    if (!r.ok || !/html|xml|text/i.test(r.ct || "text/html")) rec = { url, status: r.status || r.error || "err", len: 0 };
    else {
      const { lines, ld } = htmlToLines(r.text);
      const sn = snippets(lines);
      rec = { url: r.url, status: r.status, len: lines.join(" ").length, ld: ldFacts(ld), ...sn, links: candidateLinks(r.text, r.url) };
    }
  }
  cache.set(url, rec);
  return rec;
}

const GUESS = ["/contacts", "/contacts/", "/kontakty", "/kontakty/", "/prices", "/prices/", "/price", "/tseny", "/tseny/", "/bilety", "/bilety/", "/tickets", "/tarify", "/tarify/", "/rezhim-raboty", "/visitors"];

async function doPlace(p) {
  const rec = { slug: p.slug, pages: [], skipped: [] };
  const seeds = new Set();
  for (const u of [...Object.values(p.field_sources || {}), p.source].filter(Boolean)) seeds.add(u);
  const urls = [];
  for (const u of seeds) {
    try {
      const host = new URL(u).hostname;
      if (NOT_AUTH.test(host)) rec.skipped.push(u); else urls.push(u);
    } catch {}
  }
  if (!urls.length) return rec;
  const origin = new URL(urls[0]).origin;
  const tried = new Set();
  let n = 0;
  const visit = async (u) => {
    if (n >= 9 || tried.has(u)) return null;
    tried.add(u); n++;
    const pf = await pageFacts(u, 700);
    rec.pages.push({ ...pf, links: undefined });
    return pf;
  };
  let homeLinks = [];
  for (const u of urls) {
    const pf = await visit(u);
    if (pf?.links) homeLinks.push(...pf.links);
  }
  const sub = [...new Set(homeLinks)].slice(0, 5);
  for (const l of sub) await visit(l);
  // подстраховка: типовые адреса страниц цен и контактов, только если на найденных страницах ничего нет
  const have = (k) => rec.pages.some((x) => x[k]?.length);
  if (!have("price") || !have("hours")) {
    for (const g of GUESS) {
      if (n >= 9) break;
      const pf = await visit(origin + g);
      if (pf && have("price") && have("hours")) break;
    }
  }
  return rec;
}

// параллельно разные сайты (по 4), в пределах одного сайта — по очереди
const byHost = new Map();
for (const p of places) {
  let host = "none";
  for (const u of [...Object.values(p.field_sources || {}), p.source].filter(Boolean)) {
    try { const h = new URL(u).hostname.replace(/^www\./, ""); if (!NOT_AUTH.test(h)) { host = h; break; } } catch {}
  }
  byHost.set(host, [...(byHost.get(host) ?? []), p]);
}
const groups = [...byHost.entries()].filter(([h]) => h !== "none");
const results = [];
let idx = 0;
async function worker() {
  while (idx < groups.length) {
    const [, ps] = groups[idx++];
    for (const p of ps) results.push(await doPlace(p));
  }
}
if (process.argv[1] && process.argv[1].endsWith("collect-facts.mjs")) {
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const p of places) if (!results.find((r) => r.slug === p.slug)) results.push({ slug: p.slug, pages: [], skipped: ["нет собственного сайта в каталоге"] });
  writeFileSync("tmp_verify/facts.json", JSON.stringify(results, null, 1));
  const ok = results.filter((r) => r.pages.some((x) => x.len > 800)).length;
  const withHours = results.filter((r) => r.pages.some((x) => x.hours?.length)).length;
  const withPrice = results.filter((r) => r.pages.some((x) => x.price?.length)).length;
  console.log(`places=${results.length} readable=${ok} hours_snippets=${withHours} price_snippets=${withPrice}`);
}
