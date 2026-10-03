"use client";

import { useMemo } from "react";
import { useFamily } from "@/lib/store";
import { rankPlaces } from "@/lib/recommend/engine";
import { getWeather } from "@/lib/weather";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PlaceCard } from "@/components/cards/PlaceCard";
import { INTEREST_LABEL } from "@/lib/recommend/explain";

/** Персональная подборка: те же правила рекомендаций, что и в планировщике. */
export function ForYou() {
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);

  const ranked = useMemo(() => {
    if (!kids.length) return [];
    return rankPlaces(
      {
        children: kids,
        duration: "mid",
        mood: "surprise",
        budget: "any",
        transport: "transit",
        location: DEFAULT_LOCATION,
        weather: getWeather(),
        now: new Date(),
      },
      (p) => p.category !== "cafe"
    ).slice(0, 8);
  }, [kids]);

  if (!hydrated || !ranked.length) return null;
  const names = kids.map((k) => k.name).join(" и ");

  return (
    <section className="mt-7">
      <SectionHeader title={`Для ${kidsGenitive(kids.map((k) => k.name))} 💛`} subtitle="По интересам и возрасту" href="/search?for=family" />
      <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
        {ranked.map(({ place }) => {
          const interest = kids.flatMap((k) => k.interests).find((i) => place.interest_tags.includes(i));
          return (
            <PlaceCard
              key={place.id}
              place={place}
              caption={interest ? `${INTEREST_LABEL[interest].emoji} ${INTEREST_LABEL[interest].label}` : undefined}
            />
          );
        })}
      </div>
      <span className="sr-only">{names}</span>
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
