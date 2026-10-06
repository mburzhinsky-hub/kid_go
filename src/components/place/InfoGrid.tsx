import { Wallet, Users, MapPin, Clock } from "lucide-react";
import type { Place } from "@/lib/types";
import { formatAgeRange, formatPrice, scheduleSummary } from "@/lib/format";
import { TravelLabel, TravelValue } from "./TravelValue";

/** Показываем только те факты, которые подтверждены источником. */
export function InfoGrid({ place }: { place: Place }) {
  const sched = scheduleSummary(place.opening_hours);
  const verified = new Set(place.verified_fields ?? []);
  const priceVerified = verified.has("price");
  const hoursVerified = verified.has("opening_hours");
  const basePrice =
    place.price_max === 0 ? "Бесплатно" : place.price_min === 0 ? `до ${formatPrice(place.price_max)}` : `от ${formatPrice(place.price_min)}`;

  const items = [
    ...(priceVerified
      ? [{
          Icon: Wallet,
          color: "#1FAE47",
          value: basePrice,
          label: place.category === "cafe" ? "чек на ребёнка" : place.category === "shop" ? "покупки" : "вход",
        }]
      : []),
    { Icon: Users, color: "#1FAE47", value: formatAgeRange(place.age_min, place.age_max), label: "возраст" },
    { Icon: MapPin, color: "#FF3B4E", value: <TravelValue place={place} />, label: <TravelLabel place={place} /> },
    ...(hoursVerified ? [{ Icon: Clock, color: "#2F7BFF", value: sched.days, label: sched.time }] : []),
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
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
