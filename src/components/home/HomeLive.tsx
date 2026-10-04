"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { useForecast } from "@/lib/use-context";
import { daySummary, moscowDateISO } from "@/lib/forecast";
import { moscowNow, plural } from "@/lib/format";
import { pickScenarios, scenarioHref, SCENARIO_LIBRARY, type ScenarioCtx, type ScenarioDef } from "@/lib/scenarios";
import type { Scenario } from "@/lib/catalog";
import { ScenarioGrid } from "./QuickScenarioCard";
import { HeroBanner, type HeroSlide } from "./HeroBanner";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { travelToPlace } from "@/lib/location";
import { useNearbyExtras } from "@/lib/nearby";
import { GlyphRain, GlyphSun } from "@/components/icons/brand-icons";

/* ───────── контекст «сейчас» для главной ───────── */

/** После 19:00 сегодня уже никуда — показываем завтрашний день. */
export const planningOffset = (minutes: number) => (minutes >= 19 * 60 ? 1 : 0);

const NEUTRAL: ScenarioCtx = {
  weekday: 5,
  hour: 11,
  month: 10,
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

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useHomeCtx(): { ctx: ScenarioCtx; ready: boolean } {
  const mounted = useMounted();
  const { forecast } = useForecast();
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const ctx = useMemo<ScenarioCtx>(() => {
    if (!mounted) return NEUTRAL;
    const now = moscowNow();
    // вечером планируем уже завтрашний день
    const off = planningOffset(now.minutes);
    const sum = forecast ? daySummary(forecast, moscowDateISO(off)) : undefined;
    const w = sum?.window;
    const ages = kids.map((k) => k.age);
    return {
      weekday: (now.weekday + off) % 7,
      hour: off ? 10 : Math.floor(now.minutes / 60),
      month: new Date().getMonth() + 1,
      rainAllDay: !!sum?.allWet,
      rainLater: !!sum?.rainFrom && !sum.allWet,
      snow: w?.condition === "snow",
      cold: !!w && w.feelsMax < -8,
      hot: !!w && w.feelsMax >= 29,
      sunny: !!w && w.condition === "sun",
      warm: !!w && w.tempMax >= 17,
      kidsCount: kids.length,
      youngest: ages.length ? Math.min(...ages) : 5,
      oldest: ages.length ? Math.max(...ages) : 5,
      interests: kids.flatMap((k) => k.interests),
    };
  }, [mounted, forecast, kids]);
  return { ctx, ready: mounted && hydrated && !!forecast };
}

const toCard = (s: ScenarioDef): Scenario => ({ id: s.id, label: s.label, bg: s.bg, bubble: s.bubble, Glyph: s.Glyph, emoji: s.emoji, href: scenarioHref(s) });

/** «Что хочется сегодня?» — 8 ситуаций, уместных именно сейчас. */
export function HomeScenarios() {
  const { ctx } = useHomeCtx();
  const items = useMemo(() => pickScenarios(ctx).map(toCard), [ctx]);
  return (
    <>
      <ScenarioGrid items={items} />
      <Link href="/scenarios" className="press mx-4 mt-2.5 flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface text-[15px] font-semibold shadow-card">
        Все {SCENARIO_LIBRARY.length} {plural(SCENARIO_LIBRARY.length, "ситуация", "ситуации", "ситуаций")} <ArrowRight size={17} />
      </Link>
    </>
  );
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
  } else if (w.feelsMax < -8) {
    text = "Морозно — тёплые места и короткие прогулки";
    href = `/planner/results?s=frost${off ? "&day=1" : ""}`;
  } else if (w.feelsMax >= 29) {
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
        <span className="mt-0.5 block text-[11px] leading-tight text-muted">
          {forecast.source === "open-meteo" ? `Прогноз Open-Meteo · ${origin.source === "default" ? "Москва" : origin.label}` : forecast.scenario ? `Тестовая погода: ${forecast.scenario}` : "Нет связи с прогнозом — примерная погода"}
        </span>
      </span>
      <ArrowRight size={20} className="shrink-0 text-ink-2" />
    </Link>
  );
}

/** Заголовок: «Популярное в Москве», пока место не выбрано, и «Популярное рядом» — когда выбрано. */
export function NearbyPopularHeader() {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const anywhere = !hydrated || origin.source === "default";
  return <SectionHeader title={anywhere ? "Популярное в Москве" : "Популярное рядом"} href="/search?sort=popular" />;
}

/** «Популярное рядом» — с учётом точки выезда семьи. */
export function NearbyPopular({ places: seed }: { places: Place[] }) {
  const { places: extra } = useNearbyExtras();
  const places = useMemo(() => (extra.length ? [...seed, ...extra] : seed), [seed, extra]);
  const origin = useFamily((s) => s.origin);
  const transport = useFamily((s) => s.transport);
  const mounted = useMounted();
  const list = useMemo(() => {
    return places
      .filter((p) => p.category !== "cafe")
      .map((p) => {
        const near = mounted && origin.source !== "default" ? travelToPlace(origin, p, transport).minutes / 12 : 0;
        return { p, s: p.rating * 2 + Math.log10(p.review_count + 1) - near };
      })
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
      .slice(0, 8);
  }, [places, origin, transport, mounted]);
  return <PlaceCarousel places={list} />;
}
