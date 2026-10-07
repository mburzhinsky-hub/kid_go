"use client";

import { Navigation } from "lucide-react";
import type { Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { routeUrl } from "@/lib/route-url";

const WORD = { transit: "на транспорте", car: "на машине", walk: "пешком" } as const;

/** «Как добраться» — маршрут в Яндекс Картах тем способом, которым едет семья (машина / транспорт / пешком). */
export function RouteButton({ place }: { place: Pick<Place, "latitude" | "longitude"> }) {
  const transport = useFamily((s) => s.transport);
  return (
    <a
      href={routeUrl(place.latitude, place.longitude, transport)}
      target="_blank"
      rel="noopener noreferrer"
      className="press mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-blue-50 text-[15px] font-semibold text-blue-ink"
    >
      <Navigation size={16} /> Как добраться · {WORD[transport]}
    </a>
  );
}
