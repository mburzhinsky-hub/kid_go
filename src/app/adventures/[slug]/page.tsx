import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repo, allAdventures, adventurePlaces } from "@/lib/data/repository";
import { AdventureView } from "@/components/adventure/AdventureView";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { adventureCardData } from "@/lib/cards";
import { formatAgeRange, formatDuration, formatBudget } from "@/lib/format";

export function generateStaticParams() {
  return allAdventures.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/adventures/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await repo.getAdventure(slug);
  if (!a) return {};
  const description = `${a.tagline}. ${formatAgeRange(a.age_min, a.age_max)}, ${formatDuration(a.estimated_duration)}, ${formatBudget(a.estimated_budget)} на семью.`;
  return {
    title: `${a.title} — готовый маршрут с детьми`,
    description,
    alternates: { canonical: `/adventures/${a.slug}` },
    openGraph: {
      title: `${a.emoji} ${a.title} · КидГоу`,
      description,
      images: [{ url: `${a.cover_image.src}?w=1200&h=630&fit=crop&q=75`, width: 1200, height: 630, alt: a.cover_image.alt }],
    },
  };
}

export default async function AdventurePage({ params }: PageProps<"/adventures/[slug]">) {
  const { slug } = await params;
  const a = await repo.getAdventure(slug);
  if (!a) notFound();
  const places = adventurePlaces(a);
  const all = await repo.listAdventures();
  const similar = all
    .filter((x) => x.id !== a.id)
    .map((x) => ({ x, s: x.moods.filter((m) => a.moods.includes(m)).length + x.interest_tags.filter((i) => a.interest_tags.includes(i)).length }))
    .sort((p, q) => q.s - p.s)
    .map((p) => p.x);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: a.title,
    description: a.description,
    image: a.cover_image.src,
    touristType: "Семьи с детьми",
    itinerary: {
      "@type": "ItemList",
      itemListElement: places.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Place", name: p.title, address: p.address, url: `/places/${p.slug}` },
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AdventureView
        planKey={a.slug}
        title={a.title}
        tagline={a.tagline}
        description={a.description}
        cover={a.cover_image}
        emoji={a.emoji}
        tint={a.tint}
        start={a.start_time}
        ageOverride={[a.age_min, a.age_max]}
        recommend={a.recommend_percent}
        stops={a.steps.map((s, i) => ({
          place: places[i],
          duration: s.recommended_duration,
          note: s.note,
          travelOverride: s.travel_time_to_next,
        }))}
        alternativeHref={`/adventures/${similar[0].slug}`}
      >

          <section className="mt-9">
            <h2 className="tight text-[24px] font-[800]">Похожие приключения</h2>
            <div className="no-scrollbar snap-x-pad -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
              {similar.slice(0, 4).map((x) => (
                <div key={x.id} className="shrink-0 snap-start">
                  <AdventureCard data={adventureCardData(x)} />
                </div>
              ))}
            </div>
          </section>
      </AdventureView>
    </>
  );
}
