/**
 * Оценка географии «Москва» / «Москва + область» и режима «собрать день вокруг места» (запускается в CI).
 *   npx tsx scripts/eval-region.ts
 *
 *  - «Москва» никогда не показывает место за городом;
 *  - «Москва + область»: на 2 часа области нет, на «почти весь день» поездка есть почти всегда, дальние города — только на день;
 *  - из поездки возвращаемся не позже 22:00, дорога не съедает день, у выезда есть «от Москвы»;
 *  - «день вокруг места» всегда содержит это место, варианты различаются.
 */
import { generatePlans, DURATION_MIN, isOutside, legHome } from "../src/lib/recommend/engine";
import { demoForecast, daySummary, moscowDateISO, type WxScenario } from "../src/lib/forecast";
import { toMinutes } from "../src/lib/format";
import { DEFAULT_ORIGIN } from "../src/lib/location";
import { places } from "../src/lib/data/places";
import type { DurationId, InterestId, MoodId, Place, PlannerInput } from "../src/lib/types";

const NOW = new Date("2026-10-03T08:00:00Z"); // суббота, 11:00 МСК
const families: Record<string, { name: string; age: number; interests: InterestId[] }[]> = {
  "малыш 0": [{ name: "", age: 0, interests: [] }],
  "малыш 2": [{ name: "", age: 2, interests: ["animals"] }],
  "5 и 9": [
    { name: "", age: 5, interests: ["dinosaurs", "space"] },
    { name: "", age: 9, interests: ["drawing", "animals"] },
  ],
  "7, музыка": [{ name: "", age: 7, interests: ["music"] }],
  "11, спорт": [{ name: "", age: 11, interests: ["sport", "science"] }],
};
const moods: MoodId[] = ["energy", "creative", "learn", "outdoor", "calm", "surprise"];
const durations: DurationId[] = ["short", "mid", "half", "day"];

/* «Москва + область»: выезд за город зависит от длины дня; «Москва» область не трогает; «день вокруг места» держит место */
const regionProblems: string[] = [];
const regionStat: Record<string, { runs: number; withTrip: number; withFar: number }> = {};
const FAR_SLUGS = new Set(["kolomna-kreml", "kolomna-pastila-muzey", "kolomna-muzey-lyubimoy-igrushki", "muzey-igrushki-sergiev-posad", "melikhovo-chekhov"]);
{
  const famList = Object.values(families);
  const wxs: WxScenario[] = ["sun", "rain", "rain15", "cold"];
  for (const transport of ["car", "transit"] as const)
    for (const duration of durations) {
      const st = (regionStat[`${transport}/${duration}`] ??= { runs: 0, withTrip: 0, withFar: 0 });
      for (let i = 0; i < 12; i++) {
        const forecast = demoForecast(DEFAULT_ORIGIN, wxs[i % wxs.length], NOW);
        for (const geoScope of ["moscow", "moscow-region"] as const) {
          const input: PlannerInput = {
            children: famList[i % famList.length],
            mood: moods[i % moods.length],
            duration,
            budget: "any",
            transport,
            location: DEFAULT_ORIGIN,
            locationMode: "any",
            geoScope,
            weather: daySummary(forecast, moscowDateISO(i % 2, NOW)).weather,
            now: NOW,
            forecast,
            dayOffset: i % 2,
            seed: `reg${i}`,
          };
          const r = generatePlans(input);
          const tag = `${transport}/${duration}/#${i}/${geoScope}`;
          let trip = false;
          let far = false;
          for (const plan of r.plans) {
            const outside = plan.stops.filter((s) => isOutside(s.place));
            if (geoScope === "moscow" && outside.length) regionProblems.push(`${tag}: «Москва» показала место за городом (${outside[0].place.slug})`);
            if (!outside.length) continue;
            trip = true;
            const last = plan.stops[plan.stops.length - 1];
            const endMin = toMinutes(last.start) + last.duration + (isOutside(last.place) ? legHome(input, last.place).minutes : 0);
            if (endMin > 22 * 60) regionProblems.push(`${tag}: возвращаемся домой после 22:00 (${plan.title})`);
            if (duration === "short") regionProblems.push(`${tag}: на 2 часа выезд за город (${plan.title})`);
            for (const s of outside) {
              const m = legHome(input, s.place).minutes;
              if (m * 2 > DURATION_MIN[duration] - 60 && plan.stops.indexOf(s) === 0) regionProblems.push(`${tag}: дорога ${m} мин в одну сторону съедает день (${s.place.slug})`);
              if (FAR_SLUGS.has(s.place.slug) && duration !== "day") regionProblems.push(`${tag}: дальняя поездка ${s.place.slug} вне «почти весь день»`);
              if (FAR_SLUGS.has(s.place.slug)) far = true;
            }
            const anchorOutside = isOutside(plan.stops[0].place);
            if (anchorOutside && !plan.fromHome?.fromMoscow) regionProblems.push(`${tag}: нет «от Москвы» у выезда (${plan.title})`);
          }
          if (geoScope === "moscow-region") {
            st.runs++;
            if (trip) st.withTrip++;
            if (far) st.withFar++;
          }
        }
      }
    }
  for (const key of Object.keys(regionStat)) {
    const [, d] = key.split("/");
    const { runs, withTrip } = regionStat[key];
    const share = withTrip / Math.max(1, runs);
    if (d === "short" && share > 0) regionProblems.push(`${key}: на 2 часа область показана в ${(share * 100).toFixed(0)}% запросов`);
    if (d === "day" && share < 0.6) regionProblems.push(`${key}: на «почти весь день» выезд есть только в ${(share * 100).toFixed(0)}% запросов`);
    if (d === "half" && key.startsWith("car") && share < 0.4) regionProblems.push(`${key}: на полдня выезд есть только в ${(share * 100).toFixed(0)}% запросов`);
  }
  // «Собрать день вокруг этого места»: место в плане, варианты разные, для области — «от Москвы»
  for (const slug of ["vdnh", "kolomna-kreml", "norway-park-krasnogorsk", "moskvarium"]) {
    const forecast = demoForecast(DEFAULT_ORIGIN, "sun", NOW);
    const far = FAR_SLUGS.has(slug);
    const input: PlannerInput = {
      children: families["5 и 9"],
      mood: "surprise",
      duration: far ? "day" : "mid",
      budget: "any",
      transport: "car",
      location: DEFAULT_ORIGIN,
      locationMode: "any",
      geoScope: isOutside({ ...(places.find((p) => p.slug === slug) as Place) }) ? "moscow-region" : "moscow",
      weather: daySummary(forecast, moscowDateISO(1, NOW)).weather,
      now: NOW,
      forecast,
      dayOffset: 1,
      seed: "anchor",
      anchorSlug: slug,
    };
    const r = generatePlans(input);
    if (!r.plans.length) regionProblems.push(`вокруг «${slug}»: планов нет`);
    for (const plan of r.plans) if (!plan.stops.some((s) => s.place.slug === slug)) regionProblems.push(`вокруг «${slug}»: места нет в плане ${plan.title}`);
    const comp = r.plans.map((p) => p.stops.filter((s) => s.place.slug !== slug).map((s) => s.place.slug).join("+"));
    if (new Set(comp).size !== comp.length) regionProblems.push(`вокруг «${slug}»: варианты не различаются (${comp.join(" | ")})`);
    if (isOutside(places.find((p) => p.slug === slug) as Place) && r.plans.length && !r.plans[0].fromHome?.fromMoscow) regionProblems.push(`вокруг «${slug}»: нет «от Москвы»`);
  }
}


console.log(Object.entries(regionStat).map(([k, v]) => `  ${k}: выезд в ${v.withTrip} из ${v.runs}, дальний ${v.withFar}`).join("\n"));
if (regionProblems.length) {
  console.error(`География: проблем ${regionProblems.length}`);
  regionProblems.slice(0, 30).forEach((x) => console.error("  ✗", x));
  process.exit(1);
}
console.log("География «Москва / Москва + область» ✓");
