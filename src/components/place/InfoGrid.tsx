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

  const items: { Icon: typeof Wallet; color: string; value: React.ReactNode; label: React.ReactNode; wide?: boolean }[] = [
    ...(priceVerified
      ? [{
          Icon: Wallet,
          color: "#1FAE47",
          value: basePrice,
          label: place.category === "cafe" ? "чек на ребёнка" : place.category === "shop" ? "покупки" : "вход",
        }]
      : []),
    { Icon: Users, color: "#1FAE47", value: formatAgeRange(place.age_min, place.age_max), label: "возраст" },
    { Icon: MapPin, color: "#FF3B4E", value: <TravelValue place={place} />, label: <TravelLabel place={place} />, wide: true },
    ...(hoursVerified ? [{ Icon: Clock, color: "#2F7BFF", value: sched.days, label: sched.time }] : []),
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: items.map((it) => (it.wide ? "minmax(0, 1.3fr)" : "minmax(0, 1fr)")).join(" ") }}>
      {items.map(({ Icon, color, value, label, wide }, i) => (
        <div key={i} lang="ru" className="relative flex min-w-0 flex-col items-center px-0.5 text-center">
          {i > 0 && <span aria-hidden className="absolute left-0 top-2 h-[78%] w-px bg-line" />}
          <Icon size={30} strokeWidth={1.9} style={{ color }} />
          <p className={`mt-2 max-w-full break-words font-semibold leading-tight hyphens-auto ${wide ? "text-[14px]" : "text-[15px]"}`}>{value}</p>
          <p className="mt-0.5 max-w-full break-words text-[13px] leading-tight text-muted hyphens-auto">{label}</p>
        </div>
      ))}
    </div>
  );
}
