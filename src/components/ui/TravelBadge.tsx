"use client";

import { Footprints, TramFront, Car, MapPin } from "lucide-react";
import type { Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { locationMode, travelToPlace, type LocMode } from "@/lib/location";
import { formatKm } from "@/lib/geo";
import { cn } from "@/lib/cn";

/** Время в пути от точки выезда семьи — «12 мин», а не «5,2 км от центра». */
export function useTravel(place: Pick<Place, "latitude" | "longitude">) {
  const origin = useFamily((s) => s.origin);
  const transport = useFamily((s) => s.transport);
  const hydrated = useFamily((s) => s.hydrated);
  const mode: LocMode = hydrated ? locationMode(origin) : "any";
  const t = travelToPlace(origin, place as Place, transport);
  // округ — дорога от условного центра, минус путь «внутри округа»; «вся Москва» — дорога не считается
  const travel = mode === "area" ? { ...t, minutes: Math.max(5, t.minutes - 10) } : t;
  return { travel, hydrated, origin, mode };
}

/** Что показать вместо минут, когда привязки к точке нет: метро или город — только то, что есть в данных. */
export function whereLabel(place: Pick<Place, "metro" | "town" | "address">): string {
  if (place.metro) return `м. ${place.metro}`;
  if (place.town) return place.town.replace(/\s*\(.*\)\s*$/, "");
  return place.address.split(",")[0];
}

export function TravelBadge({ place, className, long }: { place: Place; className?: string; long?: boolean }) {
  const { travel, hydrated, mode } = useTravel(place);
  if (mode === "any")
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1 text-[13px] text-muted", className)}>
        <MapPin size={14} strokeWidth={2} className="shrink-0" /> <span className="truncate">{whereLabel(place)}</span>
      </span>
    );
  const Icon = travel.mode === "walk" ? Footprints : travel.mode === "car" ? Car : TramFront;
  if (!hydrated)
    return (
      <span className={cn("inline-flex items-center gap-1 text-[13px] text-muted", className)}>
        <MapPin size={14} strokeWidth={2} /> …
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] text-muted", className)} title={mode === "area" ? "Примерно, от центра выбранного округа" : `${formatKm(travel.km)} от точки выезда`}>
      <Icon size={14} strokeWidth={2.2} /> {mode === "area" ? "≈ " : ""}{travel.minutes} мин{long ? ` · ${formatKm(travel.km)}` : ""}
    </span>
  );
}
