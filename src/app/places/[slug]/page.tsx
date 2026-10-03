import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Navigation, CalendarDays } from "lucide-react";
import { repo } from "@/lib/data/repository";
import { allPlaces } from "@/lib/data/repository";
import { HeroGallery, PhotoGallery } from "@/components/place/PhotoGallery";
import { InfoGrid } from "@/components/place/InfoGrid";
import { ParentInfo } from "@/components/place/ParentInfo";
import { WhatNext } from "@/components/place/WhatNext";
import { PlaceCTA } from "@/components/place/PlaceCTA";
import { routeUrl } from "@/lib/route-url";
import { OpenStatus } from "@/components/place/OpenStatus";
import { ReadMore } from "@/components/place/ReadMore";
import { Reviews } from "@/components/place/Reviews";
import { TagChip } from "@/components/ui/badges";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { adventureCardData } from "@/lib/cards";
import { ToastHost } from "@/components/ui/Toast";
import { whatNextGroups } from "@/lib/what-next";
import { TravelBadge } from "@/components/ui/TravelBadge";
import { categoryDef } from "@/lib/catalog";
import { formatAgeRange, formatPrice } from "@/lib/format";

export function generateStaticParams() {
  return allPlaces.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/places/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const place = await repo.getPlace(slug);
  if (!place) return {};
  const description = `${place.subtitle}. ${formatAgeRange(place.age_min, place.age_max)}, ${place.address}. ${place.description.slice(0, 120)}…`;
  return {
    title: `${place.title} — ${place.subtitle.toLowerCase()}`,
    description,
    alternates: { canonical: `/places/${place.slug}` },
    openGraph: {
      title: `${place.title} · КидГоу`,
      description,
      images: [{ url: `${place.photos[0].src}?w=1200&h=630&fit=crop&q=75`, width: 1200, height: 630, alt: place.photos[0].alt }],
    },
  };
}

export default async function PlacePage({ params }: PageProps<"/places/[slug]">) {
  const { slug } = await params;
  const place = await repo.getPlace(slug);
  if (!place) notFound();

  const [nearby, adventures, events] = await Promise.all([repo.nearby(place, { limit: 8 }), repo.listAdventures(), repo.listEvents()]);
  const groups = whatNextGroups(place);
  const inAdventures = adventures.filter((a) => a.steps.some((s) => s.place_id === place.id));
  const placeEvents = events.filter((e) => e.place_id === place.id);
  const cat = categoryDef(place.category);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": place.category === "cafe" ? "Restaurant" : place.category === "shop" ? "Store" : place.category === "museum" ? "Museum" : "TouristAttraction",
    name: place.title,
    description: place.description,
    image: place.photos.map((p) => p.src),
    address: { "@type": "PostalAddress", streetAddress: place.address, addressLocality: "Москва", addressCountry: "RU" },
    geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude },
    aggregateRating: { "@type": "AggregateRating", ratingValue: place.rating, reviewCount: place.review_count },
    isAccessibleForFree: place.price_max === 0,
    priceRange: place.price_max === 0 ? "Бесплатно" : `${formatPrice(place.price_min)}–${formatPrice(place.price_max)}`,
  };

  return (
    <main className="pb-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HeroGallery
        photos={place.photos}
        tint={place.tint}
        emoji={place.emoji}
        rating={place.rating}
        count={place.review_count}
        favoriteSlug={place.slug}
        shareTitle={place.title}
      />

      <article className="px-4">
        <header className="pt-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold" style={{ background: cat.bg, color: cat.fg }}>
              <cat.Icon width={14} height={14} /> {cat.name}
            </span>
            <OpenStatus hours={place.opening_hours} />
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

        <div className="mt-6">
          <InfoGrid place={place} />
        </div>

        <div className="mt-6">
          <ReadMore text={place.description} />
        </div>

        {place.photos.length > 1 && (
          <div className="mt-5">
            <PhotoGallery photos={place.photos} tint={place.tint} emoji={place.emoji} />
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-[22px] bg-fill-2 py-3 pl-3.5 pr-3 ring-1 ring-line">
          <MapPin size={28} strokeWidth={2} className="shrink-0 text-green" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15.5px] font-semibold leading-tight">{place.address}</p>
            <p className="mt-0.5 truncate text-[13.5px] text-muted">
              <TravelBadge place={place} long className="text-[13.5px]" />{place.metro ? ` · м. ${place.metro}` : ""}
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

        {placeEvents.length > 0 && (
          <section className="mt-8">
            <h2 className="tight text-[22px] font-[800]">Скоро здесь</h2>
            <ul className="mt-3 space-y-2">
              {placeEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-[18px] bg-yellow-50 p-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white text-yellow">
                    <CalendarDays size={22} className="text-[#d79a00]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">{e.title}</p>
                    <p className="text-[13px] text-ink-2">
                      {e.start_at.slice(11, 16)}–{e.end_at.slice(11, 16)} · {e.price ? formatPrice(e.price) : "бесплатно"} · {formatAgeRange(e.age_min, e.age_max)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="tight text-[24px] font-[800]">Для родителей</h2>
          <p className="mt-0.5 text-[14px] text-muted">Всё, что важно знать заранее</p>
          <div className="mt-3.5">
            <ParentInfo place={place} />
          </div>
        </section>

        {groups.length > 0 && (
          <section className="mt-9">
            <h2 className="tight text-[24px] font-[800]">Что сделать после?</h2>
            <p className="mt-0.5 text-[14px] text-muted">Соберём продолжение дня рядом</p>
            <div className="mt-3.5">
              <WhatNext currentSlug={place.slug} groups={groups} />
            </div>
          </section>
        )}

        {inAdventures.length > 0 && (
          <section className="mt-9">
            <h2 className="tight text-[24px] font-[800]">Есть в приключениях</h2>
            <div className="mt-3.5 space-y-3">
              {inAdventures.map((a) => (
                <AdventureCard key={a.id} data={adventureCardData(a)} variant="full" />
              ))}
            </div>
          </section>
        )}

        <section className="mt-9">
          <h2 className="tight text-[24px] font-[800]">Отзывы родителей</h2>
          <div className="mt-3.5">
            <Reviews place={place} />
          </div>
        </section>
      </article>

      {nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="tight px-4 text-[24px] font-[800]">Рядом ещё</h2>
          <div className="mt-2">
            <PlaceCarousel places={nearby} />
          </div>
        </section>
      )}

      <PlaceCTA slug={place.slug} title={place.title} lat={place.latitude} lng={place.longitude} />
      <ToastHost bottom={96} />
    </main>
  );
}
