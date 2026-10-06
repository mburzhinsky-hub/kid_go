"use client";

import { Suspense } from "react";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DayView } from "@/components/adventure/DayView";
import { PlannerResults } from "@/components/planner/PlannerResults";
import { SearchScreen } from "@/components/search/SearchScreen";
import { MapScreen } from "@/components/map/MapScreen";
import { FavoritesScreen } from "@/components/favorites/FavoritesScreen";
import { NearbyPlaceView } from "@/components/place/NearbyPlaceView";
import type { CategoryId } from "@/lib/types";

/** Экраны, зависящие от query-параметров. Читаем их на клиенте — страницы остаются статическими
 *  (работает и на сервере Next, и при статической выгрузке на GitHub Pages). */

function DayRoute() {
  const sp = useSearchParams();
  const g = (k: string) => sp.get(k) ?? undefined;
  return (
    <DayView
      steps={g("steps")?.split(",").filter(Boolean)}
      title={g("title")}
      start={g("start")}
      emoji={g("emoji")}
      explanation={g("why")}
      why={g("chips")?.split("|").filter(Boolean)}
      durations={g("d")?.split(",").map(Number)}
      dayOffset={Number(g("day") ?? 0) || 0}
    />
  );
}

function ResultsRoute() {
  const sp = useSearchParams();
  return <PlannerResults query={Object.fromEntries(sp.entries())} />;
}

function SearchRoute() {
  const sp = useSearchParams();
  const s = sp.get("sort");
  const sort = s === "popular" ? "best" : (s as "near" | "cheap" | null) ?? undefined;
  return <SearchScreen initialQ={sp.get("q") ?? ""} initialCategory={(sp.get("category") as CategoryId) || undefined} initialSort={sort} />;
}

function MapRoute() {
  const sp = useSearchParams();
  const plan = sp.get("plan");
  const places = sp.get("places");
  const title = sp.get("title") ?? undefined;
  const cr = sp.get("cr") ?? undefined;
  const col = sp.get("col") ?? undefined;
  // стабильные ссылки: карта пересоздаётся при смене этих значений
  const initialPlan = useMemo(() => plan?.split(",").filter(Boolean), [plan]);
  const initialSet = useMemo(() => (places ? { slugs: places.split(",").filter(Boolean), title, creator_id: cr, collection_id: col } : undefined), [places, title, cr, col]);
  return <MapScreen initialCategory={(sp.get("category") as CategoryId) || undefined} initialFocus={sp.get("place") || undefined} initialPlan={initialPlan} initialSet={initialSet} />;
}

function FavoritesRoute() {
  const t = useSearchParams().get("tab");
  return <FavoritesScreen initialTab={t === "plans" || t === "visited" || t === "collections" ? t : "want"} />;
}

function NearbyRoute() {
  return <NearbyPlaceView id={useSearchParams().get("id") ?? undefined} />;
}

const wrap = (C: React.ComponentType) =>
  function Wrapped() {
    return (
      <Suspense fallback={null}>
        <C />
      </Suspense>
    );
  };

export const DayPageClient = wrap(DayRoute);
export const ResultsPageClient = wrap(ResultsRoute);
export const SearchPageClient = wrap(SearchRoute);
export const MapPageClient = wrap(MapRoute);
export const FavoritesPageClient = wrap(FavoritesRoute);
export const NearbyPageClient = wrap(NearbyRoute);
