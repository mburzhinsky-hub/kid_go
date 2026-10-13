// Сбор публичных контактов (email, телефон, страницы «Контакты») с официальных сайтов мест.
// Нужен, чтобы написать им с просьбой о фото. Читает tmp_contacts/sites.json, пишет tmp_contacts/contacts.json.
// Вежливо: свой User-Agent, пауза между запросами, robots.txt уважается, не больше 6 страниц на сайт.
import { readFileSync, writeFileSync } from "node:fs";

const UA = "KidsGoContactCheck/1.0 (+https://kids-go.fun)";
const sites = JSON.parse(readFileSync("tmp_contacts/sites.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ru,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    const ct = res.headers.get("content-type") || "";
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, 1_500_000);
    let cs = (ct.match(/charset=([\w-]+)/i) || [])[1] || "utf-8";
    let text = new TextDecoder("utf-8").decode(buf);
    const meta = (text.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
    if (!/charset=/i.test(ct) && meta && /1251/.test(meta)) cs = "windows-1251";
    if (/1251/.test(cs)) text = new TextDecoder("windows-1251").decode(buf);
    return { ok: res.ok, status: res.status, url: res.url, text, ct };
  } catch (e) {
    return { ok: false, status: 0, url, text: "", error: String(e.cause?.code || e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function robotsDisallows(robotsText, path) {
  const lines = robotsText.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let applies = false;
  const rules = [];
  for (const l of lines) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") applies = m[2].trim() === "*";
    else if (applies && k === "disallow" && m[2].trim()) rules.push(m[2].trim());
  }
  return rules.some((r) => path.startsWith(r.replace(/\*.*$/, "")) && r !== "/" ? true : r === "/");
}

const BAD_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$|@2x|sentry|wixpress|example\.|domain\.|email\.com$|yourmail|name@/i;
function cfDecode(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}
function extract(html) {
  const emails = new Set();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(decodeURIComponent(m[1]).trim());
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) emails.add(cfDecode(m[1]));
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) emails.add(cfDecode(m[1]));
  for (const m of html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) emails.add(m[0]);
  const phones = new Set();
  for (const m of html.matchAll(/(?:\+7|\b8)[\s(\-]*\d{3}[\s)\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g)) phones.add(m[0].replace(/\s+/g, " ").trim());
  return { emails: [...emails].filter((e) => !BAD_EMAIL.test(e) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)), phones: [...phones].slice(0, 3) };
}

const LINK_RE = /(контакт|contact|пресс|press|партн|partner|сотруднич|реклам|для-?сми|о-?нас|about)/i;
function candidateLinks(html, base) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    if (!(LINK_RE.test(href) || LINK_RE.test(text))) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, "") !== new URL(base).hostname.replace(/^www\./, "")) continue;
      if (/\.(pdf|jpe?g|png|zip|docx?)$/i.test(u.pathname)) continue;
      u.hash = "";
      out.set(u.href, text.slice(0, 40));
    } catch {}
  }
  return [...out.keys()];
}

const results = [];
for (const s of sites) {
  const rec = { host: s.host, places: s.places, site: s.url, emails: [], phones: [], contactPages: [], notes: [] };
  const origin = new URL(s.url).origin;
  const robots = await get(origin + "/robots.txt", 10000);
  const robotsText = robots.ok && /text\/plain/i.test(robots.ct || "") ? robots.text : "";
  const allowed = (url) => !robotsText || !robotsDisallows(robotsText, new URL(url).pathname);
  const home = await get(s.url);
  if (!home.ok) {
    rec.notes.push(`главная: ${home.status || home.error}`);
    results.push(rec);
    await sleep(800);
    continue;
  }
  const queue = [home.url];
  const homeLinks = candidateLinks(home.text, home.url);
  for (const l of homeLinks) queue.push(l);
  for (const p of ["/kontakty", "/kontakty/", "/contacts", "/contacts/", "/contact", "/press"]) queue.push(origin + p);
  const seen = new Set();
  let fetched = 0;
  const pages = [];
  for (const url of queue) {
    if (fetched >= 6) break;
    if (seen.has(url)) continue;
    seen.add(url);
    if (!allowed(url)) { rec.notes.push("robots запрещает " + new URL(url).pathname); continue; }
    const r = url === home.url ? home : await get(url);
    if (url !== home.url) { fetched++; await sleep(900); } else fetched++;
    if (!r.ok || !/html/i.test(r.ct || "text/html")) continue;
    const ex = extract(r.text);
    pages.push({ url, ...ex });
    if (url !== home.url && LINK_RE.test(url)) rec.contactPages.push(url);
  }
  const emailPages = new Map();
  for (const p of pages) for (const e of p.emails) { const k = e.toLowerCase(); if (!emailPages.has(k)) emailPages.set(k, p.url); }
  rec.emails = [...emailPages.entries()].map(([email, page]) => ({ email, page }));
  rec.phones = [...new Set(pages.flatMap((p) => p.phones))].slice(0, 3);
  rec.contactPages = [...new Set(rec.contactPages)].slice(0, 4);
  results.push(rec);
  await sleep(800);
}
writeFileSync("tmp_contacts/contacts.json", JSON.stringify(results, null, 1));
const withMail = results.filter((r) => r.emails.length).length;
console.log(`sites=${results.length} with_email=${withMail} unreachable=${results.filter((r) => r.notes.some((n) => n.startsWith("главная"))).length}`);
