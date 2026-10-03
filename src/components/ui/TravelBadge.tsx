"use client";

import { Footprints, TramFront, Car, MapPin } from "lucide-react";
import type { Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { travelToPlace } from "@/lib/location";
import { formatKm } from "@/lib/geo";
import { cn } from "@/lib/cn";

/** Время в пути от точки выезда семьи — «12 мин», а не «5,2 км от центра». */
export function useTravel(place: Pick<Place, "latitude" | "longitude">) {
  const origin = useFamily((s) => s.origin);
  const transport = useFamily((s) => s.transport);
  const hydrated = useFamily((s) => s.hydrated);
  return { travel: travelToPlace(origin, place as Place, transport), hydrated, origin };
}

export function TravelBadge({ place, className, long }: { place: Place; className?: string; long?: boolean }) {
  const { travel, hydrated } = useTravel(place);
  const Icon = travel.mode === "walk" ? Footprints : travel.mode === "car" ? Car : TramFront;
  if (!hydrated)
    return (
      <span className={cn("inline-flex items-center gap-1 text-[13px] text-muted", className)}>
        <MapPin size={14} strokeWidth={2} /> …
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] text-muted", className)} title={`${formatKm(travel.km)} от точки выезда`}>
      <Icon size={14} strokeWidth={2.2} /> {travel.minutes} мин{long ? ` · ${formatKm(travel.km)}` : ""}
    </span>
  );
}
