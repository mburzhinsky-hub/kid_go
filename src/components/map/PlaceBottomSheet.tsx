"use client";

import Link from "next/link";
import { X, Navigation, ArrowRight } from "lucide-react";
import type { Place } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { WantButton } from "@/components/social/WantButton";
import { RatingBadge, DistanceBadge, AgeBadge, PriceBadge } from "@/components/ui/badges";
import { OpenStatus } from "@/components/place/OpenStatus";
import { categoryDef } from "@/lib/catalog";
import { formatAgeRange, placePriceShort } from "@/lib/format";
import { routeUrl } from "@/lib/route-url";
import { placeHref } from "@/lib/place-href";

/** Карточка выбранного маркера, выезжающая снизу. */
export function PlaceBottomSheet({ place, minutes, onClose }: { place: Place; minutes?: number; onClose: () => void }) {
  const cat = categoryDef(place.category);
  return (
    <div className="animate-sheet">
      <div className="flex gap-3">
        <Link href={placeHref(place)} className="shrink-0">
          <SmartImage photo={place.photos[0]} tint={place.tint} emoji={place.emoji} sizes="120px" className="h-[104px] w-[112px] rounded-[18px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: cat.fg }}>
              <cat.Icon width={13} height={13} /> {cat.name}
            </span>
            <button onClick={onClose} aria-label="Закрыть" className="press -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full bg-fill">
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
          <Link href={placeHref(place)}>
            <h3 className="mt-0.5 text-[18px] font-bold leading-tight">{place.title}</h3>
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <RatingBadge rating={place.rating} count={place.review_count} />
            {minutes != null && <DistanceBadge km={`${minutes} мин в пути`} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AgeBadge>{formatAgeRange(place.age_min, place.age_max)}</AgeBadge>
            <PriceBadge>{placePriceShort(place)}</PriceBadge>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <OpenStatus hours={place.opening_hours} />
      </div>
      <div className="mt-3 flex gap-2">
        <WantButton slug={place.slug} className="min-w-0 flex-1" />
        <a
          href={routeUrl(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Маршрут"
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue"
        >
          <Navigation size={20} />
        </a>
        <Link href={placeHref(place)} className="press flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-fill text-[15px] font-semibold text-ink">
          Подробнее <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
