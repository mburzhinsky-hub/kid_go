import { Wallet, Users, MapPin, Clock } from "lucide-react";
import type { Place } from "@/lib/types";
import { formatAgeRange, formatPrice, scheduleSummary } from "@/lib/format";
import { TravelValue } from "./TravelValue";


/** Четыре ключевых параметра в строку — как в референсе. */
export function InfoGrid({ place }: { place: Place }) {
  const sched = scheduleSummary(place.opening_hours);
  const price =
    place.price_max === 0 ? "Бесплатно" : place.price_min === 0 ? `до ${formatPrice(place.price_max)}` : `от ${formatPrice(place.price_min)}`;
  const priceLabel = place.category === "cafe" ? "чек на ребёнка" : place.category === "shop" ? "покупки" : "вход";
  const items = [
    { Icon: Wallet, color: "#1FAE47", value: price, label: priceLabel },
    { Icon: Users, color: "#1FAE47", value: formatAgeRange(place.age_min, place.age_max), label: "возраст" },
    { Icon: MapPin, color: "#FF3B4E", value: <TravelValue place={place} />, label: "в пути" },
    { Icon: Clock, color: "#2F7BFF", value: sched.days, label: sched.time },
  ];
  return (
    <div className="grid grid-cols-4">
      {items.map(({ Icon, color, value, label }, i) => (
        <div key={i} className="relative flex flex-col items-center px-1 text-center">
          {i > 0 && <span aria-hidden className="absolute left-0 top-2 h-[78%] w-px bg-line" />}
          <Icon size={30} strokeWidth={1.9} style={{ color }} />
          <p className="mt-2 text-[15px] font-semibold leading-tight">{value}</p>
          <p className="mt-0.5 text-[13px] leading-tight text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}
