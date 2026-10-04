"use client";

import type { Place } from "@/lib/types";
import { useTravel, whereLabel } from "@/components/ui/TravelBadge";

export function TravelValue({ place }: { place: Place }) {
  const { travel, hydrated, mode } = useTravel(place);
  if (!hydrated) return <>…</>;
  if (mode === "any") return <>{whereLabel(place)}</>;
  return <>{mode === "area" ? "≈ " : ""}{travel.minutes} мин</>;
}

export function TravelLabel({ place }: { place: Place }) {
  const { hydrated, mode } = useTravel(place);
  return <>{hydrated && mode === "any" ? "где" : "в пути"}</>;
}
