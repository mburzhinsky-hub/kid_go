"use client";

import { useMemo } from "react";
import { AdventureCard, type AdventureCardData } from "./AdventureCard";
import { areaNote, fitOfAreas } from "@/lib/area-fit";
import { useOkrug } from "@/lib/use-okrug";

/** Порядок приключений с учётом выбранного округа: сначала те, что целиком в нём, потом в нём и рядом, потом остальные. */
export function useAreaOrder<T extends { areas?: string[] }>(items: T[], limit?: number) {
  const okrug = useOkrug();
  return useMemo(() => {
    if (!okrug) return { okrug, list: limit ? items.slice(0, limit) : items };
    const ranked = items.map((it, i) => ({ it, i, f: fitOfAreas(it.areas, okrug.id) })).sort((a, b) => a.f - b.f || a.i - b.i);
    return { okrug, list: (limit ? ranked.slice(0, limit) : ranked).map((x) => x.it) };
  }, [items, okrug, limit]);
}

/** Карусель «Готовые приключения» на главной. */
export function HomeAdventureCards({ items, limit = 6 }: { items: AdventureCardData[]; limit?: number }) {
  const { okrug, list } = useAreaOrder(items, limit);
  return (
    <>
      {list.map((a, i) => (
        <AdventureCard key={a.href} data={a} priority={i === 0} note={okrug ? areaNote(a.areas, okrug.id) : null} />
      ))}
    </>
  );
}
