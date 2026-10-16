// Вторая сверка: полный текст конкретных страниц официальных сайтов (цены, часы, адрес) + поиск официального сайта по кандидатам.
// Вход: tmp_verify/targets.json = [{slug, urls:[...], follow:bool}]. Выход: tmp_verify/pages/<slug>.json.
// Вежливо: свой User-Agent, robots.txt уважается, пауза между запросами к одному сайту.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const UA = "KidsGoFactCheck/1.0 (+https://kids-go.fun)";
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

const targets = JSON.parse(readFileSync("tmp_verify/targets.json", "utf8"));
mkdirSync("tmp_verify/pages", { recursive: true });
const robotsCache = new Map();
const lastHit = new Map();
async function polite(url) {
  const u = new URL(url);
  const host = u.host;
  if (!robotsCache.has(host)) {
    const r = await get(`${u.protocol}//${host}/robots.txt`, 12000);
    robotsCache.set(host, r.ok && /user-agent/i.test(r.text) ? r.text : "");
  }
  if (robotsDisallows(robotsCache.get(host), u.pathname + u.search)) return { ok: false, status: "robots", url, text: "" };
  const wait = (lastHit.get(host) ?? 0) + 800 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  return get(url);
}
const titleOf = (html) => decode(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim());

async function work(t) {
  const pages = [];
  const seen = new Set();
  let followed = false;
  const queue = [...t.urls];
  while (queue.length && pages.length < 7) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await polite(url);
    const rec = { url, final: r.url, status: r.status, error: r.error };
    if (r.ok && r.text) {
      const { lines, ld } = htmlToLines(r.text);
      rec.title = titleOf(r.text);
      rec.ld = ld.flatMap(ldFacts).slice(0, 6);
      rec.text = lines.join("\n").slice(0, 32000);
      if (t.follow && !followed) {
        followed = true;
        for (const l of candidateLinks(r.text, r.url).slice(0, 8)) queue.push(l);
      }
    }
    pages.push(rec);
    // для поиска сайта: если первый кандидат открылся — остальные кандидаты-домены не нужны
    if (t.discover && rec.text && !queue.some((q) => !t.urls.includes(q))) {
      for (let i = queue.length - 1; i >= 0; i--) if (t.urls.includes(queue[i])) queue.splice(i, 1);
    }
  }
  writeFileSync(`tmp_verify/pages/${t.slug}.json`, JSON.stringify({ slug: t.slug, pages }, null, 1));
}

// по сайту — один поток, разные сайты параллельно
const byHost = new Map();
for (const t of targets) {
  const h = new URL(t.urls[0]).host.replace(/^www\./, "");
  if (!byHost.has(h)) byHost.set(h, []);
  byHost.get(h).push(t);
}
const groups = [...byHost.values()];
let gi = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (gi < groups.length) {
    const g = groups[gi++];
    for (const t of g) { try { await work(t); } catch (e) { console.log("fail", t.slug, e.message); } }
  }
}));
console.log("done", targets.length);
