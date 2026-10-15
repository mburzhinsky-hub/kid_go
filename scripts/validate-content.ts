/**
 * Block 1 content/data-trust gate.
 * Fails CI on regressions that can make Kids Go publish invented, contradictory or broken data.
 */
import { ADDED_SCENARIO_IDS, BASELINE_ADVENTURE_SLUGS, BASELINE_SCENARIO_IDS } from "./baseline";
import { places } from "../src/lib/data/places";
import { adventures } from "../src/lib/data/adventures";
import { RAW_EVENTS, RAW_PLACES } from "../src/lib/data/extra";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";
import { auditForPlace } from "../src/lib/data/source-audit";
import { LANDINGS, placesOfLanding, publishedLandings, verifiedFacts } from "../src/lib/landings";

const attractionCategories = ["park", "play", "museum", "active", "animals"];
const errors: string[] = [];
const warnings: string[] = [];
const fail = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

function unique(label: string, values: string[]) {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) fail(`${label}: duplicate "${v}"`);
    seen.add(v);
  }
}

function validUrl(value?: string | null) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

unique("place slug", places.map((p) => p.slug));
unique("place id", places.map((p) => p.id));
unique("raw place slug", RAW_PLACES.map((p) => p.slug));
unique("adventure slug", adventures.map((a) => a.slug));
unique("scenario id", SCENARIO_LIBRARY.map((s) => s.id));

for (const p of places) {
  const prefix = `place ${p.slug}`;
  if (!p.title.trim()) fail(`${prefix}: missing title`);
  if (!p.description.trim()) fail(`${prefix}: missing description`);
  if (!p.address.trim()) fail(`${prefix}: missing address`);
  if (!Number.isFinite(p.latitude) || p.latitude < 54.5 || p.latitude > 57.2) fail(`${prefix}: suspicious latitude ${p.latitude}`);
  if (!Number.isFinite(p.longitude) || p.longitude < 34.5 || p.longitude > 41.5) fail(`${prefix}: suspicious longitude ${p.longitude}`);
  if (p.age_min < 0 || p.age_max > 12 || p.age_min > p.age_max) fail(`${prefix}: invalid age range ${p.age_min}-${p.age_max}`);
  if (p.price_min < 0 || p.price_max < 0 || p.price_min > p.price_max) fail(`${prefix}: invalid price ${p.price_min}-${p.price_max}`);
  if (p.average_duration <= 0) fail(`${prefix}: non-positive duration`);
  if (!Array.isArray(p.opening_hours) || p.opening_hours.length !== 7) fail(`${prefix}: opening_hours must have 7 entries`);
  if (!p.photos.length) fail(`${prefix}: no photos/fallback visual`);
  if (!validUrl(p.source)) fail(`${prefix}: missing/invalid source`);
  if (!p.verification_status) fail(`${prefix}: missing verification_status`);
  if (p.verification_status === "demo") fail(`${prefix}: demo record leaked into public catalog`);
  const audit = auditForPlace(p.slug);
  if (!audit || audit.status !== "reviewed" || !audit.identity) fail(`${prefix}: source audit is not complete`);
  if (audit && p.source !== audit.source) fail(`${prefix}: runtime source differs from audited source`);
  if (!p.verified_at) fail(`${prefix}: missing source-audit date`);
  if (!(p.verified_fields ?? []).includes("identity")) fail(`${prefix}: identity must be a verified field`);
  if ((p.verified_fields ?? []).includes("price") && !p.verified_at) fail(`${prefix}: verified price has no check date`);
  if ((p.verified_fields ?? []).includes("opening_hours") && !p.verified_at) fail(`${prefix}: verified hours have no check date`);
  for (const field of p.verified_fields ?? []) {
    if (!validUrl(audit?.field_sources?.[field])) fail(`${prefix}: verified ${field} has no field-level evidence URL`);
  }
  if (p.review_count > 0 && !validUrl(p.rating_source)) fail(`${prefix}: rating/reviews without rating_source`);
  if (p.rating > 0 && !validUrl(p.rating_source)) fail(`${prefix}: public rating requires rating_source`);
  if (p.rating < 0 || p.rating > 5) fail(`${prefix}: invalid rating ${p.rating}`);
  if (p.menu_url && !validUrl(p.menu_url)) fail(`${prefix}: invalid menu_url`);
  if (p.parking_info) {
    if (!["yes", "no", "partial", "unknown"].includes(p.parking_info.status)) fail(`${prefix}: invalid parking status ${p.parking_info.status}`);
    if (!p.parking_info.details.trim()) fail(`${prefix}: parking details are empty`);
    if (!validUrl(p.parking_info.source)) fail(`${prefix}: parking source is invalid`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.parking_info.checked_at)) fail(`${prefix}: parking checked_at is invalid`);
  }
  const tags = p.tags.join(" ").toLowerCase();
  const verified = new Set(p.verified_fields ?? []);
  const unknown = new Set(p.unknown_fields ?? []);
  if (!verified.has("price") && /бесплат|₽|руб\.?/.test(tags)) fail(`${prefix}: unverified price claim leaked into tags`);
  if (unknown.has("parking") && /парков/.test(tags)) fail(`${prefix}: unverified parking claim leaked into tags`);
  if (unknown.has("stroller_friendly") && /коляск/.test(tags)) fail(`${prefix}: unverified stroller claim leaked into tags`);
  if (unknown.has("baby_room") && /пелен|комнат.{0,10}матер/.test(tags)) fail(`${prefix}: unverified baby-room claim leaked into tags`);
  if (unknown.has("kids_menu") && /детск.{0,10}меню/.test(tags)) fail(`${prefix}: unverified kids-menu claim leaked into tags`);
  if (unknown.has("booking_required") && /по записи|нужна запись|запись/.test(tags)) fail(`${prefix}: unverified booking claim leaked into tags`);
  for (const photo of p.photos) {
    // пустой src допустим только как единственная иллюстрация вместо фото (у места нет настоящих снимков)
    if (!photo.alt || (!photo.src && !(p.photos.length === 1 && photo.kind === "demo"))) fail(`${prefix}: photo without src/alt`);
    if (!photo.kind) warn(`${prefix}: photo kind is unknown`);
  }
}

for (const r of RAW_PLACES) {
  const prefix = `raw ${r.slug}`;
  if (!validUrl(r.source)) fail(`${prefix}: missing/invalid source`);
  if (r.confidence === "low") fail(`${prefix}: low-confidence place should not be shipped`);
  if (r.age[0] < 0 || r.age[1] > 12 || r.age[0] > r.age[1]) fail(`${prefix}: invalid age range`);
  if (r.price[0] < 0 || r.price[1] < 0 || r.price[0] > r.price[1]) fail(`${prefix}: invalid price range`);
  if (!Array.isArray(r.hours) || r.hours.length !== 7) fail(`${prefix}: hours must have 7 entries`);
  if ((r.rating != null || r.reviews != null) && !validUrl(r.rating_source)) fail(`${prefix}: raw rating requires rating_source`);
  const audit = auditForPlace(r.slug);
  if (!audit || audit.status !== "reviewed" || !audit.identity) fail(`${prefix}: source audit missing or unresolved`);
  if (audit && r.source !== audit.source) fail(`${prefix}: source differs from source audit`);
}

const publicIds = new Set(places.map((p) => p.id));
const publicSlugs = new Set(places.map((p) => p.slug));
const parkingFacts = places.filter((p) => !!p.parking_info).length;
const menuFacts = places.filter((p) => !!p.menu_url).length;
const sourcedRatings = places.filter((p) => p.rating > 0 && !!p.rating_source).length;
if (parkingFacts !== 147) fail(`editorial parking coverage mismatch: expected 147, got ${parkingFacts}`);
if (menuFacts !== 64) fail(`editorial menu coverage mismatch: expected 64, got ${menuFacts}`);
if (sourcedRatings !== 127) fail(`sourced rating coverage mismatch: expected 127, got ${sourcedRatings}`);
if (places.length !== 147) fail(`editorial catalog count mismatch: expected 147, got ${places.length}`);
for (const removed of ["joki-joya", "katok-na-poyme-pavshino"]) {
  if (publicSlugs.has(removed)) fail(`removed place leaked into public catalog: ${removed}`);
}
for (const a of adventures) {
  if (!a.steps.length) fail(`adventure ${a.slug}: no steps`);
  if (a.age_min < 0 || a.age_max > 12 || a.age_min > a.age_max) fail(`adventure ${a.slug}: invalid age range`);
  if (a.estimated_duration <= 0) fail(`adventure ${a.slug}: invalid duration`);
  if (a.estimated_budget < 0) fail(`adventure ${a.slug}: negative budget`);
  if (a.recommend_percent != null) fail(`adventure ${a.slug}: recommendation percentage has no real user dataset yet`);
  const positions = a.steps.map((s) => s.position);
  if (new Set(positions).size !== positions.length) fail(`adventure ${a.slug}: duplicate step position`);
  for (const s of a.steps) {
    if (!publicIds.has(s.place_id)) fail(`adventure ${a.slug}: step references unpublished place id ${s.place_id}`);
    if (s.recommended_duration <= 0) fail(`adventure ${a.slug}: invalid step duration`);
  }
}

// Посадочные подборки («куда сходить с ребёнком…»): правила не должны ломаться молча и не должны обещать непроверенное.
{
  unique("landing slug", LANDINGS.map((l) => l.slug));
  const ids = new Set(SCENARIO_LIBRARY.map((x) => x.id));
  const slugs = new Set(LANDINGS.map((l) => l.slug));
  const published = publishedLandings();
  if (published.length < 8) fail(`landing pages shrank: ${published.length} published, need at least 8`);
  for (const l of LANDINGS) {
    const prefix = `landing ${l.slug}`;
    const list = placesOfLanding(l);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.slug)) fail(`${prefix}: slug must be latin kebab-case`);
    if (!l.h1.trim() || !l.lead.trim() || !l.how.trim() || !l.short.trim()) fail(`${prefix}: empty text field`);
    if (l.title.length < 25 || l.title.length > 55) fail(`${prefix}: title length ${l.title.length} is outside 25..55 (with « · Kids Go» it must fit a search snippet)`);
    if (l.description.length < 70 || l.description.length > 175) fail(`${prefix}: description length ${l.description.length} is outside 70..175`);
    if (l.tips.length < 3) fail(`${prefix}: needs at least 3 tips`);
    for (const r of l.related) if (!slugs.has(r) || r === l.slug) fail(`${prefix}: bad related slug "${r}"`);
    if (l.scenario && !ids.has(l.scenario)) fail(`${prefix}: unknown scenario "${l.scenario}"`);
    unique(`${prefix}: places`, list.map((p) => p.slug));
    if (list.length < l.min) warn(`${prefix}: only ${list.length} places (min ${l.min}), page is not published`);
    for (const p of list) {
      if (!attractionCategories.includes(p.category)) fail(`${prefix}: ${p.slug} is not an attraction (${p.category})`);
      if (l.slug === "besplatno" && (p.price_max !== 0 || !(p.verified_fields ?? []).includes("price"))) fail(`${prefix}: ${p.slug} has no verified free entry`);
    }
    if (l.slug !== "besplatno") {
      const text = [l.description, l.lead, l.how, ...l.tips].join(" ");
      if (/₽|руб|бесплат/i.test(text)) fail(`${prefix}: text makes a price claim (only the free-entry page may, and only with verified places)`);
    }
  }
  for (const p of places) {
    const f = verifiedFacts(p);
    const v = new Set(p.verified_fields ?? []);
    if (f.price && !v.has("price")) fail(`landing facts: ${p.slug} shows an unverified price`);
    if ((f.hours || f.hoursByDay) && !v.has("opening_hours")) fail(`landing facts: ${p.slug} shows unverified hours`);
  }
}

const eventKeys = new Set<string>();
for (const e of RAW_EVENTS) {
  const key = JSON.stringify([e.venue, e.title, e.schedule]);
  if (eventKeys.has(key)) fail(`event duplicate: ${e.venue} / ${e.title}`);
  eventKeys.add(key);
  if (!publicSlugs.has(e.venue)) fail(`event ${e.title}: venue ${e.venue} is missing/unpublished`);
  if (!validUrl(e.source)) fail(`event ${e.title}: missing/invalid source`);
  if (e.confidence !== "high") fail(`event ${e.title}: only high-confidence recurring schedules may be published`);
  if (e.age[0] < 0 || e.age[1] > 12 || e.age[0] > e.age[1]) fail(`event ${e.title}: invalid age range`);
  if (e.price < 0) fail(`event ${e.title}: negative price`);
  if (e.valid_from && e.valid_until && e.valid_from > e.valid_until) fail(`event ${e.title}: invalid validity window`);
  if (!e.valid_until) fail(`event ${e.title}: recurring event must have a validity end date`);
}

{
  const have = new Set(SCENARIO_LIBRARY.map((s) => s.id));
  for (const id of BASELINE_SCENARIO_IDS) if (!have.has(id)) fail(`scenario «${id}» from the audited 78 is missing`);
  const expected = BASELINE_SCENARIO_IDS.length + ADDED_SCENARIO_IDS.length;
  if (SCENARIO_LIBRARY.length !== expected) fail(`scenario library changed: expected ${expected} (audited 78 + ${ADDED_SCENARIO_IDS.length} trip scenarios), got ${SCENARIO_LIBRARY.length}`);
  for (const id of ADDED_SCENARIO_IDS) if (!have.has(id)) fail(`trip scenario «${id}» is missing`);
}
{
  const have = new Set(adventures.map((a) => a.slug));
  for (const slug of BASELINE_ADVENTURE_SLUGS) if (!have.has(slug)) fail(`adventure «${slug}» from the original 12 is missing`);
  if (adventures.length < BASELINE_ADVENTURE_SLUGS.length) fail(`adventure library shrank: ${adventures.length} < ${BASELINE_ADVENTURE_SLUGS.length}`);
}

console.log("Kids Go content trust gate");
console.log(`  public places: ${places.length}`);
console.log(`  sourced JSON places: ${RAW_PLACES.length}`);
console.log(`  adventures: ${adventures.length}`);
console.log(`  recurring event definitions: ${RAW_EVENTS.length}`);
console.log(`  scenarios: ${SCENARIO_LIBRARY.length}`);
console.log(`  landing pages: ${publishedLandings().length} of ${LANDINGS.length}`);
console.log(`  source-audited places: ${places.filter((p) => auditForPlace(p.slug)?.status === "reviewed").length}`);

for (const w of warnings.slice(0, 30)) console.warn("  ⚠", w);
if (warnings.length > 30) console.warn(`  ⚠ ... +${warnings.length - 30} warnings`);

if (errors.length) {
  console.error(`\nData trust validation failed: ${errors.length} issue(s)`);
  [...new Set(errors)].slice(0, 80).forEach((e) => console.error("  ✗", e));
  process.exit(1);
}

console.log("\nData trust validation passed ✓");
