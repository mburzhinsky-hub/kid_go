"use client";

import { useEffect, useState } from "react";
import { MapPin, Navigation, Info } from "lucide-react";
import type { Place } from "@/lib/types";
import { getPlaceSync } from "@/lib/data/repository";
import { useFamily } from "@/lib/store";
import { useNearbyExtras, useResolveDynamic } from "@/lib/nearby";
import { categoryDef } from "@/lib/catalog";
import { routeUrl } from "@/lib/route-url";
import { HeroGallery } from "@/components/place/PhotoGallery";
import { PlaceCTA, PlaceIntentRow } from "@/components/place/PlaceCTA";
import { ReadMore } from "@/components/place/ReadMore";
import { TagChip } from "@/components/ui/badges";
import { TravelBadge } from "@/components/ui/TravelBadge";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Карточка места из OpenStreetMap. Такие места подгружаются «на лету» вокруг точки выезда,
 * поэтому страница не предгенерируется, а читает место из локального реестра/кэша.
 */
export function NearbyPlaceView({ id }: { id?: string }) {
  const hydrated = useFamily((s) => s.hydrated);
  const { status } = useNearbyExtras(); // гарантирует, что реестр прогрет текущей ячейкой
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const ver = useResolveDynamic(id ? [id] : []);

  useEffect(() => {
    if (!id || !hydrated) return;
    setPlace(getPlaceSync(id));
  }, [id, hydrated, status, ver]);

  if (!id || (place === null && status !== "loading")) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <EmptyState page art="search" title="Это место не нашлось" text="Места рядом подгружаются по вашей точке выезда. Откройте главную — мы найдём их заново." action={{ href: "/", label: "На главную" }} />
      </main>
    );
  }
  if (!place) return <main className="min-h-dvh" aria-busy />;

  const cat = categoryDef(place.category);
  return (
    <main className="pb-32">
      <HeroGallery photos={place.photos} tint={place.tint} emoji={place.emoji} rating={place.rating} count={place.review_count} favoriteSlug={place.slug} shareTitle={place.title} />
      <article className="px-4">
        <header className="pt-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold" style={{ background: cat.bg, color: cat.fg }}>
              <cat.Icon width={14} height={14} /> {cat.name}
            </span>
          </div>
          <h1 className="tight mt-2.5 text-[31px] font-[850] leading-[1.08]">{place.title}</h1>
          <p className="mt-1 text-[18px] text-[#6b6f7c]">{place.subtitle}</p>
        </header>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {place.tags.map((t, i) => (
            <TagChip key={t} index={i}>
              {t}
            </TagChip>
          ))}
        </div>

        <PlaceIntentRow slug={place.slug} title={place.title} subtitle={place.subtitle} photo={place.photos[0]} tint={place.tint} emoji={place.emoji} />

        <div className="mt-5 flex gap-2.5 rounded-[18px] bg-yellow-50 p-3.5 text-[13.5px] leading-snug text-ink-2">
          <Info size={18} className="mt-0.5 shrink-0 text-[#d79a00]" />
          <p>
            Мы нашли это место рядом с вами. Часы работы и цены лучше уточнить перед выездом.
          </p>
        </div>

        <div className="mt-6">
          <ReadMore text={place.description} />
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[22px] bg-fill-2 py-3 pl-3.5 pr-3 ring-1 ring-line">
          <MapPin size={28} strokeWidth={2} className="shrink-0 text-green" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15.5px] font-semibold leading-tight">{place.address}</p>
            <p className="mt-0.5 truncate text-[13.5px] text-muted">
              <TravelBadge place={place} long className="text-[13.5px]" />
            </p>
          </div>
          <a
            href={routeUrl(place.latitude, place.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3.5 text-[14.5px] font-semibold text-blue"
          >
            <Navigation size={15} /> Как добраться
          </a>
        </div>

        <p className="mt-8 text-center text-[12px] text-muted">
          © участники OpenStreetMap ·{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            лицензия ODbL
          </a>
        </p>
      </article>
      <PlaceCTA slug={place.slug} title={place.title} lat={place.latitude} lng={place.longitude} />
    </main>
  );
}
