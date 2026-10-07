/**
 * Аудит «округ — граница» на ВСЕХ экранах и во ВСЕХ 11 округах.
 *   npx tsx scripts/audit-areas.ts
 *
 * Проверяет не только подбор дня, но и всё остальное, где приложение что-то предлагает от выбранного округа:
 *  1. Подбор дня: каждый сценарий × округ × погода × семья — основные места только в округе, кафе/магазины — в нём или рядом;
 *     «здесь нет» всегда с выходом (другой округ или другая ситуация, которая в этом округе работает).
 *  2. «Для вас» на главной (rankPlaces): ничего дальше соседних округов.
 *  3. Замена шага: занятие меняется на занятие из того же округа, кафе/магазин — из него или соседнего.
 *  4. «Популярное» и карта (orderByArea): свои места первыми, чужие — только если своих почти нет.
 *  5. Готовые приключения: у каждого понятно, где он проходит, и в каждом округе видно, что в нём целиком.
 * Выход ≠ 0, если нарушено хоть одно правило. Таблица покрытия — в конце.
 */
import { generatePlans, rankPlaces } from "../src/lib/recommend/engine";
import { buildPlannerInput, type ResultsQuery } from "../src/lib/recommend/build-input";
import { areaAlternatives } from "../src/lib/recommend/area";
import { alternativesFor } from "../src/lib/alternatives";
import { areasOfPlaces, fitOfAreas, orderByArea } from "../src/lib/area-fit";
import { demoForecast, moscowDateISO, weekdayOf, type WxScenario } from "../src/lib/forecast";
import { OKRUGS, okrugOrigin, type Okrug } from "../src/lib/location";
import { okrugOf, okrugOfOrigin, tierOf } from "../src/lib/moscow";
import { SCENARIO_LIBRARY as ALL_SCENARIOS } from "../src/lib/scenarios";
/** Поездки за город («Выезд на день» и др.) считаются от центра и по определению вне округа — их проверяет audit-scenarios. */
const SCENARIO_LIBRARY = ALL_SCENARIOS.filter((s) => !s.constraints?.regionOnly);
import { allPlaces, allAdventures, adventurePlaces } from "../src/lib/data/repository";
import { travelBetween } from "../src/lib/location";
import { pt } from "../src/lib/geo";
import type { Place, TransportId } from "../src/lib/types";

const ANCHOR = ["park", "play", "museum", "active", "animals"];
const ROLE = (p: Place) => (ANCHOR.includes(p.category) ? "activity" : p.category === "cafe" ? "food" : "extra");
const FAMS: Record<string, { name: string; age: number; interests: never[] }[]> = {
  "малыш 2": [{ name: "", age: 2, interests: [] }],
  "дошкольник 5": [{ name: "", age: 5, interests: [] }],
  "школьник 9": [{ name: "", age: 9, interests: [] }],
  "двое 3+8": [{ name: "", age: 3, interests: [] }, { name: "", age: 8, interests: [] }],
};
const WX: WxScenario[] = ["sun", "rain", "cold"];
const SAT = new Date("2026-10-03T08:00:00Z");
const TUE = new Date("2026-10-06T14:00:00Z");

const bad: string[] = [];
const hard = (s: string) => bad.length < 400 && bad.push(s);
const FAMILY = { want: [], visited: [], loved: [], disliked: [], seen: [] };

interface Row {
  okrug: Okrug;
  places: number;
  anchors: number;
  scenariosOk: number;
  scenariosGap: number;
  gapNoExit: number;
  advHere: number;
  advNear: number;
}
const rows: Row[] = [];

for (const o of OKRUGS) {
  const origin = okrugOrigin(o);
  const transport: TransportId = o.id === "zelao" || o.id === "nao" ? "car" : "transit";
  const inO = allPlaces.filter((p) => okrugOf(p) === o.id);
  const row: Row = { okrug: o, places: inO.length, anchors: inO.filter((p) => ANCHOR.includes(p.category)).length, scenariosOk: 0, scenariosGap: 0, gapNoExit: 0, advHere: 0, advNear: 0 };

  if (okrugOfOrigin(origin)?.id !== o.id) hard(`${o.short}: okrugOfOrigin не узнаёт собственный округ`);
  // сохранённая раньше точка с чуть другими координатами — всё равно тот же округ
  if (okrugOfOrigin({ ...origin, lat: origin.lat + 0.01, lng: origin.lng - 0.01 })?.id !== o.id) hard(`${o.short}: сдвинутая точка округа не распознана`);

  /* 1. Подбор дня */
  for (const s of SCENARIO_LIBRARY) {
    let scenarioOk = false;
    for (const [fname, kids] of Object.entries(FAMS)) {
      for (const wx of WX) {
        for (const now of [SAT, TUE]) {
          const query: ResultsQuery = { s: s.id };
          const forecast = demoForecast(origin, wx, now);
          const prefs = { budget: "5000" as const, transport, maxTravelMin: 40 };
          const input = buildPlannerInput({ query, kids, origin, prefs, forecast, now, family: FAMILY });
          const tag = `${o.short} · ${s.id} · ${fname} · ${wx} · ${now.getUTCDay()}`;
          if (input.locationMode !== "area") hard(`${tag}: режим не «округ»`);
          const r = generatePlans(input);
          if (!r.area || r.area.id !== o.id || r.area.scope !== "strict") hard(`${tag}: в результате нет данных о строгом округе`);
          for (const [pi, p] of r.plans.entries()) {
            for (const st of p.stops) {
              const t = tierOf(st.place, o.id);
              const anchor = ANCHOR.includes(st.place.category) || (input.constraints?.parentBreak && st.place.category === "cafe" && st.place.experience_tags.includes("playzone"));
              if (t === 2) hard(`${tag} #${pi + 1}: ${st.place.slug} (${okrugOf(st.place) ?? "не Москва"}) вне округа и соседей`);
              else if (anchor && t !== 0) hard(`${tag} #${pi + 1}: основное ${st.place.slug} (${okrugOf(st.place)}) не в ${o.short}`);
            }
            /* 3. Замена шага для каждого шага найденных планов */
            if (pi === 0 && fname === "дошкольник 5" && wx === "sun" && now === SAT) {
              const dateISO = moscowDateISO(r.dayOffset, now);
              p.stops.forEach((st, i) => {
                const alts = alternativesFor(p.stops, i, { kids, transport, weekday: weekdayOf(dateISO), forecast, dateISO, area: o.id });
                for (const a of alts) {
                  const role = ROLE(a.place);
                  const tt = tierOf(a.place, o.id);
                  if (role === "activity" && ROLE(st.place) === "activity" && tierOf(st.place, o.id) === 0 && tt !== 0) hard(`${tag}: замена «${st.place.slug}» → ${a.place.slug} (${okrugOf(a.place)}) увозит из ${o.short}`);
                  if (role !== "activity" && tt === 2) hard(`${tag}: замена «${st.place.slug}» → ${a.place.slug} (${okrugOf(a.place) ?? "МО"}) дальше соседних округов`);
                  if (travelBetween(pt(st.place), pt(a.place), transport).minutes > 90) hard(`${tag}: замена ${a.place.slug} слишком далеко от ${st.place.slug}`);
                }
              });
            }
          }
          if (r.plans.length) scenarioOk = true;
          else if (fname === "дошкольник 5" && wx === "sun" && now === SAT) {
            // «здесь нет» — допустимо, если есть выход
            const alt = areaAlternatives({ query, kids, origin, prefs, forecast, now, family: FAMILY }, input);
            if (!alt || (!alt.others.length && !alt.scenarios.length && !r.suggestions.length)) {
              row.gapNoExit++;
              hard(`${tag}: в округе пусто и выхода нет`);
            }
            for (const other of alt?.others ?? []) {
              const oid = okrugOfOrigin(other.origin)?.id;
              if (oid === o.id) hard(`${tag}: «другой округ» совпал с выбранным`);
              if (!oid) continue; // город области — внутри него округов нет
              for (const p of other.plans) {
                for (const st of p.stops) {
                  if (ANCHOR.includes(st.place.category) && okrugOf(st.place) !== oid) hard(`${tag}: в варианте «${other.label}» основное ${st.place.slug} не в этом округе`);
                }
              }
            }
          }
        }
      }
    }
    if (scenarioOk) row.scenariosOk++;
    else row.scenariosGap++;
  }

  /* 2. «Для вас» на главной */
  for (const [fname, kids] of Object.entries(FAMS)) {
    for (const wx of WX) {
      const now = SAT;
      const forecast = demoForecast(origin, wx, now);
      const input = buildPlannerInput({ query: {}, kids, origin, prefs: { budget: "any", transport, maxTravelMin: 40 }, forecast, now, family: FAMILY });
      const list = rankPlaces({ ...input, areaScope: undefined, budget: "any", mood: "surprise", duration: "mid" }, (p) => p.category !== "cafe", 6);
      let seenAdj = false;
      for (const sp of list) {
        const t = tierOf(sp.place, o.id);
        if (t === 2) hard(`Для вас · ${o.short} · ${fname} · ${wx}: ${sp.place.slug} (${okrugOf(sp.place) ?? "МО"}) дальше соседних округов`);
        if (t === 1) seenAdj = true;
        if (t === 0 && seenAdj) hard(`Для вас · ${o.short}: место из округа (${sp.place.slug}) после соседнего`);
      }
    }
  }

  /* 4. «Популярное» / карта */
  const quality = (p: Place) => p.rating * 2 + Math.log10(p.review_count + 1) + (p.is_hit ? 1 : 0);
  const pool = allPlaces.filter((p) => p.category !== "cafe" && p.category !== "shop");
  const mins = (p: Place) => travelBetween(origin, pt(p), transport).minutes;
  const ord = orderByArea(pool, (p) => p, o, quality, { enough: 4, fallback: (a, b) => mins(a) - mins(b) });
  const own = pool.filter((p) => tierOf(p, o.id) === 0).length;
  const adj = pool.filter((p) => tierOf(p, o.id) === 1).length;
  if (own >= 4 && ord.list.some((p) => tierOf(p, o.id) === 2)) hard(`Популярное · ${o.short}: чужие места при ${own} своих`);
  if (own + adj >= 3 && ord.list.some((p) => tierOf(p, o.id) === 2)) hard(`Популярное · ${o.short}: дальние места при ${own + adj} своих и соседних`);
  if (!ord.list.length) hard(`Популярное · ${o.short}: пусто`);
  // свои — строго впереди соседних
  let sawAdj = false;
  for (const p of ord.list.slice(0, 8)) {
    const t = tierOf(p, o.id);
    if (t === 1) sawAdj = true;
    if (t === 0 && sawAdj) hard(`Популярное · ${o.short}: ${p.slug} из округа после соседнего`);
  }

  /* 5. Приключения */
  for (const a of allAdventures) {
    const areas = areasOfPlaces(adventurePlaces(a));
    const f = fitOfAreas(areas, o.id);
    if (f === 0) row.advHere++;
    else if (f === 1) row.advNear++;
  }
  rows.push(row);
}

for (const a of allAdventures) {
  const areas = areasOfPlaces(adventurePlaces(a));
  if (!areas.length) hard(`приключение ${a.slug}: не определён округ`);
}

console.log("Округ        мест  основных  ситуаций с планом  «здесь нет»  без выхода  приключений в округе / рядом");
for (const r of rows) {
  console.log(
    `${r.okrug.short.padEnd(12)} ${String(r.places).padStart(4)} ${String(r.anchors).padStart(9)} ${String(r.scenariosOk).padStart(11)} / ${SCENARIO_LIBRARY.length} ${String(r.scenariosGap).padStart(11)} ${String(r.gapNoExit).padStart(11)} ${String(r.advHere).padStart(12)} / ${r.advNear}`
  );
}
console.log(`\nПроверено: ${OKRUGS.length} округов × ${SCENARIO_LIBRARY.length} ситуаций × ${Object.keys(FAMS).length} семьи × ${WX.length} погоды × 2 времени, плюс «Для вас», замена шага, «Популярное», приключения.`);
if (bad.length) {
  console.log(`\nНАРУШЕНИЙ: ${bad.length}`);
  for (const b of bad.slice(0, 60)) console.log(" ✗", b);
  process.exit(1);
}
console.log("Нарушений нет ✓");
