/**
 * Block 1 content/data-trust gate.
 * Fails CI on regressions that can make KidGo publish invented, contradictory or broken data.
 */
import { places } from "../src/lib/data/places";
import { adventures } from "../src/lib/data/adventures";
import { RAW_EVENTS, RAW_PLACES } from "../src/lib/data/extra";
import { SCENARIO_LIBRARY } from "../src/lib/scenarios";

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
  if (p.review_count > 0 && !validUrl(p.rating_source)) fail(`${prefix}: rating/reviews without rating_source`);
  if (p.review_count === 0 && p.rating !== 0) fail(`${prefix}: rating must be 0 when review_count is 0`);
  if (p.rating < 0 || p.rating > 5) fail(`${prefix}: invalid rating ${p.rating}`);
  for (const photo of p.photos) {
    if (!photo.src || !photo.alt) fail(`${prefix}: photo without src/alt`);
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
}

const publicIds = new Set(places.map((p) => p.id));
const publicSlugs = new Set(places.map((p) => p.slug));
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

const eventKeys = new Set<string>();
for (const e of RAW_EVENTS) {
  const key = JSON.stringify([e.venue, e.title, e.schedule]);
  if (eventKeys.has(key)) fail(`event duplicate: ${e.venue} / ${e.title}`);
  eventKeys.add(key);
  if (!publicSlugs.has(e.venue)) fail(`event ${e.title}: venue ${e.venue} is missing/unpublished`);
  if (!validUrl(e.source)) fail(`event ${e.title}: missing/invalid source`);
  if (e.confidence === "low") fail(`event ${e.title}: low confidence`);
  if (e.age[0] < 0 || e.age[1] > 12 || e.age[0] > e.age[1]) fail(`event ${e.title}: invalid age range`);
  if (e.price < 0) fail(`event ${e.title}: negative price`);
}

if (SCENARIO_LIBRARY.length !== 77) {
  fail(`scenario library changed: expected the audited 77 scenarios, got ${SCENARIO_LIBRARY.length}`);
}
if (adventures.length !== 12) {
  fail(`adventure library changed unexpectedly: expected 12, got ${adventures.length}`);
}

console.log("KidGo content trust gate");
console.log(`  public places: ${places.length}`);
console.log(`  sourced JSON places: ${RAW_PLACES.length}`);
console.log(`  adventures: ${adventures.length}`);
console.log(`  recurring event definitions: ${RAW_EVENTS.length}`);
console.log(`  scenarios: ${SCENARIO_LIBRARY.length}`);

for (const w of warnings.slice(0, 30)) console.warn("  ⚠", w);
if (warnings.length > 30) console.warn(`  ⚠ ... +${warnings.length - 30} warnings`);

if (errors.length) {
  console.error(`\nData trust validation failed: ${errors.length} issue(s)`);
  [...new Set(errors)].slice(0, 80).forEach((e) => console.error("  ✗", e));
  process.exit(1);
}

console.log("\nData trust validation passed ✓");
