"use client";

import Link from "next/link";
import type { Place } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { RatingBadge } from "@/components/ui/badges";
import { TravelBadge } from "@/components/ui/TravelBadge";
import { categoryDef } from "@/lib/catalog";
import { placeHref } from "@/lib/place-href";
import { cn } from "@/lib/cn";

/**
 * Компактная карточка места для нижней панели карты: фото слева, название и дорога справа.
 * Невысокая (≈ 88 px), поэтому карта остаётся главным на экране, а не прячется за списком.
 */
export function MapPlaceChip({ place, caption, onFocus, className }: { place: Place; caption?: string; onFocus?: () => void; className?: string }) {
  const cat = categoryDef(place.category);
  return (
    <Link
      href={placeHref(place)}
      onMouseEnter={onFocus}
      className={cn("press flex h-[88px] w-[262px] shrink-0 snap-start items-center gap-3 rounded-[20px] bg-surface p-2 shadow-card", className)}
    >
      <SmartImage photo={place.photos[0]} tint={place.tint} emoji={place.emoji} sizes="72px" className="h-[72px] w-[72px] shrink-0 rounded-[14px]" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-1">
        <span className="truncate text-[12px] font-semibold leading-none" style={{ color: cat.fg }}>
          {caption ?? cat.name}
        </span>
        <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-[1.2]">{place.title}</h3>
        <div className="flex min-w-0 items-center gap-2.5">
          {place.review_count > 0 && <RatingBadge rating={place.rating} className="shrink-0 text-[12.5px]" />}
          <TravelBadge place={place} className="min-w-0 text-[12.5px]" />
        </div>
      </div>
    </Link>
  );
}
