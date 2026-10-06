/**
 * Аудит сценариев и влияния условий/фильтров на них.
 *   npx tsx scripts/audit-scenarios.ts            — полный прогон
 *   npx tsx scripts/audit-scenarios.ts --quick    — сокращённый (для CI)
 *   npx tsx scripts/audit-scenarios.ts --doc      — ещё и перезаписать docs/scenarios.md
 *
 * 1. Состав библиотеки: точное число, группы, уникальность id и названий, одинаковые «рецепты».
 * 2. Главная: какие сценарии и при каких условиях попадают в «8 уместных сейчас» (никто не «мёртвый»).
 * 3. Матрица: сценарий × семья × погода × место (вся Москва / округ / точный адрес / Подмосковье) × время недели ×
 *    транспорт × фильтры из ссылки. В каждом плане проверяются жёсткие условия: часы работы, возраст, бюджет, погода,
 *    «только под крышей», тишина, коляска, «домой к…», «до N минут», режим места (any/area/exact).
 * 4. Влияние: меняется ли план при смене ОДНОГО условия (погода, возраст, бюджет, транспорт, место, время, день).
 */
import { writeFileSync } from "node:fs";
import { generatePlans, coreFit, BUDGET_MAX, planHasFood } from "../src/lib/recommend/engine";
import { buildPlannerInput, type ResultsQuery } from "../src/lib/recommend/build-input";
import { demoForecast, moscowDateISO, outdoorVerdict, weekdayOf, windowWx, type WxScenario } from "../src/lib/forecast";
import { isOpenDuring, toMinutes } from "../src/lib/format";
import { AREAS, DEFAULT_ORIGIN, OKRUGS, SETTLEMENTS, isSuburban, okrugById, okrugOrigin, type Origin } from "../src/lib/location";
import { inMoscow, okrugOf, okrugOfOrigin, tierOf } from "../src/lib/moscow";
import { areaAlternatives } from "../src/lib/recommend/area";
import { GROUP_LABEL, SCENARIO_LIBRARY, pickScenarios, type ScenarioCtx, type ScenarioDef, type ScenarioGroup } from "../src/lib/scenarios";
import { allPlaces } from "../src/lib/data/repository";
import type { InterestId, TransportId } from "../src/lib/types";

const QUICK = process.argv.includes("--quick");
const DOC = process.argv.includes("--doc");
const fail: string[] = [];
const warn: string[] = [];
const out = (s = "") => console.log(s);

/* ───────────── 1. Состав ───────────── */
const N = SCENARIO_LIBRARY.length;
const byGroup = new Map<ScenarioGroup, ScenarioDef[]>();
for (const s of SCENARIO_LIBRARY) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]);
if (new Set(SCENARIO_LIBRARY.map((s) => s.id)).size !== N) fail.push("id сценариев не уникальны");
if (new Set(SCENARIO_LIBRARY.map((s) => s.label)).size !== N) fail.push("названия сценариев не уникальны");
for (const s of SCENARIO_LIBRARY) {
  if (!s.Glyph && !s.emoji) fail.push(`${s.id}: нет иконки`);
  if (!/^[a-z][a-z0-9-]*$/.test(s.id)) fail.push(`${s.id}: id не kebab-case`);
  if (!(s.group in GROUP_LABEL)) fail.push(`${s.id}: неизвестная группа`);
  const c = s.constraints;
  if (c?.maxTravelMin != null && (c.maxTravelMin < 10 || c.maxTravelMin > 150)) fail.push(`${s.id}: странное maxTravelMin`);
  if (c?.endBy != null && (c.endBy < 10 * 60 || c.endBy > 21 * 60)) fail.push(`${s.id}: странное endBy`);
}
const recipeKey = (s: ScenarioDef) => JSON.stringify([s.mood, s.duration, s.budget ?? null, !!s.food, s.constraints ?? null]);
const recipes = new Map<string, string[]>();
for (const s of SCENARIO_LIBRARY) recipes.set(recipeKey(s), [...(recipes.get(recipeKey(s)) ?? []), s.id]);
const dupRecipes = [...recipes.values()].filter((v) => v.length > 1);
for (const d of dupRecipes) fail.push(`одинаковый рецепт (дают одни и те же планы): ${d.join(" = ")}`);
/* без привязки к месту maxTravelMin не действует: рецепты, различающиеся только им, совпадают в режиме «вся Москва» */
const recipeAny = (s: ScenarioDef) => {
  const { maxTravelMin: _m, ...rest } = s.constraints ?? {};
  return JSON.stringify([s.mood, s.duration, s.budget ?? null, !!s.food, rest]);
};
const anyRecipes = new Map<string, string[]>();
for (const s of SCENARIO_LIBRARY) anyRecipes.set(recipeAny(s), [...(anyRecipes.get(recipeAny(s)) ?? []), s.id]);
const dupAny = [...anyRecipes.values()].filter((v) => v.length > 1);

/* ───────────── 2. Главная ───────────── */
const WXC: Record<string, Partial<ScenarioCtx>> = {
  sun: { sunny: true, warm: true },
  cloud: { sunny: false, warm: true },
  rainAll: { rainAllDay: true, sunny: false, warm: false },
  rainLater: { rainLater: true, sunny: false, warm: true },
  snow: { snow: true, cold: true, sunny: false, warm: false },
  cold: { cold: true, sunny: false, warm: false },
  hot: { hot: true, sunny: true, warm: true },
};
const KIDS: Record<string, Partial<ScenarioCtx>> = {
  "без детей": { kidsCount: 0, youngest: 5, oldest: 5 },
  "до года": { kidsCount: 1, youngest: 0, oldest: 0 },
  "2 года": { kidsCount: 1, youngest: 2, oldest: 2 },
  "5 лет": { kidsCount: 1, youngest: 5, oldest: 5 },
  "11 лет": { kidsCount: 1, youngest: 11, oldest: 11 },
  "2 и 9": { kidsCount: 2, youngest: 2, oldest: 9 },
  "1, 6, 12": { kidsCount: 3, youngest: 1, oldest: 12 },
  "4 и 5": { kidsCount: 2, youngest: 4, oldest: 5 },
  "7 лет": { kidsCount: 1, youngest: 7, oldest: 7 },
  "6 и 8": { kidsCount: 2, youngest: 6, oldest: 8 },
};
const INTS: string[][] = [[], ["drawing"], ["science"], ["animals"], ["space", "cooking"], ["dinosaurs", "transport"], ["music", "fairy"], ["sport", "nature"]];
const shown = new Map<string, number>();
let ctxN = 0;
let badRel = 0;
for (let weekday = 0; weekday < 7; weekday++)
  for (const hour of [8, 11, 13, 16, 19, 21])
    for (const month of [1, 3, 5, 7, 8, 10, 12])
      for (const wx of Object.values(WXC))
        for (const kids of Object.values(KIDS))
          for (const interests of INTS) {
            const ctx: ScenarioCtx = { weekday, hour, month, rainAllDay: false, rainLater: false, snow: false, cold: false, hot: false, sunny: false, warm: false, kidsCount: 0, youngest: 5, oldest: 5, interests, ...wx, ...kids };
            ctxN++;
            for (const s of SCENARIO_LIBRARY) {
              const r = s.relevance(ctx);
              if (!Number.isFinite(r) || r < 0) badRel++;
            }
            const picked = pickScenarios(ctx);
            if (picked.length !== 8) fail.push(`главная: ${picked.length} ситуаций вместо 8 (${JSON.stringify(ctx)})`);
            for (const p of picked) shown.set(p.id, (shown.get(p.id) ?? 0) + 1);
          }
if (badRel) fail.push(`relevance вернул не число/отрицательное: ${badRel}`);
const never = SCENARIO_LIBRARY.filter((s) => !shown.get(s.id));
for (const s of never) fail.push(`главная: «${s.id}» не показывается никогда (мёртвый сценарий)`);
const rare = SCENARIO_LIBRARY.filter((s) => shown.get(s.id) && (shown.get(s.id) ?? 0) / ctxN < 0.001);
for (const s of rare) fail.push(`главная: «${s.id}» показывается реже чем в 0,1% ситуаций`);

/* ───────────── 3. Матрица ───────────── */
const families: Record<string, { name: string; age: number; interests: InterestId[] }[]> = {
  "малыш 0": [{ name: "", age: 0, interests: [] }],
  "малыш 2": [{ name: "", age: 2, interests: ["animals"] }],
  "5 и 9": [
    { name: "", age: 5, interests: ["dinosaurs", "space"] },
    { name: "", age: 9, interests: ["drawing", "animals"] },
  ],
  "7, музыка": [{ name: "", age: 7, interests: ["music"] }],
  "11, спорт": [{ name: "", age: 11, interests: ["sport", "science"] }],
  "1, 6 и 12": [
    { name: "", age: 1, interests: [] },
    { name: "", age: 6, interests: ["transport"] },
    { name: "", age: 12, interests: ["science"] },
  ],
};
const FAM = Object.entries(families);
const SAT = new Date("2026-10-03T08:00:00Z"); // сб 11:00 МСК
const TUE_EVE = new Date("2026-10-06T14:00:00Z"); // вт 17:00
const SUN_AM = new Date("2026-10-04T06:00:00Z"); // вс 09:00
const FRI_PM = new Date("2026-10-09T12:30:00Z"); // пт 15:30
const MON_EARLY = new Date("2026-10-05T05:00:00Z"); // пн 08:00
const WINTER = new Date("2027-01-09T08:00:00Z");

const here = (id: string): Origin => ({ ...AREAS.find((a) => a.id === id)!, source: "custom" });
const settle = (id: string, source: Origin["source"]): Origin => ({ ...SETTLEMENTS.find((x) => x.id === id)!, source });
interface Loc {
  id: string;
  o: Origin;
  transport: TransportId;
}
const LOCS: Loc[] = [
  { id: "вся Москва", o: DEFAULT_ORIGIN, transport: "transit" },
  // все 11 округов: правило «округ — граница» должно работать одинаково везде, а не только в паре примеров
  ...OKRUGS.filter((o) => !["szao"].includes(o.id)).map((o): Loc => ({ id: o.short, o: okrugOrigin(o), transport: o.id === "zelao" || o.id === "nao" ? "car" : "transit" })),
  { id: "центр, адрес", o: here("center"), transport: "transit" },
  { id: "Тушино, адрес", o: here("tushino"), transport: "transit" },
  { id: "Чертаново, адрес", o: here("chertanovo"), transport: "transit" },
  { id: "Красногорск", o: settle("krasnogorsk", "area"), transport: "car" },
  { id: "Красногорск, адрес", o: settle("krasnogorsk", "custom"), transport: "car" },
  { id: "СЗАО", o: okrugOrigin(okrugById("szao")!), transport: "transit" },
];
const CITY_LOCS = new Set(["вся Москва", ...OKRUGS.filter((o) => o.id !== "zelao" && o.id !== "nao").map((o) => o.short), "центр, адрес", "Тушино, адрес", "Чертаново, адрес"]);
const L = (id: string) => LOCS.find((l) => l.id === id)!;
const LOCS_Q = LOCS.filter((l) => ["вся Москва", "ЗАО", "Зеленоград", "центр, адрес", "Красногорск, адрес"].includes(l.id));
const WXS: WxScenario[] = ["sun", "rain", "rain15", "cold", "heat"];

let runs = 0;
let emptyRuns = 0;
let emptyNoHelp = 0;
const hard: string[] = [];
const empties = new Map<string, number>();
const emptyByScenario = new Map<string, number>();
const runsByScenario = new Map<string, number>();
const soft = new Map<string, { n: number; hit: number }>();
const softAdd = (key: string, ok: boolean) => {
  const v = soft.get(key) ?? { n: 0, hit: 0 };
  v.n++;
  if (ok) v.hit++;
  soft.set(key, v);
};
let planCount = 0;
let plansLt3 = 0;
/** Строгий режим округа: «здесь такого нет» — не ошибка, если честно сказано и есть куда пойти. */
let areaRuns = 0;
let areaEmptyRuns = 0;
let areaEmptyWithAnchors = 0;
let altChecked = 0;
let altNoExit = 0;
const areaEmpties = new Map<string, number>();
const ANCHOR_CATS = ["park", "play", "museum", "active", "animals"];

function run(tag: string, query: ResultsQuery, kids: (typeof families)[string], loc: Loc, wx: WxScenario, now: Date, transport?: TransportId) {
  const forecast = demoForecast(loc.o, wx, now);
  const input = buildPlannerInput({
    query: { ...query, ...(transport ? { transport } : {}) },
    kids,
    origin: loc.o,
    prefs: { budget: "5000", transport: loc.transport, maxTravelMin: 40 },
    forecast,
    now,
    family: { want: [], visited: [], loved: [], disliked: [], seen: [] },
  });
  const r = generatePlans(input);
  runs++;
  const sid = query.s ?? "";
  runsByScenario.set(sid, (runsByScenario.get(sid) ?? 0) + 1);
  const mode = input.locationMode ?? "exact";
  const okId = mode === "area" ? okrugOfOrigin(loc.o)?.id : undefined;
  const strictArea = !!okId && input.areaScope !== "wide";
  if (strictArea) areaRuns++;
  if (!r.plans.length && strictArea) {
    // «в округе такого нет»: допустимо, если сказано прямо и есть куда пойти (другой округ, другая ситуация, соседние округа)
    areaEmptyRuns++;
    if (r.area?.anchors) areaEmptyWithAnchors++;
    if (!r.suggestions.length) hard.push(`округ пуст и без подсказок — ${tag}`);
    if (!r.area || r.area.scope !== "strict") hard.push(`округ пуст, а в результате нет данных об округе — ${tag}`);
    const k = `${sid} · ${loc.id}`;
    areaEmpties.set(k, (areaEmpties.get(k) ?? 0) + 1);
    if (areaEmptyRuns % 40 === 1) {
      altChecked++;
      const alt = areaAlternatives({ query: { ...query, ...(transport ? { transport } : {}) }, kids, origin: loc.o, prefs: { budget: "5000", transport: loc.transport, maxTravelMin: 40 }, forecast, now, family: { want: [], visited: [], loved: [], disliked: [], seen: [] } }, input);
      // выход — другой округ, другая ситуация или хотя бы ослабление условий из подсказок
      if (!alt || (!alt.others.length && !alt.scenarios.length && !r.suggestions.length)) {
        altNoExit++;
        hard.push(`округ пуст и выхода нет (ни другого округа, ни другой ситуации, ни подсказок) — ${tag}`);
      }
    }
    return r;
  }
  if (!r.plans.length) {
    emptyRuns++;
    emptyByScenario.set(sid, (emptyByScenario.get(sid) ?? 0) + 1);
    if (!r.suggestions.length) {
      emptyNoHelp++;
      hard.push(`пусто и без подсказок — ${tag}`);
    }
    const k = `${sid} · ${loc.id}`;
    empties.set(k, (empties.get(k) ?? 0) + 1);
    return r;
  }
  planCount += r.plans.length;
  if (r.plans.length < 3) plansLt3++;
  const c = input.constraints ?? {};
  const dateISO = moscowDateISO(r.dayOffset, now);
  const weekday = weekdayOf(dateISO);
  const youngest = Math.min(...kids.map((k) => k.age));
  if (input.dayOffset && r.dayOffset < input.dayOffset) hard.push(`день из ссылки потерян (${input.dayOffset} → ${r.dayOffset}) — ${tag}`);
  const ids = new Set<string>();
  r.plans.forEach((p, pi) => {
    const t = `${tag} · #${pi + 1}`;
    let prevEnd = -1;
    const slugs = new Set<string>();
    for (const s of p.stops) {
      const at = toMinutes(s.start);
      if (slugs.has(s.place.slug)) hard.push(`дубль места в плане: ${s.place.slug} — ${t}`);
      slugs.add(s.place.slug);
      if (s.duration <= 0) hard.push(`нулевая длительность ${s.place.slug} — ${t}`);
      if (at < prevEnd) hard.push(`шаги пересекаются: ${s.place.slug} ${s.start} — ${t}`);
      prevEnd = at + s.duration;
      if (!isOpenDuring(s.place.opening_hours, weekday, at, s.duration)) hard.push(`закрыто: ${s.place.slug} ${s.start} — ${t}`);
      if (!r.partialAge && kids.some((k) => k.age < s.place.age_min || k.age > s.place.age_max)) hard.push(`возраст: ${s.place.slug} — ${t}`);
      if (s.place.outdoor && !s.place.indoor) {
        const v = outdoorVerdict(windowWx(forecast, dateISO, at, at + s.duration), youngest);
        if (!v.ok) hard.push(`погода (${v.reason}): ${s.place.slug} ${s.start} — ${t}`);
      }
      if (at + s.duration > 21 * 60) hard.push(`позже 21:00: ${s.place.slug} — ${t}`);
      if (c.indoorOnly && !s.place.indoor) hard.push(`«только под крышей», а ${s.place.slug} на улице — ${t}`);
      if (c.quiet && s.place.noise_level === 3) hard.push(`«тихо», а ${s.place.slug} шумное — ${t}`);
      if (c.stroller && !(s.place.unknown_fields ?? []).includes("stroller_friendly") && !s.place.stroller_friendly) hard.push(`«с коляской», а ${s.place.slug} подтверждённо без — ${t}`);
      if (c.avoidCategories?.includes(s.place.category)) hard.push(`исключённая категория ${s.place.category}: ${s.place.slug} — ${t}`);
      if (mode === "any" && isSuburban({ lat: s.place.latitude, lng: s.place.longitude })) hard.push(`«вся Москва», а ${s.place.slug} за МКАД — ${t}`);
      if (!s.place.title) hard.push(`у места нет названия: ${s.place.slug} — ${t}`);
    }
    if (mode === "any") for (const s of p.stops) if (!inMoscow(s.place)) hard.push(`«вся Москва», а ${s.place.slug} не в Москве — ${t}`);
    if (strictArea && okId) {
      const tiers = p.stops.map((s) => tierOf(s.place, okId));
      p.stops.forEach((s, i) => {
        const anchorLike = ANCHOR_CATS.includes(s.place.category) || (c.parentBreak && s.place.category === "cafe" && s.place.experience_tags.includes("playzone"));
        if (tiers[i] === 2) hard.push(`округ ${okId}: ${s.place.slug} (${okrugOf(s.place) ?? "не Москва"}) вне округа и соседей — ${t}`);
        else if (anchorLike && tiers[i] !== 0) hard.push(`округ ${okId}: основное место ${s.place.slug} (${okrugOf(s.place)}) не в округе — ${t}`);
      });
      if (!input.looseFit && !p.stops.some((s, i) => tiers[i] === 0 && coreFit(s.place, input))) hard.push(`округ ${okId}: в плане нет места «по теме» ситуации — ${t}`);
    }
    if (input.budget === "free" && p.stops.some((s) => s.place.price_min > 0)) hard.push(`не бесплатно — ${t}`);
    if (input.budget !== "any" && input.budget !== "free" && p.budget > BUDGET_MAX[input.budget] * 1.1) hard.push(`бюджет ${p.budget} > ${BUDGET_MAX[input.budget]} — ${t}`);
    const last = p.stops[p.stops.length - 1];
    if (c.endBy && toMinutes(last.start) + last.duration > c.endBy + 10) hard.push(`позже «домой к ${Math.floor(c.endBy / 60)}:00»: ${last.start}+${last.duration} — ${t}`);
    // место поиска
    if (mode === "any") {
      if (p.fromHome) hard.push(`«вся Москва», а в плане есть дорога от дома — ${t}`);
    } else {
      if (!p.fromHome) hard.push(`нет дороги до первого места — ${t}`);
      else {
        if (mode === "area" && !p.fromHome.approx) hard.push(`округ, а время не «≈» — ${t}`);
        if (mode === "exact" && p.fromHome.approx) hard.push(`точный адрес, а время «≈» — ${t}`);
        if (!r.relaxed && c.maxTravelMin && p.fromHome.minutes > c.maxTravelMin * 1.35 + 1) hard.push(`далеко: ${p.fromHome.minutes} мин при лимите ${c.maxTravelMin} — ${t}`);
        if (!r.relaxed && input.maxDistanceKm && p.fromHome.minutes > 20 * 1.35 + 1) hard.push(`«рядом»: ${p.fromHome.minutes} мин — ${t}`);
      }
    }
    // «мягкие» свойства сценария: еда и улица — в лучшем плане; категория и интересы — хотя бы в одном из вариантов выдачи
    const sc = SCENARIO_LIBRARY.find((x) => x.id === query.s);
    if (sc && pi === 0) {
      const cs = sc.constraints;
      const city = CITY_LOCS.has(loc.id) && mode !== "area"; // кафе в каталоге только в городе; в округе они зависят от соседей — это проверяет отдельный блок
      if (city && sc.food && input.budget !== "free") softAdd(`${sc.id}|поесть`, planHasFood(p));
      if (city && cs?.parentBreak) softAdd(`${sc.id}|передышка родителю`, p.stops.some((s) => s.place.category === "cafe" && s.place.experience_tags.includes("playzone")));
      if (cs?.outdoorPreferred && (wx === "sun" || wx === "rain15")) softAdd(`${sc.id}|есть улица`, p.stops.some((s) => s.place.outdoor));
    }
  });
  {
    const sc = SCENARIO_LIBRARY.find((x) => x.id === query.s);
    const cs = sc?.constraints;
    // для малышей подходит мало мест любой категории — меряем там, где выбор есть (дети от 5 лет)
    if (sc && youngest >= 5 && !c.indoorOnly === !cs?.indoorOnly) {
      // бесплатный запрос, а бесплатных мест нужной категории в каталоге нет — выполнить это условие невозможно
      // и не просим невозможного: нужна категория, где есть место для ВСЕХ детей по возрасту, в бюджет и (в дождь) под крышей
      const rainy = wx === "rain" || wx === "rain15" || wx === "cold";
      const feasible = !!cs?.preferCategories && (allPlaces as { category: string; price_min: number; age_min: number; age_max: number; indoor: boolean }[]).some(
        (p) => cs.preferCategories!.includes(p.category as never) && (input.budget !== "free" || p.price_min === 0) && kids.every((k) => k.age >= p.age_min && k.age <= p.age_max) && (!rainy || p.indoor)
      );
      if (cs?.preferCategories && feasible && CITY_LOCS.has(loc.id) && mode !== "area") {
        const okCat = r.plans.some((p) => p.stops.some((s) => cs.preferCategories!.includes(s.place.category)));
        softAdd(`${sc.id}|нужная категория`, okCat);
      }
      if (cs?.interests) softAdd(`${sc.id}|интересы сценария`, r.plans.some((p) => p.stops.some((s) => s.place.interest_tags.some((i) => cs.interests!.includes(i)))));
    }
  }
  for (let i = 0; i < r.plans.length; i++)
    for (let j = i + 1; j < r.plans.length; j++) {
      const a = new Set(r.plans[i].stops.map((x) => x.place.slug));
      const shared = r.plans[j].stops.filter((x) => a.has(x.place.slug)).length;
      if (shared >= 2 && r.plans[j].stops.length > 1) hard.push(`варианты повторяют друг друга (общих мест: ${shared}) — ${tag}`);
    }
  if (new Set(r.plans.map((p) => p.key)).size !== r.plans.length) hard.push(`одинаковые планы в выдаче — ${tag}`);
  return r;
}

const t0 = Date.now();
const famPass1 = QUICK ? FAM.filter((_, i) => [0, 2, 4].includes(i)) : FAM;
const wxPass1 = QUICK ? (["sun", "rain", "cold"] as WxScenario[]) : WXS;
const locPass1 = QUICK ? LOCS.filter((l) => ["вся Москва", "ЗАО", "СЗАО", "Зеленоград", "центр, адрес", "Красногорск, адрес"].includes(l.id)) : LOCS;
// проход 1: сценарий × семья × погода × место (сб 11:00)
for (const sc of SCENARIO_LIBRARY)
  for (const [fname, kids] of famPass1)
    for (const wx of wxPass1)
      for (const loc of locPass1) run(`${sc.id} · ${fname} · ${wx} · ${loc.id}`, { s: sc.id }, kids, loc, wx, SAT);
const pass1 = runs;
// проход 2: время недели и года
const times: [string, Date][] = [["вт 17:00", TUE_EVE], ["вс 09:00", SUN_AM], ["пт 15:30", FRI_PM], ["пн 08:00", MON_EARLY], ["зима, сб", WINTER]];
for (const sc of SCENARIO_LIBRARY)
  for (const [fname, kids] of FAM.filter((_, i) => [1, 2, 4].includes(i)))
    for (const wx of ["sun", "rain15"] as WxScenario[])
      for (const loc of LOCS_Q.slice(0, QUICK ? 2 : 5))
        for (const [tn, now] of times) run(`${sc.id} · ${fname} · ${wx} · ${loc.id} · ${tn}`, { s: sc.id }, kids, loc, wx, now);
const pass2 = runs - pass1;
// проход 3: фильтры из ссылки поверх сценария
const FILTERS: [string, ResultsQuery][] = [
  ["пешком", { transport: "walk" }],
  ["машина", { transport: "car" }],
  ["метро", { transport: "transit" }],
  ["бесплатно", { budget: "free" }],
  ["до 2000", { budget: "2000" }],
  ["любой бюджет", { budget: "any" }],
  ["1–2 часа", { duration: "short" }],
  ["весь день", { duration: "day" }],
  ["только под крышей", { weather: "rain" }],
  ["на улице", { weather: "sun" }],
  ["рядом (5 км)", { near: "1" }],
  ["до 20 минут", { travel: "20" }],
  ["до 90 минут", { travel: "90" }],
  ["с обедом", { food: "1" }],
  ["завтра", { day: "1" }],
  ["в субботу+", { day: "4" }],
  ["спокойно", { mood: "calm" }],
  ["энергия", { mood: "energy" }],
  ["мусор в ссылке", { mood: "xx", duration: "yy", budget: "zz", transport: "ww", travel: "abc", day: "q", s: undefined }],
];
for (const sc of SCENARIO_LIBRARY)
  for (const [fn, q] of FILTERS)
    for (const [fname, kids] of FAM.filter((_, i) => (QUICK ? [2] : [0, 2, 4]).includes(i)))
      for (const loc of LOCS_Q.slice(0, QUICK ? 3 : 5)) run(`${sc.id} + ${fn} · ${fname} · ${loc.id}`, { s: sc.id, ...q }, kids, loc, "sun", SAT);
const pass3 = runs - pass1 - pass2;

/* ───────────── 4. Влияние условий ───────────── */
type Cfg = { kids: (typeof families)[string]; loc: Loc; wx: WxScenario; now: Date; query: ResultsQuery };
const key1 = (sid: string, c: Cfg) => {
  const forecast = demoForecast(c.loc.o, c.wx, c.now);
  const input = buildPlannerInput({ query: { s: sid, ...c.query }, kids: c.kids, origin: c.loc.o, prefs: { budget: "5000", transport: c.loc.transport, maxTravelMin: 40 }, forecast, now: c.now, family: { want: [], visited: [], loved: [], disliked: [], seen: [] } });
  return generatePlans(input).plans[0]?.key;
};
const BASE: Omit<Cfg, "kids"> = { loc: L("центр, адрес"), wx: "sun", now: SAT, query: {} };
/** «Тесные» сценарии: узкий радиус и тишина оставляют 3–6 подходящих мест, поэтому часть условий их план не меняет — это нормально. */
const tight = (s: ScenarioDef) =>
  !!s.constraints?.maxTravelMin || !!s.constraints?.stroller || !!s.constraints?.endBy || (s.duration === "short" && (!!s.constraints?.quiet || !!s.constraints?.indoorOnly)) ||
  (s.budget === "free" && !!s.constraints?.indoorOnly);
type Factor = { id: string; short: string; patch: (b: Cfg) => Cfg; applies?: (s: ScenarioDef) => boolean; min?: (s: ScenarioDef) => number };
const toddler = [{ name: "", age: 2, interests: [] as InterestId[] }];
const teen = [{ name: "", age: 10, interests: [] as InterestId[] }];
const FACTORS: Factor[] = [
  { id: "дождь", short: "дождь", patch: (b) => ({ ...b, wx: "rain" }), applies: (s) => !s.constraints?.indoorOnly, min: () => 0.4 },
  { id: "мороз", short: "мороз", patch: (b) => ({ ...b, wx: "cold" }), applies: (s) => !s.constraints?.indoorOnly, min: () => 0.25 },
  { id: "жара", short: "жара", patch: (b) => ({ ...b, wx: "heat" }), applies: (s) => !s.constraints?.indoorOnly, min: () => 0.15 },
  { id: "возраст: младший ↔ старший", short: "возраст", patch: (b) => ({ ...b, kids: b.kids.some((k) => k.age >= 7) ? toddler : teen }), min: (s) => (tight(s) ? 0.2 : 0.5) },
  { id: "бесплатно", short: "бесплатно", patch: (b) => ({ ...b, query: { ...b.query, budget: "free" } }), applies: (s) => s.budget !== "free", min: (s) => (s.duration === "short" || tight(s) ? 0 : 0.5) },
  { id: "до 2 000 ₽", short: "2000", patch: (b) => ({ ...b, query: { ...b.query, budget: "2000" } }), applies: (s) => s.budget !== "2000" && s.budget !== "free" },
  { id: "машина", short: "машина", patch: (b) => ({ ...b, loc: { ...b.loc, transport: "car" }, query: { ...b.query, transport: "car" } }) },
  { id: "вся Москва ↔ адрес", short: "место:всё", patch: (b) => ({ ...b, loc: L("вся Москва") }) },
  { id: "округ ↔ адрес", short: "место:округ", patch: (b) => ({ ...b, loc: L("ЗАО") }) },
  { id: "другой адрес", short: "место:адрес", patch: (b) => ({ ...b, loc: L("Тушино, адрес") }) },
  { id: "вт 17:00 ↔ сб 11:00", short: "время", patch: (b) => ({ ...b, now: TUE_EVE }) },
  { id: "через 3 дня (вт)", short: "+3 дня", patch: (b) => ({ ...b, query: { ...b.query, day: "3" } }) },
  { id: "1–2 часа вместо рецепта", short: "1–2 ч", patch: (b) => ({ ...b, query: { ...b.query, duration: "short" } }), applies: (s) => s.duration !== "short" && !s.constraints?.endBy, min: () => 0.5 },
  { id: "зима", short: "зима", patch: (b) => ({ ...b, now: WINTER }) },
];
const KIDS_BASE = FAM.map(([, k]) => k);
const matrix: { sid: string; cells: (number | null)[] }[] = [];
const factorTotals = FACTORS.map(() => ({ n: 0, ch: 0 }));
const weak: string[] = [];
{
  for (const sc of SCENARIO_LIBRARY) {
    const cells: (number | null)[] = [];
    const baseKeys = KIDS_BASE.map((kids) => key1(sc.id, { ...BASE, kids }));
    FACTORS.forEach((f, fi) => {
      if (f.applies && !f.applies(sc)) {
        cells.push(null);
        return;
      }
      let n = 0;
      let ch = 0;
      KIDS_BASE.forEach((kids, ki) => {
        const b: Cfg = { ...BASE, kids };
        const base = baseKeys[ki];
        const other = key1(sc.id, f.patch(b));
        if (!base || !other) return;
        n++;
        if (base !== other) ch++;
      });
      factorTotals[fi].n += n;
      factorTotals[fi].ch += ch;
      const rate = n ? ch / n : 0;
      cells.push(rate);
      const need = f.min?.(sc);
      if (need != null && need > 0 && rate < need) weak.push(`${sc.id} × «${f.id}»: ${(rate * 100).toFixed(0)}% < ${(need * 100).toFixed(0)}%`);
    });
    matrix.push({ sid: sc.id, cells });
  }
}

// «бесплатно и под крышей»: таких мест в каталоге единицы, поэтому часть условий их план не меняет — порог ниже
const deafMin = (id: string) => {
  const sc = SCENARIO_LIBRARY.find((x) => x.id === id)!;
  return sc.budget === "free" && sc.constraints?.indoorOnly ? 5 : 7;
};
const deaf = matrix.filter((m) => m.cells.filter((c) => c != null && c >= 0.1).length < deafMin(m.sid)).map((m) => m.sid);
for (const d of deaf) weak.push(`${d}: «глухой» сценарий — реагирует меньше чем на ${deafMin(d)} условий из ${FACTORS.length}`);

/* ───────────── Отчёт ───────────── */
out(`СЦЕНАРИЕВ В БИБЛИОТЕКЕ: ${N}`);
for (const g of Object.keys(GROUP_LABEL) as ScenarioGroup[]) out(`  ${GROUP_LABEL[g]}: ${byGroup.get(g)?.length ?? 0}`);
out(`Уникальных рецептов: ${recipes.size} из ${N}${dupRecipes.length ? ` (повторы: ${dupRecipes.map((d) => d.join("=")).join("; ")})` : ""}`);
out(`В режиме «вся Москва» (без ограничения дороги) уникальных рецептов: ${anyRecipes.size}${dupAny.length ? ` — различаются только дорогой: ${dupAny.map((d) => d.join("=")).join("; ")}` : ""}`);
out(`Главная: ${ctxN} сочетаний условий; показаны хоть раз: ${N - never.length} из ${N}`);
const showRates = SCENARIO_LIBRARY.map((s) => ({ id: s.id, p: (shown.get(s.id) ?? 0) / ctxN })).sort((a, b) => a.p - b.p);
out(`  реже всего: ${showRates.slice(0, 5).map((x) => `${x.id} ${(x.p * 100).toFixed(1)}%`).join(", ")}; чаще всего: ${showRates.slice(-3).map((x) => `${x.id} ${(x.p * 100).toFixed(0)}%`).join(", ")}`);
out(`Матрица: ${runs} прогонов (${pass1} сценарий×семья×погода×место, ${pass2} время, ${pass3} фильтры) за ${((Date.now() - t0) / 1000).toFixed(0)} с`);
out(`  пустых (кроме строгого округа): ${emptyRuns} (${((emptyRuns / Math.max(1, runs - areaRuns)) * 100).toFixed(2)}%), из них без подсказки: ${emptyNoHelp}; вариантов в выдаче в среднем ${(planCount / (runs - emptyRuns - areaEmptyRuns)).toFixed(2)}, выдач меньше 3: ${((plansLt3 / (runs - emptyRuns - areaEmptyRuns)) * 100).toFixed(1)}%`);
out(`  строгий округ: ${areaRuns} прогонов, «здесь нет» в ${areaEmptyRuns} (${((areaEmptyRuns / Math.max(1, areaRuns)) * 100).toFixed(0)}%); проверено, что есть выход (другой округ/ситуация): ${altChecked}, без выхода: ${altNoExit}`);
out(`  нарушений жёстких условий: ${hard.length}`);
hard.slice(0, 25).forEach((h) => out(`    ✗ ${h}`));
if (empties.size) {
  const top = [...empties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  out(`  пустые выдачи (сценарий · место: раз): ${top.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
}
if (areaEmpties.size) {
  const top = [...areaEmpties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  out(`  «в округе нет» чаще всего (сценарий · округ: раз): ${top.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
}
const softBad: string[] = [];
const bySc = new Map<string, string[]>();
for (const [k, v] of soft) {
  const [sid, what] = k.split("|");
  const rate = v.hit / v.n;
  bySc.set(sid, [...(bySc.get(sid) ?? []), `${what} ${(rate * 100).toFixed(0)}%`]);
  if (rate < 0.7) softBad.push(`${sid}: «${what}» только в ${(rate * 100).toFixed(0)}% выдач`);
}
out(`  «мягкие» свойства сценария (доля лучших планов, где они есть): ${[...bySc.entries()].map(([s, v]) => `${s}: ${v.join(", ")}`).join(" · ")}`);
softBad.forEach((x) => out(`    ⚠ ${x}`));
out("Влияние одного условия на лучший план (доля семей, у которых план изменился), по всем сценариям:");
FACTORS.forEach((f, i) => out(`  ${f.id}: ${(factorTotals[i].ch / Math.max(1, factorTotals[i].n) * 100).toFixed(0)}%`));
const FLOOR: Record<string, number> = {
  "дождь": 0.7, "мороз": 0.7, "жара": 0.55, "возраст: младший ↔ старший": 0.5, "бесплатно": 0.6, "до 2 000 ₽": 0.5, "машина": 0.3,
  "вся Москва ↔ адрес": 0.3, "округ ↔ адрес": 0.3, "другой адрес": 0.6, "вт 17:00 ↔ сб 11:00": 0.5, "через 3 дня (вт)": 0.15, "1–2 часа вместо рецепта": 0.8, "зима": 0.08,
};
FACTORS.forEach((f, i) => {
  const rate = factorTotals[i].ch / Math.max(1, factorTotals[i].n);
  if (rate < (FLOOR[f.id] ?? 0)) weak.push(`в целом «${f.id}» меняет план лишь в ${(rate * 100).toFixed(0)}% случаев (нужно ≥ ${((FLOOR[f.id] ?? 0) * 100).toFixed(0)}%)`);
});
weak.forEach((x) => out(`    ✗ слабое влияние: ${x}`));

fail.push(...hard.slice(0, 50));
if (emptyNoHelp) fail.push(`пустых выдач без подсказки: ${emptyNoHelp}`);
if (emptyRuns / Math.max(1, runs - areaRuns) > 0.03) fail.push(`слишком много пустых выдач: ${((emptyRuns / Math.max(1, runs - areaRuns)) * 100).toFixed(1)}%`);
fail.push(...weak);
fail.push(...softBad);

/* ───────────── Документ ───────────── */
const WHEN: Record<string, string> = {
  rain: "дождь весь день (сильнее всего), дождь позже, иначе слабо",
  "before-rain": "дождь начнётся позже в этот день",
  frost: "ощущаемая температура ниже −8°",
  "first-snow": "идёт снег",
  heat: "ощущаемая температура от +29°",
  walk: "нет дождя весь день, мороза и жары; при солнце выше",
  "golden-autumn": "сентябрь–октябрь, без сильного дождя, мороза и жары",
  picnic: "солнечно и тепло, но не жарко",
  short: "всегда",
  "before-nap": "в семье ребёнок до 3 лет; утром (до 12:00) — главный",
  morning: "до 11:00",
  "breakfast-kids": "до 10:00; семейное кафе с игровой",
  "after-school": "будни, 14:00–19:00",
  "weekday-evening": "пн–чт после 17:00",
  friday: "пятница после 14:00",
  "big-saturday": "суббота (пятница — слабее)",
  "slow-sunday": "воскресенье (суббота — слабее)",
  baby: "в семье ребёнок до года",
  toddler: "младшему от 1 до 3 лет",
  siblings: "двое и больше детей с разницей от 4 лет",
  grandma: "всегда, но невысокий приоритет",
  friends: "старшему от 5 лет",
  "dad-day": "всегда, невысокий приоритет",
  tweens: "старшему от 10 лет",
  joy: "всегда, невысокий приоритет",
  birthday: "всегда, невысокий приоритет",
  guests: "всегда, невысокий приоритет",
  reward: "старшему от 7 лет",
  "first-time": "младшему до 4 лет — выше",
  cool: "всегда",
  playeat: "10:00–15:00 — выше",
  energy: "младшему от 4 лет",
  creative: "интересы: рисование или готовка — выше",
  science: "интересы: наука или космос — выше",
  animals: "интерес: животные — выше",
  calm: "всегда, невысокий приоритет",
  coffee: "мороз или дождь весь день — выше",
  free: "всегда (в дождь — слабее)",
  cheap: "всегда, невысокий приоритет",
  easy: "младшему до 3 лет — выше",
  "no-crowd": "выходные — выше",
  gentle: "всегда, самый низкий приоритет (только в «Все ситуации»)",
  spring: "март–май без дождя и мороза (солнце — выше)",
  "warm-evening": "май–сентябрь, 15:00–21:00, тепло",
  "winter-tale": "декабрь–февраль (снег — выше)",
  rink: "ноябрь–март при морозе или снеге",
  "hot-water": "жара",
  "rain-play": "дождь весь день",
  "weekend-morning": "суббота и воскресенье до 11:00",
  "lunch-walk": "11:00–14:00 без дождя и мороза",
  holidays: "будни каникулярных месяцев до 15:00",
  "late-start": "15:00–18:00",
  "sunday-eve": "воскресенье после 14:00",
  "weekday-off": "будни до 14:00",
  preschool: "всем детям 4–6 лет",
  primary: "всем детям 7–9 лет",
  "big-family": "трое и больше детей",
  grandpa: "выходные — выше",
  "mom-friends": "младшему до 3 лет",
  "first-grader": "ребёнку 6–8 лет, будни после 13:00",
  twins: "двое и больше с разницей до 2 лет",
  "new-year": "декабрь и январь",
  gift: "декабрь (выше), пятница после 15:00",
  "family-dinner": "выходные 9:00–15:00",
  "summer-farewell": "август (сентябрь — слабее)",
  "theatre-circus": "дождь или мороз; выходные — выше",
  "dino-day": "интерес: динозавры",
  "transport-day": "интерес: транспорт или конструкторы",
  "music-fairy": "интерес: музыка или сказки",
  "nature-walk": "интерес: природа (без дождя, мороза, жары)",
  "sport-day": "интерес: спорт",
  "sweet-workshop": "интерес: готовка или рисование",
  bookish: "дождь или мороз — выше",
  "near-home": "младшему до 4 лет — выше",
  "free-indoors": "дождь, мороз или снег",
  splurge: "выходные — выше",
  "cheap-lunch": "будни 9:00–15:00 — выше",
  "low-energy": "будни после 17:00; дождь и мороз",
};
if (DOC) {
  const L: string[] = [];
  L.push("# Сценарии КидГоу", "");
  L.push(`Всего **${N}** сценариев (${(Object.keys(GROUP_LABEL) as ScenarioGroup[]).map((g) => `${GROUP_LABEL[g].toLowerCase()} — ${byGroup.get(g)?.length ?? 0}`).join(", ")}).`);
  L.push("Файл создаётся скриптом `npx tsx scripts/audit-scenarios.ts --doc`; правьте сценарии в `src/lib/scenarios.tsx`.", "");
  L.push("Сценарий = готовый рецепт для движка: настроение, длительность, бюджет, «поесть» и ограничения. В режиме «вся Москва» ограничение по времени в пути не применяется (его нет, откуда считать) — в результатах предлагаем выбрать округ или точку.", "");
  let i = 0;
  for (const g of Object.keys(GROUP_LABEL) as ScenarioGroup[]) {
    L.push(`## ${GROUP_LABEL[g]} (${byGroup.get(g)?.length ?? 0})`, "");
    L.push("| № | Сценарий | Рецепт | Ограничения | Когда выше всего на главной |", "|---|---|---|---|---|");
    for (const s of byGroup.get(g) ?? []) {
      i++;
      const c = s.constraints ?? {};
      const cons: string[] = [];
      if (c.indoorOnly) cons.push("только под крышей");
      if (c.outdoorPreferred) cons.push("лучше на улице");
      if (c.quiet) cons.push("тихо");
      if (c.stroller) cons.push("с коляской");
      if (c.endBy) cons.push(`домой к ${Math.floor(c.endBy / 60)}:00`);
      if (c.maxTravelMin) cons.push(`дорога до ${c.maxTravelMin} мин`);
      if (c.preferCategories) cons.push(`категории: ${c.preferCategories.join("/")}`);
      if (c.interests) cons.push(`интересы: ${c.interests.join("/")}`);
      if (c.experiences) cons.push(`формат: ${c.experiences.join("/")}`);
      if (c.startAt) cons.push(`не раньше ${Math.floor(c.startAt / 60)}:${String(c.startAt % 60).padStart(2, "0")}`);
      if (c.minStops) cons.push(`от ${c.minStops} мест`);
      if (c.parentBreak) cons.push("передышка родителю (кафе)");
      if (c.bookingOk) cons.push("бронь допустима");
      const budget = s.budget ? ({ free: "бесплатно", "2000": "до 2 000 ₽", "5000": "до 5 000 ₽", any: "любой" } as Record<string, string>)[s.budget] : "как в профиле";
      const dur = ({ short: "1–2 ч", mid: "3–4 ч", half: "полдня", day: "весь день" } as Record<string, string>)[s.duration];
      const mood = ({ energy: "энергия", creative: "творчество", learn: "узнать", outdoor: "на воздух", calm: "спокойно", surprise: "удивите" } as Record<string, string>)[s.mood];
      L.push(`| ${i} | ${s.emoji ?? "•"} **${s.label}** \`${s.id}\` | ${mood}, ${dur}, ${budget}${s.food ? ", с обедом" : ""} | ${cons.join("; ") || "—"} | ${WHEN[s.id] ?? "—"} |`);
    }
    L.push("");
  }
  L.push("## Как условия влияют на сценарий", "");
  L.push("| Условие | Что меняется |", "|---|---|");
  L.push("| Погода (прогноз по часам) | улица/крыша по окнам дождя; «успеть до дождя»; мороз и жара — только подходящее; сценарии «дождь/мороз/жара» — строго под крышей |");
  L.push("| Возраст детей | место должно подходить всем; малышам — коляска, тишина, пеленальная; старшим — не «малышовое» |");
  L.push("| Бюджет | жёсткий потолок на день (бесплатно — только бесплатные места), дорогой «якорь» штрафуется при скромном бюджете |");
  L.push("| Транспорт | машина — парковка, метро — станция рядом, пешком — короткие шаги |");
  L.push("| Место поиска | **вся Москва** — без дороги от дома, лучшее по городу; **округ** — дорога ≈ от условного центра; **точный адрес** — минуты от двери; за МКАД — расширение радиуса и места из OpenStreetMap |");
  L.push("| Время и день недели | старт не раньше «сейчас + 40 мин»; поздно — переносим на завтра; выходные — меньше толпы; часы работы по дню |");
  L.push("| Длительность / настроение / «с обедом» | число шагов, якорь дня, кафе в маршруте |");
  L.push("| Интересы и история семьи | бонус за интересы, «хотим сюда», штраф за «уже были» и «не понравилось» |", "");
  // покрытие по округам: сколько мест в каталоге и сколько ситуаций из библиотеки в округе работает «строго»
  {
    L.push("## Покрытие по округам", "");
    L.push("Если выбран округ, основные места — только из него (кафе и магазины по пути — и из соседних), а ситуация должна быть «по теме» (развивающая — музеи и наука, прогулка — парки). Когда в округе такого нет, приложение прямо говорит об этом и предлагает то же в ближайшем округе и другие ситуации, которые здесь работают.", "");
    L.push(`Показатель «ситуаций» — сколько из ${N} дают хотя бы один план в округе (семья: ребёнок 5 лет, суббота 11:00, ясно, бюджет любой).`, "");
    L.push("| Округ | Мест в каталоге | Из них основных (парк/игра/музей/актив/животные) | Ситуаций из " + N + " работает |", "|---|---|---|---|");
    const cov = allPlaces as { id: string; slug: string; latitude: number; longitude: number; region?: "msk" | "mo"; category: string }[];
    for (const o of OKRUGS) {
      const inO = cov.filter((p) => okrugOf(p) === o.id);
      const anchors = inO.filter((p) => ANCHOR_CATS.includes(p.category)).length;
      const origin = okrugOrigin(o);
      const forecast = demoForecast(origin, "sun", SAT);
      let ok = 0;
      for (const sc of SCENARIO_LIBRARY) {
        const input = buildPlannerInput({ query: { s: sc.id }, kids: [{ name: "", age: 5, interests: [] }], origin, prefs: { budget: "any", transport: "transit", maxTravelMin: 45 }, forecast, now: SAT });
        if (generatePlans(input).plans.length) ok++;
      }
      L.push(`| ${o.short} | ${inO.length} | ${anchors} | ${ok} |`);
    }
    L.push("");
  }
  writeFileSync(new URL("../docs/scenarios.md", import.meta.url), L.join("\n"));
  out("docs/scenarios.md обновлён");
}

if (process.argv.includes("--matrix")) {
  out("\nМатрица влияния (доля семей, у которых изменился лучший план; — не применимо):");
  out(["сценарий".padEnd(18), ...FACTORS.map((f) => f.short.padStart(11))].join(" "));
  for (const m of matrix) out([m.sid.padEnd(18), ...m.cells.map((c) => (c == null ? "—" : `${(c * 100).toFixed(0)}%`).padStart(11))].join(" "));
}

if (fail.length) {
  console.error(`\nАудит не пройден: ${fail.length} замечаний`);
  [...new Set(fail)].slice(0, 40).forEach((f) => console.error("  ✗", f));
  process.exit(1);
}
out("\nАудит пройден ✓");
