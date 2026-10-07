"use client";

import { useEffect, useMemo, useState } from "react";
import { useResolveDynamic } from "@/lib/nearby";
import { useFamily } from "@/lib/store";
import { getPlaceSync } from "@/lib/data/repository";
import { mealsFromSearch } from "@/lib/food";
import { AdventureView } from "./AdventureView";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackButton } from "@/components/place/PhotoGallery";
import type { Place } from "@/lib/types";

/** A generated day is restored from its shareable link; manual days use the store. */
export function DayView({
  steps, title, start, why, explanation, emoji, durations, dayOffset,
}: {
  steps?: string[];
  title?: string;
  start?: string;
  why?: string[];
  explanation?: string;
  emoji?: string;
  durations?: number[];
  dayOffset?: number;
}) {
  const day = useFamily((s) => s.day);
  const hydrated = useFamily((s) => s.hydrated);
  const dayStart = useFamily((s) => s.dayStart);
  const moveInDay = useFamily((s) => s.moveInDay);
  const removeFromDay = useFamily((s) => s.removeFromDay);
  const replaceInDay = useFamily((s) => s.replaceInDay);
  const fromUrl = !!steps?.length;
  const slugs = fromUrl ? steps! : day;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ver = useResolveDynamic(slugs);
  const search = mounted && fromUrl ? window.location.search : "";
  const stops = useMemo(() => {
    const meals = fromUrl ? mealsFromSearch(search) : null;
    return slugs.flatMap((slug, i) => {
      const place: Place | undefined = getPlaceSync(slug) ?? undefined;
      if (!place) return [];
      return [{ place, duration: durations?.[i], foodOption: meals === null ? undefined : meals.has(slug) }];
    });
    // Dynamic places become available after useResolveDynamic updates ver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs, durations, mounted, ver, fromUrl, search]);

  if (!mounted || (!fromUrl && !hydrated)) return <div className="h-dvh skeleton" />;

  if (!stops.length) return (
    <main className="min-h-dvh px-4 pt-[max(14px,env(safe-area-inset-top))]">
      <BackButton light />
      <EmptyState
        page
        className="mt-10"
        art="day"
        title="Ваш день пока пуст"
        text="Откройте любое место и нажмите «Добавить в наш день» в блоке «Что потом?» — мы сами посчитаем время и дорогу."
        action={{ href: "/planner", label: "Или соберём за вас ✨" }}
      />
    </main>
  );

  const first = stops[0].place;
  return (
    <AdventureView
      planKey={fromUrl ? `custom:${slugs.join("+")}` : "our-day"}
      title={title ?? "Наш день"}
      tagline={fromUrl ? "Собрали специально под вашу семью" : "Маршрут, который вы собрали сами"}
      emoji={emoji ?? "💛"}
      tint={first.tint}
      cover={first.photos[0]}
      start={start ?? dayStart}
      stops={stops}
      why={why}
      explanation={explanation}
      alternativeHref="/planner"
      saveSteps={slugs}
      editable={!fromUrl}
      onMove={moveInDay}
      onRemove={removeFromDay}
      onReplace={fromUrl ? undefined : replaceInDay}
      syncUrl={fromUrl}
      dayOffset={dayOffset}
    />
  );
}
