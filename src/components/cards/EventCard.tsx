import Link from "next/link";
import type { KidEvent, Place } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatAgeRange, formatPrice } from "@/lib/format";

const time = (iso: string) => iso.slice(11, 16);

export function EventCard({ event, place, isToday }: { event: KidEvent; place: Place; isToday: boolean }) {
  return (
    <Link href={`/places/${place.slug}`} className="press block w-[260px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-surface shadow-card">
      <div className="relative">
        <SmartImage photo={event.image} tint={place.tint} emoji={place.emoji} sizes="280px" className="aspect-[16/9] w-full" />
        <span className="absolute left-2.5 top-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold shadow-card">
          <span className={isToday ? "h-2 w-2 rounded-full bg-red" : "h-2 w-2 rounded-full bg-blue"} />
          {isToday ? "Сегодня" : "Завтра"} · {time(event.start_at)}
        </span>
        <span className="absolute right-2.5 top-2.5 inline-flex h-8 items-center rounded-full bg-yellow px-3 text-[13px] font-bold">
          {event.price === 0 ? "Бесплатно" : formatPrice(event.price)}
        </span>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 text-[15.5px] font-semibold leading-snug">{event.title}</h3>
        <p className="mt-1 truncate text-[13px] text-muted">
          {place.emoji} {place.title} · {formatAgeRange(event.age_min, event.age_max)}
        </p>
      </div>
    </Link>
  );
}
