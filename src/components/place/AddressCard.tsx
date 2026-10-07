import { MapPin } from "lucide-react";
import type { Place } from "@/lib/types";
import { RouteButton } from "@/components/place/RouteButton";
import { TravelBadge } from "@/components/ui/TravelBadge";

/** Адрес, время в пути и кнопка маршрута — один и тот же блок на всех страницах места. */
export function AddressCard({ place }: { place: Place }) {
  return (
    <div className="mt-3 rounded-[24px] bg-fill-2 p-3.5 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <MapPin size={24} strokeWidth={2} className="mt-0.5 shrink-0 text-green-ink" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-snug">{place.address}</p>
          <TravelBadge place={place} long className="mt-1 text-[14px]" />
        </div>
      </div>
      <RouteButton place={place} />
    </div>
  );
}
