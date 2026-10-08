import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, UtensilsCrossed } from "lucide-react";
import { repo } from "@/lib/data/repository";
import { allPlaces } from "@/lib/data/repository";
import { HeroGallery, PhotoGallery } from "@/components/place/PhotoGallery";
import { InfoGrid } from "@/components/place/InfoGrid";
import { ParentInfo } from "@/components/place/ParentInfo";
import { WhatNext } from "@/components/place/WhatNext";
import { PlaceCTA, PlaceIntentRow } from "@/components/place/PlaceCTA";
import { AddressCard } from "@/components/place/AddressCard";
import { OpenStatus } from "@/components/place/OpenStatus";
import { ReadMore } from "@/components/place/ReadMore";
import { Reviews } from "@/components/place/Reviews";
import { TagChip } from "@/components/ui/badges";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { adventureCardData } from "@/lib/cards";
import { nextGroupMap, whatNextGroups } from "@/lib/what-next";
import { AroundLink } from "@/components/place/AroundLink";
import { isOutside } from "@/lib/outside";
import { categoryDef, placeTypeName } from "@/lib/catalog";
import { formatAgeRange, formatPrice } from "@/lib/format";
import { ogImageUrl } from "@/lib/image-loader";

type PlacePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPlaces.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  const place = await repo.getPlace(slug);
  if (!place) return {};
  const addressVerified = place.verified_fields?.includes("address") ?? false;
  const description = `${place.subtitle}. ${formatAgeRange(place.age_min, place.age_max)}${addressVerified ? `, ${place.address}` : ""}. ${place.description.slice(0, 120)}…`;
  return {
    title: `${place.title} — ${place.subtitle.toLowerCase()}`,
    description,
    alternates: { canonical: `/places/${place.slug}` },
    openGraph: {
      title: `${place.title} · Kids Go`,
      description,
      images: [{ url: ogImageUrl(place.photos[0].src), width: 1200, height: 630, alt: place.photos[0].alt }],
    },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;
  const place = await repo.getPlace(slug);
  if (!place) notFound();

  const [nearby, adventures, events] = await Promise.all([repo.nearby(place, { limit: 8 }), repo.listAdventures(), repo.listEvents()]);
  const groups = whatNextGroups(place);
  const inAdventures = adventures.filter((a) => a.steps.some((s) => s.place_id === place.id));
  const placeEvents = events.filter((e) => e.place_id === place.id);
  const cat = categoryDef(place.category);
  const typeLabel = placeTypeName(place.place_type) ?? cat.name;
  const verified = new Set(place.verified_fields ?? []);
  const addressVerified = verified.has("address");
  const priceVerified = verified.has("price");
  const hoursVerified = verified.has("opening_hours");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": place.category === "cafe" ? "Restaurant" : place.category === "shop" ? "Store" : place.category === "museum" ? "Museum" : "TouristAttraction",
    name: place.title,
    description: place.description,
    image: place.photos.map((p) => p.src),
    ...(addressVerified
      ? {
          address: { "@type": "PostalAddress", streetAddress: place.address, addressLocality: place.region === "mo" ? place.town ?? "Московская область" : "Москва", addressCountry: "RU" },
          geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude },
        }
      : {}),
    ...(place.review_count > 0 && place.rating_source ? { aggregateRating: { "@type": "AggregateRating", ratingValue: place.rating, reviewCount: place.review_count } } : {}),
    ...(priceVerified
      ? {
          isAccessibleForFree: place.price_max === 0,
          priceRange: place.price_max === 0 ? "Бесплатно" : `${formatPrice(place.price_min)}–${formatPrice(place.price_max)}`,
        }
      : {}),
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold" style={{ background: cat.bg, color: cat.ink }}>
              <cat.Icon width={14} height={14} /> {typeLabel}
            </span>
            {hoursVerified && <OpenStatus hours={place.opening_hours} />}
          </div>
          <h1 className="tight mt-2.5 text-[30px] font-[850] leading-[1.08]">{place.title}</h1>
          <p className="mt-1 text-[18px] text-muted">{place.subtitle}</p>
        </header>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {place.tags.map((t, i) => (
            <TagChip key={t} index={i}>
              {t}
            </TagChip>
          ))}
        </div>

        <PlaceIntentRow slug={place.slug} title={place.title} subtitle={place.subtitle} photo={place.photos[0]} tint={place.tint} emoji={place.emoji} />

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

        {addressVerified && <AddressCard place={place} />}

        {place.menu_url && (
          <a
            href={place.menu_url}
            target="_blank"
            rel="noreferrer"
            className="press mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-orange-50 px-4 text-[15px] font-semibold text-orange-ink"
          >
            <UtensilsCrossed size={16} />
            {place.category === "cafe" ? "Посмотреть меню" : "Где поесть / меню"}
          </a>
        )}

        {placeEvents.length > 0 && (
          <section className="mt-8">
            <h2 className="tight text-[22px] font-[800]">Ближайшие события</h2>
            <ul className="mt-3 space-y-2">
              {placeEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-[20px] bg-yellow-50 p-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-white text-yellow-ink">
                    <CalendarDays size={24} className="text-[#d79a00]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">{e.title}</p>
                    <p className="text-[13px] text-ink-2">
                      {new Date(e.start_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" })} · {e.start_at.slice(11, 16)}–{e.end_at.slice(11, 16)} · {e.price ? formatPrice(e.price) : "бесплатно"} · {formatAgeRange(e.age_min, e.age_max)}
                    </p>
                    {e.source && (
                      <a href={e.source} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[12px] font-semibold text-muted underline underline-offset-2">
                        Подробнее о программе
                      </a>
                    )}
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

        <section className="mt-9" aria-labelledby="what-next-title">
          <h2 id="what-next-title" className="tight text-[24px] font-[800]">Что потом?</h2>
          <p className="mt-0.5 text-[14px] text-muted">Логичное продолжение дня рядом — добавьте в один тап</p>
          {groups.length > 0 ? (
            <div className="mt-3.5">
              <WhatNext currentSlug={place.slug} groups={groups} groupOf={nextGroupMap()} />
            </div>
          ) : (
            <p className="mt-3 rounded-[20px] bg-surface p-3.5 text-[14px] leading-snug text-muted shadow-card">
              {isOutside(place) ? "Рядом мы пока ничего не советуем — возьмите перекус с собой или соберите день целиком: подберём дорогу и порядок." : "Рядом пока нет подходящих продолжений — соберите день целиком."}
            </p>
          )}
          {groups.length > 0 && isOutside(place) && !groups.some((g) => g.id === "eat") && (
            <p className="mt-2 px-1 text-[13px] leading-snug text-muted">🥪 Кафе рядом мы пока не знаем — возьмите перекус с собой.</p>
          )}
          <AroundLink slug={place.slug} from="place" className="mt-3.5" />
        </section>

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

        {((place.rating > 0 && !!place.rating_source) || place.reviews.length > 0) && (
          <section className="mt-9">
            <h2 className="tight text-[24px] font-[800]">Отзывы</h2>
            <div className="mt-3.5">
              <Reviews place={place} />
            </div>
          </section>
        )}
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
    </main>
  );
}
