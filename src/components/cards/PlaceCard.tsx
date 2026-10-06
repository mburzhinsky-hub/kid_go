import Link from "next/link";
import type { Place } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { RatingBadge, DistanceBadge } from "@/components/ui/badges";
import { formatKm } from "@/lib/geo";
import { TravelBadge } from "@/components/ui/TravelBadge";

import { cn } from "@/lib/cn";
import { placeHref } from "@/lib/place-href";

export function PlaceCard({
  place,
  width = "w-[200px]",
  className,
  priority,
  caption,
  km,
}: {
  place: Place;
  width?: string;
  className?: string;
  priority?: boolean;
  caption?: React.ReactNode;
  km?: number;
}) {
  return (
    <Link
      href={placeHref(place)}
      className={cn("press group block shrink-0 snap-start overflow-hidden rounded-[20px] bg-surface shadow-card", width, className)}
    >
      <div className="relative">
        <SmartImage
          photo={place.photos[0]}
          tint={place.tint}
          emoji={place.emoji}
          sizes="220px"
          priority={priority}
          className="aspect-[16/10] w-full"
        />
        <FavoriteButton slug={place.slug} className="absolute right-2 top-2" />
        {caption && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-ink shadow-card">
            {caption}
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-2">
        <h3 className="truncate text-[15px] font-semibold leading-snug">{place.title}</h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <RatingBadge rating={place.rating} count={place.review_count} />
          {km != null ? <DistanceBadge km={formatKm(km)} /> : <TravelBadge place={place} className="min-w-0 justify-end" />}
        </div>
      </div>
    </Link>
  );
}

export function PlaceCarousel({ places, caption }: { places: Place[]; caption?: (p: Place) => React.ReactNode }) {
  return (
    <div className="no-scrollbar snap-x-pad flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
      {places.map((p, i) => (
        <PlaceCard key={p.id} place={p} priority={false} caption={caption?.(p)} className={i === 0 ? "" : ""} />
      ))}
    </div>
  );
}

/** Широкая строка для списков (поиск, избранное). `footer` — доп. строка внутри той же карточки. */
export function PlaceRow({ place, km, aside, footer }: { place: Place; km?: number; aside?: React.ReactNode; footer?: React.ReactNode }) {
  const link = (
    <Link href={placeHref(place)} className={cn("press flex gap-3 p-2.5", !footer && "rounded-[20px] bg-surface shadow-card")}>
      <div className="relative shrink-0">
        <SmartImage photo={place.photos[0]} tint={place.tint} emoji={place.emoji} sizes="112px" className="h-[96px] w-[108px] rounded-[12px]" />
        <FavoriteButton slug={place.slug} className="absolute right-1.5 top-1.5 h-8 w-8" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.2]">{place.title}</h3>
        <p className="mt-0.5 truncate text-[14px] text-muted">{place.subtitle}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1">
          <RatingBadge rating={place.rating} count={place.review_count} />
          {km != null ? <DistanceBadge km={formatKm(km)} /> : <TravelBadge place={place} />}
        </div>
      </div>
      {aside && <div className="flex shrink-0 flex-col items-end justify-end">{aside}</div>}
    </Link>
  );
  if (!footer) return link;
  return (
    <div className="overflow-hidden rounded-[20px] bg-surface shadow-card">
      {link}
      <div className="px-3 pb-3">{footer}</div>
    </div>
  );
}
