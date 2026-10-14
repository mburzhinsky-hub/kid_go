import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { LandingRow } from "@/components/landing/LandingRow";
import { LANDINGS_HUB, landingBySlug, landingHref, placesOfLanding, publishedLandings } from "@/lib/landings";
import { scenarioById, scenarioHref } from "@/lib/scenarios";
import { plural } from "@/lib/format";
import { ogImageUrl } from "@/lib/image-loader";

type LandingPageProps = { params: Promise<{ slug: string }> };

// Страницы только из списка: подборка, где мест меньше минимума, не публикуется (404), а не выходит пустышкой.
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedLandings().map((l) => ({ slug: l.slug }));
}

const resolve = (slug: string) => {
  const l = landingBySlug(slug);
  if (!l) return null;
  const list = placesOfLanding(l);
  return list.length >= l.min ? { l, list } : null;
};

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const r = resolve(slug);
  if (!r) return {};
  const { l, list } = r;
  const cover = list.find((p) => p.photos[0]?.src && ["commons", "official", "partner"].includes(p.photos[0].kind ?? ""))?.photos[0];
  return {
    title: l.title,
    description: l.description,
    alternates: { canonical: landingHref(l) },
    openGraph: {
      type: "website",
      title: l.h1,
      description: l.description,
      url: landingHref(l),
      images: [{ url: ogImageUrl(cover?.src ?? ""), width: 1200, height: 630, alt: cover?.alt ?? l.h1 }],
    },
  };
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params;
  const r = resolve(slug);
  if (!r) notFound();
  const { l, list } = r;

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kids-go.fun";
  const published = new Map(publishedLandings().map((x) => [x.slug, x]));
  const related = l.related.map((s) => published.get(s)).filter((x): x is NonNullable<typeof x> => !!x);
  const scenario = l.scenario ? scenarioById(l.scenario) : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "Куда сходить", item: `${site}${LANDINGS_HUB}` },
          { "@type": "ListItem", position: 3, name: l.h1, item: `${site}${landingHref(l)}` },
        ],
      },
      {
        "@type": "ItemList",
        name: l.h1,
        url: `${site}${landingHref(l)}`,
        numberOfItems: list.length,
        itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.title, url: `${site}/places/${p.slug}/` })),
      },
    ],
  };

  return (
    <main className="pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback={LANDINGS_HUB} />
        <nav aria-label="Навигация" className="min-w-0 truncate text-[14px] text-muted">
          <Link href="/" className="underline-offset-2 hover:underline">Главная</Link> · <Link href={LANDINGS_HUB} className="underline-offset-2 hover:underline">Куда сходить</Link>
        </nav>
      </header>

      <article>
        <section className="px-4">
          <h1 className="tight text-[30px] font-[850] leading-[1.08]">{l.h1}</h1>
          <p className="mt-3 text-[16px] leading-[1.5] text-ink-2">{l.lead}</p>
          <p className="mt-3 text-[13px] leading-snug text-muted">
            {list.length} {plural(list.length, "место", "места", "мест")}. {l.how} Выше те места, которые лучше подходят под запрос и у которых мы сверили часы или цены с официальным сайтом.
          </p>
        </section>

        <ol className="mt-5 space-y-3 px-4" aria-label={l.h1}>
          {list.map((p) => (
            <li key={p.slug}>
              <LandingRow place={p} trip={l.trip} />
            </li>
          ))}
        </ol>

        <section className="mt-8 px-4">
          <h2 className="tight text-[22px] font-[800]">На что обратить внимание</h2>
          <ul className="mt-3 space-y-2.5">
            {l.tips.map((t) => (
              <li key={t} className="flex gap-2.5 text-[15px] leading-[1.45] text-ink-2">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-2" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {scenario && (
          <section className="mt-8 px-4">
            <Link href={scenarioHref(scenario)} className="press flex items-center justify-between gap-3 rounded-[20px] bg-pink-50 px-4 py-4 text-[16px] font-semibold text-pink-ink">
              <span>Собрать день из этих мест: время, дорога и бюджет</span>
              <ArrowRight size={20} strokeWidth={2} className="shrink-0" />
            </Link>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="tight px-4 text-[22px] font-[800]">Другие подборки</h2>
            <ul className="mt-3 space-y-2 px-4">
              {related.map((x) => (
                <li key={x.slug}>
                  <Link href={landingHref(x)} className="press flex items-center justify-between gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-[16px] font-semibold shadow-card">
                    <span>{x.h1}</span>
                    <ArrowRight size={18} strokeWidth={2} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 px-4 text-[14px]">
              <Link href={LANDINGS_HUB} className="font-medium text-blue-ink underline underline-offset-2">Все подборки</Link>
              {" · "}
              <Link href="/scenarios/" className="font-medium text-blue-ink underline underline-offset-2">Ситуации</Link>
              {" · "}
              <Link href="/adventures/" className="font-medium text-blue-ink underline underline-offset-2">Готовые приключения</Link>
            </p>
          </section>
        )}

        <p className="mx-4 mt-8 rounded-[16px] bg-surface p-3.5 text-[13px] leading-snug text-muted shadow-card">
          Часы и цены показаны только там, где мы сверили их с официальным сайтом места. Для остальных откройте карточку и проверьте информацию на сайте перед выездом: режим и цены меняются.
        </p>
      </article>
    </main>
  );
}
