import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionScreen } from "@/components/social/CollectionScreen";
import { SEED_CREATORS } from "@/lib/social/seed";
import { seedCollection, seedCollectionsOf, coverOf, placesOf, placesWord } from "@/lib/social/catalog";
import { formatAgeRange } from "@/lib/format";
import { placeHref } from "@/lib/place-href";
import { ogImageUrl } from "@/lib/image-loader";

/** Публичная страница подборки: /@username/slug. Публичные подборки индексируются, «по ссылке» — нет. */
type CollectionPageProps = { params: Promise<{ handle: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEED_CREATORS.filter((c) => c.status === "APPROVED").flatMap((c) => seedCollectionsOf(c).map((r) => ({ handle: `@${c.username}`, slug: r.collection.slug })));
}

const resolve = (handle: string, slug: string) => {
  let h = handle;
  try {
    h = decodeURIComponent(handle);
  } catch {
    /* как есть */
  }
  return h.startsWith("@") ? seedCollection(h, slug) : null;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { handle, slug } = await params;
  const r = resolve(handle, slug);
  if (!r) return {};
  const { placed } = placesOf(r.collection);
  const art = coverOf(r.collection, placed);
  const photo = art.kind === "photo" ? art.tile.photo : art.tiles[0].photo;
  const description = `${placesWord(placed.length)} для детей ${formatAgeRange(r.collection.age_min, r.collection.age_max)} · Автор: ${r.author.name}`;
  const indexable = r.collection.visibility === "PUBLIC" && r.collection.status === "PUBLISHED";
  return {
    title: `${r.collection.title} — ${r.author.name}`,
    description: r.collection.description ? `${description}. ${r.collection.description}`.slice(0, 200) : description,
    alternates: { canonical: `/@${r.author.username}/${r.collection.slug}/` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: `${r.collection.title} — ${r.author.name}`,
      description,
      ...(photo.src ? { images: [{ url: ogImageUrl(photo.src), width: 1200, height: 630, alt: photo.alt }] } : {}),
    },
    twitter: { card: "summary_large_image", title: r.collection.title, description },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { handle, slug } = await params;
  const r = resolve(handle, slug);
  if (!r) notFound();
  const { placed } = placesOf(r.collection);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: r.collection.title,
    description: r.collection.description,
    author: { "@type": "Person", name: r.author.name },
    numberOfItems: placed.length,
    itemListElement: placed.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.place.title, url: placeHref(x.place) })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CollectionScreen resolved={r} />
    </>
  );
}
