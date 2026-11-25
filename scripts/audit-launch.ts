/**
 * Launch QA: checks every published venue and verifies external source, parking and menu links.
 * Never treats a successful HTTP response as proof that prices/hours/parking are factually current.
 * Writes full machine-readable and human-readable reports to artifacts/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { places } from "../src/lib/data/places";
import { adventures } from "../src/lib/data/adventures";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";
import { auditForPlace } from "../src/lib/data/source-audit";

type Kind = "source" | "menu" | "parking" | "rating";
type LinkInfo = { kind: Kind; slug: string; title: string; url: string };
const now = new Date();
const issues: string[] = [];
const links: LinkInfo[] = [];
const add = (p: (typeof places)[number], kind: Kind, url?: string | null) => {
  if (!url) return;
  try {
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol)) issues.push(p.slug + ": invalid " + kind + " protocol");
    else links.push({ slug: p.slug, title: p.title, kind, url: u.href });
  } catch { issues.push(p.slug + ": invalid " + kind + " URL " + url); }
};
const seen = new Set<string>();
const ages = (p: (typeof places)[number]) => p.age_min >= 0 && p.age_max <= 18 && p.age_min <= p.age_max;

for (const p of places) {
  if (seen.has(p.slug)) issues.push(p.slug + ": duplicate slug");
  seen.add(p.slug);
  const audit = auditForPlace(p.slug);
  if (!audit?.identity || audit.status !== "reviewed") issues.push(p.slug + ": identity NOT source-reviewed");
  if (!p.title || !p.address || !p.description || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))
    issues.push(p.slug + ": missing place details");
  if (!ages(p)) issues.push(p.slug + ": invalid ages");
  if (!p.photos.length || !p.photos[0].alt) issues.push(p.slug + ": missing photo/alt");
  if (!p.verified_at) issues.push(p.slug + ": no last audit date");
  if (p.menu_url && p.category === "cafe" && !p.menu_url.startsWith("https://"))
    issues.push(p.slug + ": cafe menu should be HTTPS");
  add(p, "source", p.source);
  add(p, "menu", p.menu_url);
  add(p, "parking", p.parking_info?.source);
  add(p, "rating", p.rating_source);
  if (p.parking_info && !["yes", "partial", "no", "unknown"].includes(p.parking_info.status))
    issues.push(p.slug + ": invalid parking status");
}
if (places.length !== 148) issues.push("catalog expected 148 published places, got " + places.length);
if (SCENARIO_LIBRARY.length !== 82) issues.push("expected 82 scenarios, got " + SCENARIO_LIBRARY.length);
for (const a of adventures) for (const s of a.steps) {
  if (!places.some(p => p.id === s.place_id)) issues.push("adventure " + a.slug + " references unpublished " + s.place_id);
}

type Check = { url: string; kind: Kind; slugs: string[]; status: number | null; outcome: string; finalUrl?: string };
const unique = new Map<string, { kind: Kind; slugs: string[] }>();
for (const l of links) {
  const key = l.kind + " " + l.url;
  const ex = unique.get(key);
  if (ex) ex.slugs.push(l.slug);
  else unique.set(key, { kind: l.kind, slugs: [l.slug] });
}
const checks: Check[] = [];
const jobs = [...unique.entries()];
let cursor = 0;

async function verify(url: string, kind: Kind, slugs: string[]): Promise<Check> {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 9000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; KidsGoLaunchAudit/1.0)" } });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal });
      await response.body?.cancel();
    }
    const status = response.status;
    return { url, kind, slugs, status, outcome: status === 404 || status === 410 ? "broken" :
      status >= 200 && status < 400 ? "reachable" : status === 401 || status === 403 || status === 429 ? "blocked_or_protected" : "needs_review", finalUrl: response.url };
  } catch (e) {
    return { url, kind, slugs, status: null, outcome: e instanceof Error ? (e.name === "AbortError" ? "timeout" : "network_unreachable") : "network_unreachable" };
  } finally { clearTimeout(timeout); }
}
async function worker() {
  while (cursor < jobs.length) {
    const [key, item] = jobs[cursor++];
    checks.push(await verify(key.slice(item.kind.length + 1), item.kind, item.slugs));
  }
}
Promise.all(Array.from({ length: 18 }, worker)).then(() => {

const count = (fn: (p: (typeof places)[number]) => boolean) => places.filter(fn).length;
const aged = (date?: string | null) => date ? Math.floor((now.getTime() - Date.parse(date)) / 86400000) : null;
const summary = {
  generatedAt: now.toISOString(),
  places: places.length, adventures: adventures.length, scenarios: SCENARIO_LIBRARY.length,
  withMenu: count(p => !!p.menu_url),
  withParkingRecord: count(p => !!p.parking_info),
  parkingByStatus: Object.fromEntries(["yes", "partial", "no", "unknown"].map(k => [k, count(p => p.parking_info?.status === k)])),
  parkingOver45Days: count(p => (aged(p.parking_info?.checked_at) ?? 999) > 45),
  auditedPlaceOver45Days: count(p => (aged(p.verified_at) ?? 999) > 45),
  verifiedPrices: count(p => !!p.verified_fields?.includes("price")),
  verifiedHours: count(p => !!p.verified_fields?.includes("opening_hours")),
  urlsChecked: checks.length,
  linkOutcomes: Object.fromEntries(["reachable","broken","blocked_or_protected","needs_review","timeout","network_unreachable"].map(k => [k, checks.filter(x => x.outcome === k).length])),
  contentIssues: issues.length
};
const results = { summary, issues, checks, venues: places.map(p => ({
  slug: p.slug, title: p.title, category: p.category, source: p.source, verifiedAt: p.verified_at,
  priceVerified: !!p.verified_fields?.includes("price"), hoursVerified: !!p.verified_fields?.includes("opening_hours"),
  menuUrl: p.menu_url, parking: p.parking_info, ratingUrl: p.rating_source
})) };
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/launch-data-report.json", JSON.stringify(results, null, 2));
const lines = [
 "# Kid Go: prelaunch venue/data audit", "",
 "Generated: " + summary.generatedAt, "",
 "## Counts", "",
 ...Object.entries(summary).map(([k,v]) => "- **" + k + "**: " + JSON.stringify(v)),
 "", "## Fatal data issues", "", ...(issues.length ? issues.map(x => "- " + x) : ["None"]),
 "", "## Broken source / menu / parking links (HTTP 404/410)", "",
 ...checks.filter(x => x.outcome === "broken").map(x => "- " + x.kind + " " + x.slugs.join(", ") + ": HTTP " + x.status + " " + x.url),
 "", "## Links requiring manual review (blocked, timeout, unreachable or server errors)", "",
 ...checks.filter(x => x.outcome !== "reachable" && x.outcome !== "broken").map(x => "- " + x.kind + " " + x.slugs.join(", ") + ": " + x.outcome + " " + (x.status ?? "-") + " " + x.url),
 "", "## Important interpretation", "",
 "HTTP reachability does not validate prices, business hours, actual parking access or menu accuracy.",
 "Older source checks must be refreshed against official venue information before describing them as current.",
];
writeFileSync("artifacts/launch-data-report.md", lines.join("\n") + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log("Broken links:");
for (const c of checks.filter(x => x.outcome === "broken")) console.log(c.kind + " " + c.slugs.join(",") + " " + c.url);
if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }

}).catch((error) => { console.error(error); process.exitCode = 1; });
