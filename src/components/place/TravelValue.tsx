"use client";

import type { Place } from "@/lib/types";
import { useTravel } from "@/components/ui/TravelBadge";

export function TravelValue({ place }: { place: Place }) {
  const { travel, hydrated } = useTravel(place);
  return <>{hydrated ? `${travel.minutes} мин` : "…"}</>;
}
