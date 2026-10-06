"use client";

import { Star } from "lucide-react";
import type { Place } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";

/** Кастомный маркер-карточка с фото и рейтингом (как в референсе). */
export function MapMarker({
  place,
  variant,
  selected,
  onClick,
  extra = 0,
}: {
  place: Place;
  variant: "card" | "dot";
  selected?: boolean;
  onClick: () => void;
  extra?: number;
}) {
  const rated = place.review_count > 0;
  const more = extra > 0 && (
    <span className="absolute -right-2 -top-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-pink px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
      +{extra}
    </span>
  );
  if (variant === "dot")
    return (
      <button
        onClick={onClick}
        aria-label={rated ? `${place.title}, рейтинг ${place.rating}` : place.title}
        className={cn("relative block transition-transform duration-200", selected ? "scale-125" : "hover:scale-110")}
      >
        {more}
        <SmartImage
          photo={place.photos[0]}
          tint={place.tint}
          emoji={place.emoji}
          sizes="56px"
          className={cn("h-12 w-12 rounded-full shadow-float ring-[3px]", selected ? "ring-pink" : "ring-white")}
        />
        <span className="absolute -bottom-1.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold shadow-card">
          {rated ? (
            <>
              <Star size={14} className={place.is_hit ? "fill-red text-red" : "fill-star text-star"} />
              {place.rating.toFixed(1)}
            </>
          ) : (
            place.emoji
          )}
        </span>
      </button>
    );

  return (
    <button
      onClick={onClick}
      aria-label={rated ? `${place.title}, рейтинг ${place.rating}` : place.title}
      className={cn(
        "relative block w-[112px] rounded-[24px] bg-white p-1.5 text-left shadow-float transition-transform duration-200",
        selected ? "scale-110 ring-[3px] ring-pink" : "hover:scale-105"
      )}
    >
      {more}
      <SmartImage photo={place.photos[0]} tint={place.tint} emoji={place.emoji} sizes="120px" className="h-[66px] w-full rounded-[16px]" />
      <span className="mt-1 block px-1 text-[13px] font-semibold leading-[1.15] text-ink line-clamp-2">{place.title}</span>
      <span className="mt-0.5 flex items-center gap-1 px-1 pb-0.5 text-[12px] font-semibold text-ink-2">
        {rated ? (
          <>
            <Star size={14} className={place.is_hit ? "fill-red text-red" : "fill-star text-star"} />
            {place.rating.toFixed(1)}
          </>
        ) : (
          <span className="text-muted">{place.emoji} {place.subtitle.split(" ")[0]}</span>
        )}
      </span>
      <span aria-hidden className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
    </button>
  );
}
