// Сверка таблицы проверки: открывает страницы-источники и ищет в них часы и цены, заявленные в строке.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
mkdirSync("tmp_verify/pages2", { recursive: true });
const UA = "KidsGoFactCheck/1.0 (+https://kids-go.fun)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = JSON.parse(readFileSync("tmp_verify/prov_input.json", "utf8"));

function robotsDisallows(txt, path) {
  let applies = false, seen = false; const rules = [];
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.replace(/#.*/, "").trim(); const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") { if (seen) { applies = false; seen = false; } if (m[2].trim() === "*") applies = true; }
    else if (k === "disallow" || k === "allow") { seen = true; if (applies && k === "disallow" && m[2].trim()) rules.push(m[2].trim()); }
  }
  return rules.some((r) => r === "/" || new RegExp("^" + r.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")).test(path));
}
async function get(url, ms = 25000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ru,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    const ct = res.headers.get("content-type") || "";
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, 3_000_000);
    let text = new TextDecoder("utf-8").decode(buf);
    const cs = ((text.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || "") + ((ct.match(/charset=([\w-]+)/i) || [])[1] || "");
    if (/1251/.test(cs)) text = new TextDecoder("windows-1251").decode(buf);
    return { ok: res.ok, status: res.status, url: res.url, text, ct };
  } catch (e) { return { ok: false, status: 0, url, text: "", ct: "", error: String(e.cause?.code || e.message || e) }; }
  finally { clearTimeout(t); }
}
const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', laquo: "«", raquo: "»", ndash: "–", mdash: "—", rub: "₽" };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
function plain(html) {
  let h = html.replace(/<script[^>]*type=["']application\/(ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi, " $2 ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
  h = decode(h).toLowerCase().replace(/[   ]/g, " ").replace(/\s+/g, " ");
  h = h.replace(/(\d) (\d{3})(?!\d)/g, "$1$2");                 // 1 300 -> 1300
  h = h.replace(/\b([01]?\d|2[0-3])[.\-–](\d{2})\b/g, (m, a, b) => (+b < 60 ? `${a}:${b}` : m)); // 10.00 -> 10:00
  h = h.replace(/\b(\d):(\d{2})\b/g, "0$1:$2");
  return h;
}
function tokens(h, p) {
  const t = new Set();
  for (const m of (h + " " + p).matchAll(/\b([01]?\d|2[0-4])[:.]([0-5]\d)\b/g)) t.add(`t:${m[1].padStart(2, "0")}:${m[2]}`);
  for (const m of p.matchAll(/(\d[\d\s  ]*)\s*(?:₽|руб|р\b)/g)) { const d = m[1].replace(/\D/g, ""); if (d && d.length <= 5) t.add(`p:${d}`); }
  if (/круглосуточ/i.test(h)) t.add("k:круглосуточ");
  if (/бесплатн|свободн/i.test(p)) t.add("k:бесплатн|свободн");
  return [...t];
}
function has(text, tok) {
  if (tok.startsWith("t:")) {
    const [, hh, mm] = tok.split(":");
    if (text.includes(`${hh}:${mm}`)) return true;
    if (mm === "00") { const H = String(+hh); return new RegExp(`(?:с|до|-|–|—|в)\\s*${H}(?![\\d:.])|(?:^|\\s)${hh}(?![\\d:])\\s*(?:-|–|—|до)`).test(text); }
    return false;
  }
  if (tok.startsWith("p:")) return new RegExp(`(?<![\\d])${tok.slice(2)}(?![\\d])`).test(text);
  if (tok === "k:круглосуточ") return /круглосуточ|24\s*(?:часа|ч)|24\/7|00:00\s*[-–—]\s*24:00/.test(text);
  if (tok.startsWith("k:бесплатн")) return /бесплатн|свободн/.test(text);
  return false;
}
const lastHit = new Map();
const robotsCache = new Map();
const out = [];
for (const row of input) {
  const toks = tokens(row.hours, row.price);
  const rec = { n: row.n, name: row.name, tokens: toks, pages: [], found: {} };
  for (const url of row.urls) {
    let u; try { u = new URL(url); } catch { continue; }
    const host = u.hostname;
    if (!robotsCache.has(host)) { const r = await get(`${u.protocol}//${host}/robots.txt`, 10000); robotsCache.set(host, r.ok && /user-agent/i.test(r.text) ? r.text : ""); }
    if (robotsDisallows(robotsCache.get(host), u.pathname + u.search)) { rec.pages.push({ url, skip: "robots" }); continue; }
    const wait = (lastHit.get(host) ?? 0) + 700 - Date.now(); if (wait > 0) await sleep(wait);
    let r = await get(url); if (!r.ok && (r.status === 0 || r.status >= 500)) { await sleep(6000); r = await get(url); } lastHit.set(host, Date.now());
    if (!r.ok) { rec.pages.push({ url, status: r.status, error: r.error }); continue; }
    if (/pdf|image\//i.test(r.ct)) { rec.pages.push({ url, status: r.status, skip: "binary " + r.ct }); continue; }
    const text = plain(r.text);
    {
      const re = /(режим|график|часы работы|время работы|работает|открыт|закрыт|круглосуточ|билет|стоимост|цена|цены|тариф|вход|бесплатн|свободн|₽|руб)/g;
      const wins = []; let m;
      while ((m = re.exec(text))) { const a = Math.max(0, m.index - 160), b = Math.min(text.length, m.index + 240); if (wins.length && a <= wins[wins.length - 1][1]) wins[wins.length - 1][1] = b; else wins.push([a, b]); }
      let sn = wins.map(([a, b]) => text.slice(a, b)).join("\n---\n"); if (sn.length > 30000) sn = sn.slice(0, 30000);
      writeFileSync(`tmp_verify/pages2/${row.n}-${rec.pages.length}.txt`, `# ${url}\n# final ${r.url}\n${sn}`);
    }
    const hit = [];
    for (const tk of toks) if (has(text, tk)) { hit.push(tk); if (!rec.found[tk]) { const needle = tk.startsWith("t:") ? tk.slice(2) : tk.startsWith("p:") ? tk.slice(2) : tk === "k:круглосуточ" ? "круглосуточ" : "бесплатн"; const i = text.indexOf(needle); rec.found[tk] = { url, ctx: i >= 0 ? text.slice(Math.max(0, i - 70), i + 70) : "" }; } }
    rec.pages.push({ url, final: r.url, status: r.status, len: text.length, hit: hit.length });
  }
  rec.missing = toks.filter((t) => !rec.found[t]);
  out.push(rec);
  console.log(row.n, row.name.slice(0, 30), `${toks.length - rec.missing.length}/${toks.length}`);
}
mkdirSync("tmp_verify", { recursive: true });
writeFileSync("tmp_verify/prov-result2.json", JSON.stringify(out, null, 1));
