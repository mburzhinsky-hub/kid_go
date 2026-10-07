"use client";

import { useMemo } from "react";
import { AdventureCard, type AdventureCardData } from "./AdventureCard";
import { areaNote, fitOfAreas } from "@/lib/area-fit";
import { useOkrug } from "@/lib/use-okrug";
import { useGeoVisible } from "@/lib/use-geo";

/** Порядок приключений с учётом выбранного округа: сначала те, что целиком в нём, потом в нём и рядом, потом остальные. */
export function useAreaOrder<T extends { areas?: string[]; tripKm?: number }>(items: T[], limit?: number) {
  const okrug = useOkrug();
  const { regionOk } = useGeoVisible();
  return useMemo(() => {
    // «Москва»: выезды за город не показываем; «Москва + область»: они идут после городских, но в первую выдачу попадают
    const city = items.filter((it) => it.tripKm == null);
    const trips = regionOk ? items.filter((it) => it.tripKm != null) : [];
    const pool = limit && trips.length ? [...city.slice(0, Math.max(1, limit - 2)), ...trips.slice(0, 2)] : [...city, ...trips];
    if (!okrug) return { okrug, list: limit ? pool.slice(0, limit) : pool };
    const ranked = pool.map((it, i) => ({ it, i, f: fitOfAreas(it.areas, okrug.id) })).sort((a, b) => a.f - b.f || a.i - b.i);
    return { okrug, list: (limit ? ranked.slice(0, limit) : ranked).map((x) => x.it) };
  }, [items, okrug, limit, regionOk]);
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
