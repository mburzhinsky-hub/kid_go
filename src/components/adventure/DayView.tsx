"use client";

import { useMemo } from "react";
import { useFamily } from "@/lib/store";
import { getPlaceSync } from "@/lib/data/repository";
import { AdventureView } from "./AdventureView";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackButton } from "@/components/place/PhotoGallery";
import type { Place } from "@/lib/types";

/**
 * «Наш день»: либо собранный пользователем через «Что потом?» (живёт в store),
 * либо сгенерированный планировщиком (шаги в URL — им можно поделиться).
 */
export function DayView({
  steps,
  title,
  start,
  why,
  explanation,
  emoji,
  durations,
  dayOffset,
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

  const stops = useMemo(
    () =>
      slugs
        .map((s) => getPlaceSync(s))
        .filter((p): p is Place => !!p)
        .map((place, i) => ({ place, duration: durations?.[i] })),
    [slugs, durations]
  );

  if (!fromUrl && !hydrated) return <div className="h-dvh skeleton" />;

  if (!stops.length)
    return (
      <main className="min-h-dvh px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton light />
        <EmptyState
          className="mt-10"
          art="day"
          title="Ваш день пока пуст"
          text="Откройте любое место и нажмите «Добавить в наш день» в блоке «Что сделать после?» — мы сами посчитаем время и дорогу."
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
      alternativeHref={fromUrl ? "/planner" : "/planner"}
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
