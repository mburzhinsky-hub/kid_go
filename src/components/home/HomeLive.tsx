"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { useForecast } from "@/lib/use-context";
import { daySummary, moscowDateISO } from "@/lib/forecast";
import { moscowNow, plural } from "@/lib/format";
import { DAY_TEMP } from "@/lib/school-calendar";
import { startToday } from "@/lib/day-window";
import { buildHomeCtx } from "@/lib/home-ctx";
import { pickScenarios, scenarioHref, SCENARIO_LIBRARY, type HomeCtx, type ScenarioCtx, type ScenarioDef } from "@/lib/scenarios";
import type { Scenario } from "@/lib/catalog";
import { ScenarioGrid } from "./QuickScenarioCard";
import { HeroBanner, type HeroSlide } from "./HeroBanner";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { travelToPlace, isSuburban, locationMode } from "@/lib/location";
import { useNearbyExtras } from "@/lib/nearby";
import { allPlaces } from "@/lib/data/repository";
import { pt } from "@/lib/geo";
import { inMoscow } from "@/lib/moscow";
import { orderByArea } from "@/lib/area-fit";
import { useOkrug } from "@/lib/use-okrug";
import { useGeoVisible } from "@/lib/use-geo";
import { isOutside } from "@/lib/outside";
import { GlyphRain, GlyphSun } from "@/components/icons/brand-icons";

/* ───────── контекст «сейчас» для главной ───────── */

/** Если сегодня уже не успеть (то же правило, что в движке для обычного дня «3–4 часа») — показываем завтрашний день. */
export const planningOffset = (minutes: number) => (startToday(minutes, "mid").tomorrow ? 1 : 0);

const NEUTRAL: ScenarioCtx = {
  weekday: 5,
  hour: 11,
  month: 10,
  day: 8,
  rainAllDay: false,
  rainLater: false,
  snow: false,
  cold: false,
  hot: false,
  sunny: false,
  warm: false,
  kidsCount: 0,
  youngest: 5,
  oldest: 5,
  interests: [],
};

const NEUTRAL_PAIR: HomeCtx = { today: NEUTRAL, tomorrow: NEUTRAL, nowMin: 11 * 60 };

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useHomeCtx(): { ctx: ScenarioCtx; pair: HomeCtx; ready: boolean } {
  const mounted = useMounted();
  const { forecast } = useForecast();
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const geoScope = useFamily((s) => s.geoScope);
  const origin = useFamily((s) => s.origin);
  const region = locationMode(origin) === "any" && geoScope === "moscow-region";
  const pair = useMemo<HomeCtx>(() => {
    if (!mounted) return NEUTRAL_PAIR;
    const now = moscowNow();
    return buildHomeCtx({ nowMin: now.minutes, weekday: now.weekday, dateOf: (off) => moscowDateISO(off), forecast: forecast ?? undefined, kids, region });
  }, [mounted, forecast, kids, region]);
  // для баннеров, которым нужен один день: тот, что подойдёт обычному выходу на 3–4 часа
  const ctx = pair === NEUTRAL_PAIR ? NEUTRAL : planningOffset(pair.nowMin) ? pair.tomorrow : pair.today;
  return { ctx, pair, ready: mounted && hydrated && !!forecast };
}

const toCard = (s: ScenarioDef): Scenario => ({ id: s.id, label: s.label, bg: s.bg, bubble: s.bubble, Glyph: s.Glyph, emoji: s.emoji, href: scenarioHref(s) });

/** «Что хочется сегодня?» — 8 ситуаций, уместных именно сейчас. */
export function HomeScenarios() {
  const { pair } = useHomeCtx();
  const items = useMemo(() => pickScenarios(pair).map(toCard), [pair]);
  return (
    <>
      <ScenarioGrid items={items} />
      <Link href="/scenarios" className="press mx-4 mt-2.5 flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface text-[15px] font-semibold shadow-card">
        Все {SCENARIO_LIBRARY.length} {plural(SCENARIO_LIBRARY.length, "ситуация", "ситуации", "ситуаций")} <ArrowRight size={16} />
      </Link>
    </>
  );
}

/** «Подходит сегодня»: те же 8 ситуаций, что и на главной, без ссылки на весь список (используется на странице ситуаций). */
export function LiveScenarios() {
  const { pair } = useHomeCtx();
  const items = useMemo(() => pickScenarios(pair).map(toCard), [pair]);
  return <ScenarioGrid items={items} />;
}

/** Карусель: в дождливый день первым — «Дождь? Не беда!». */
export function HomeHero({ slides }: { slides: HeroSlide[] }) {
  const { ctx, ready } = useHomeCtx();
  const ordered = useMemo(() => {
    if (!ready || !(ctx.rainAllDay || ctx.rainLater)) return slides;
    const rain = slides.find((s) => s.id === "rain");
    return rain ? [rain, ...slides.filter((s) => s !== rain)] : slides;
  }, [ready, ctx, slides]);
  return <HeroBanner key={ordered[0].id} slides={ordered} />;
}

/** Погода сегодня — по прогнозу для точки выезда, с окнами дождя. */
export function HomeWeather() {
  const { forecast } = useForecast();
  const origin = useFamily((s) => s.origin);
  if (!forecast)
    return (
      <div className="mx-4 flex h-[68px] items-center gap-3 rounded-[20px] bg-fill px-3">
        <span className="h-12 w-12 rounded-full skeleton" />
        <span className="h-4 w-2/3 rounded-lg skeleton" />
      </div>
    );
  const off = planningOffset(moscowNow().minutes);
  const dayWord = off ? "Завтра" : "Сегодня";
  const sum = daySummary(forecast, moscowDateISO(off));
  const w = sum.window;
  const temp = (t: number) => `${t > 0 ? "+" : ""}${t}°`;
  const bad = sum.allWet;
  let title = `${dayWord} ${temp(sum.weather.temp)}, ${sum.weather.label}`;
  let text = "Отличный день, чтобы гулять — идеи на воздухе";
  let href = scenarioHref(SCENARIO_LIBRARY.find((s) => s.id === "walk")!);
  if (bad) {
    text = `Дождь весь день — собрали идеи под крышей`;
    href = `/planner/results?s=rain${off ? "&day=1" : ""}`;
  } else if (sum.rainFrom) {
    title = `${dayWord} ${temp(sum.weather.temp)}, с ${sum.rainFrom} дождь`;
    text = "Гуляем, пока сухо, потом — под крышу. Порядок подберём сами";
    href = `/planner/results?s=before-rain${off ? "&day=1" : ""}`;
  } else if (w.feelsMax < DAY_TEMP.cold) {
    text = "Морозно — тёплые места и короткие прогулки";
    href = `/planner/results?s=frost${off ? "&day=1" : ""}`;
  } else if (w.feelsMax >= DAY_TEMP.hot) {
    text = "Жарко — идеи в тени и прохладе";
    href = `/planner/results?s=heat${off ? "&day=1" : ""}`;
  } else if (w.condition === "cloud") text = "Без дождя — можно и погулять, и в музей";
  const rainy = bad || !!sum.rainFrom;
  return (
    <Link
      href={href}
      className="press mx-4 flex items-center gap-3 rounded-[20px] px-3 py-2.5"
      style={{ background: rainy ? "linear-gradient(100deg,#E2EEFF,#EEE5FE)" : "linear-gradient(100deg,#FFF3D6,#FFE9F3)" }}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/70">
        {rainy ? <GlyphRain width={36} height={36} /> : <GlyphSun width={36} height={36} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight">{title}</span>
        <span className="block text-[13px] leading-tight text-ink-2">{text}</span>
        <span className="mt-0.5 block text-[12px] leading-tight text-muted">
          {forecast.source === "open-meteo" || forecast.scenario ? `Прогноз на сегодня · ${origin.source === "default" ? "Москва" : origin.label}` : "Примерная погода на сегодня"}
        </span>
      </span>
      <ArrowRight size={20} className="shrink-0 text-ink-2" />
    </Link>
  );
}

/** Заголовок: «Популярное в Москве», пока место не выбрано, «Популярное в СЗАО» — для округа, «Популярное рядом» — для адреса. */
export function NearbyPopularHeader() {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const okrug = useOkrug();
  const anywhere = !hydrated || origin.source === "default";
  const { places: extra } = useNearbyExtras();
  const own = useAreaPopular([], extra);
  const { regionOk } = useGeoVisible();
  return <SectionHeader title={anywhere ? (regionOk ? "Популярное в Москве и области" : "Популярное в Москве") : okrug ? (own.inArea ? `Популярное ${okrug.prep}` : `Популярное рядом с ${okrug.short}`) : "Популярное рядом"} href="/search?sort=popular" />;
}

/** Популярное с учётом выбора: округ — сначала места из него, затем соседние; адрес — по близости; вся Москва — по рейтингу. */
function useAreaPopular(seed: Place[], extra: Place[]) {
  const origin = useFamily((s) => s.origin);
  const transport = useFamily((s) => s.transport);
  const mounted = useMounted();
  const okrug = useOkrug();
  const { regionOk } = useGeoVisible();
  return useMemo(() => {
    const places = (seed.length ? seed : allPlaces).concat(extra.length ? extra : []);
    const pool = places.filter((p) => p.category !== "cafe" && p.category !== "shop");
    const quality = (p: Place) => p.rating * 2 + Math.log10(p.review_count + 1) + (p.is_hit ? 1 : 0);
    if (okrug) {
      const mins = (p: Place) => travelToPlace(origin, p, transport).minutes;
      const r = orderByArea(pool, (p) => p, okrug, quality, { enough: 4, fallback: (a, b) => mins(a) - mins(b) });
      return { list: r.list.slice(0, 8), inArea: r.inArea };
    }
    if (!mounted || origin.source === "default") {
      // «вся Москва» — только Москва; с «Москва + область» — лучшее города и несколько поездок (чтобы область не терялась)
      const city = pool.filter((p) => !isOutside(p)).sort((a, b) => quality(b) - quality(a));
      if (!regionOk) return { list: city.slice(0, 8), inArea: false };
      const region = pool.filter((p) => isOutside(p)).sort((a, b) => quality(b) - quality(a));
      return { list: [...city.slice(0, 5), ...region.slice(0, 3)], inArea: false };
    }
    return { list: pool.map((p) => ({ p, s: quality(p) - travelToPlace(origin, p, transport).minutes / 12 })).sort((a, b) => b.s - a.s).map((x) => x.p).slice(0, 8), inArea: false };
  }, [seed, extra, origin, transport, mounted, okrug, regionOk]);
}

/** «Популярное рядом» — с учётом точки выезда семьи. */
export function NearbyPopular({ places: seed }: { places: Place[] }) {
  const { places: extra } = useNearbyExtras();
  const { list } = useAreaPopular(seed, extra);
  return <PlaceCarousel places={list} />;
}
