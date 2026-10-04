"use client";

import { useMemo } from "react";
import { useFamily, familySignals } from "@/lib/store";
import { rankPlaces } from "@/lib/recommend/engine";
import { useForecast } from "@/lib/use-context";
import { useNearbyExtras } from "@/lib/nearby";
import { locationMode } from "@/lib/location";
import { daySummary, moscowDateISO } from "@/lib/forecast";
import { getWeather } from "@/lib/weather";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PlaceCard } from "@/components/cards/PlaceCard";
import { AgePicker } from "@/components/ui/AgePicker";
import { INTEREST_LABEL } from "@/lib/recommend/explain";

/** Персональная подборка: те же правила, что и в планировщике, — от точки выезда и по погоде. */
export function ForYou() {
  const s = useFamily();
  const { forecast } = useForecast();
  const kids = s.children;
  const nearby = useNearbyExtras();

  const ranked = useMemo(() => {
    if (!kids.length) return [];
    const mode = locationMode(s.origin);
    return rankPlaces(
      {
        children: kids,
        duration: "mid",
        mood: "surprise",
        budget: "any",
        transport: s.transport,
        location: s.origin,
        locationMode: mode,
        extraPlaces: nearby.places.length ? nearby.places : undefined,
        weather: forecast ? daySummary(forecast, moscowDateISO(0)).weather : getWeather(),
        forecast,
        now: new Date(),
        family: familySignals(s),
        constraints: mode === "any" ? {} : { maxTravelMin: s.maxTravelMin + 15 },
      },
      (p) => p.category !== "cafe",
      6
    ).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kids, forecast, s.origin, s.transport, s.maxTravelMin, s.wantPlaces, s.visitedPlaces, s.loved, s.disliked, nearby.places]);

  if (!s.hydrated) return null;
  if (!kids.length)
    return (
      <section className="mx-4 mt-7 rounded-[24px] bg-surface p-4 shadow-card">
        <h2 className="tight text-[20px] font-[800] leading-tight">Сколько лет ребёнку? 💛</h2>
        <p className="mt-1 text-[14px] text-muted">Один тап — и подборки, и планы будут только про подходящие места.</p>
        <AgePicker
          className="mt-3"
          onPick={(age) => s.upsertChild({ id: `c${Date.now()}`, name: "", age, interests: [], emoji: "🦁" })}
        />
      </section>
    );
  if (!ranked.length) return null;
  const named = kids.filter((k) => k.name);
  const title = named.length === kids.length ? `Для ${kidsGenitive(named.map((k) => k.name))} 💛` : "Для ваших детей 💛";

  return (
    <section className="mt-7">
      <SectionHeader title={title} subtitle="По возрасту, интересам и погоде" href="/search?for=family" />
      <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
        {ranked.map(({ place }) => {
          const interest = kids.flatMap((k) => k.interests).find((i) => place.interest_tags.includes(i));
          return (
            <PlaceCard
              key={place.id}
              place={place}
              caption={s.wantPlaces.includes(place.slug) ? "❤️ Хотели сюда" : interest ? `${INTEREST_LABEL[interest].emoji} ${INTEREST_LABEL[interest].label}` : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

/** Родительный падеж для частых детских имён: Миша → Миши, Аня → Ани, Олег → Олега. */
export function kidsGenitive(names: string[]) {
  const g = (n: string) => {
    if (/[гкхжшщч]а$/.test(n) || n.endsWith("я")) return n.slice(0, -1) + "и";
    if (n.endsWith("а")) return n.slice(0, -1) + "ы";
    if (/[йь]$/.test(n)) return n.slice(0, -1) + "я";
    if (/[бвгджзклмнпрстфхцчшщ]$/.test(n)) return n + "а";
    return n;
  };
  return names.map(g).join(" и ");
}
