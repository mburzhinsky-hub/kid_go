import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { LANDINGS_HUB, landingHref, placesOfLanding, publishedLandings } from "@/lib/landings";
import { plural } from "@/lib/format";
import { ogImageUrl } from "@/lib/image-loader";

export const metadata: Metadata = {
  title: "Куда сходить с ребёнком в Москве: подборки",
  description: "Подборки мест Москвы и Подмосковья для детей: по возрасту, в дождь, музеи, парки, животные. Часы и цены — только проверенные на официальных сайтах.",
  alternates: { canonical: LANDINGS_HUB },
  openGraph: {
    type: "website",
    title: "Куда сходить с ребёнком: подборки",
    description: "Подборки мест Москвы и Подмосковья для детей: по возрасту, в дождь, музеи, парки, животные.",
    url: LANDINGS_HUB,
    images: [{ url: ogImageUrl(""), width: 1200, height: 630, alt: "Kids Go — куда пойти с детьми" }],
  },
};

export default function LandingsHub() {
  const list = publishedLandings();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kids-go.fun";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "Куда сходить", item: `${site}${LANDINGS_HUB}` },
        ],
      },
      {
        "@type": "ItemList",
        name: "Куда сходить с ребёнком: подборки",
        itemListElement: list.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.h1, url: `${site}${landingHref(l)}` })),
      },
    ],
  };
  return (
    <main className="pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback="/" />
      </header>
      <section className="px-4">
        <h1 className="tight text-[30px] font-[850] leading-[1.08]">Куда сходить с ребёнком</h1>
        <p className="mt-3 text-[16px] leading-[1.5] text-ink-2">
          Подборки мест Москвы и Подмосковья из каталога Kids Go: по возрасту ребёнка, погоде и поводу. Часы и цены мы показываем только там, где сверили их с официальным сайтом.
        </p>
      </section>
      <ul className="mt-5 space-y-3 px-4">
        {list.map((l) => {
          const n = placesOfLanding(l).length;
          return (
            <li key={l.slug}>
              <Link href={landingHref(l)} className="press block rounded-[20px] bg-surface p-4 shadow-card">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[18px] font-[750] leading-[1.2]">{l.h1}</span>
                  <ArrowRight size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-muted" />
                </span>
                <span className="mt-1.5 block text-[14px] leading-snug text-muted">{l.description}</span>
                <span className="mt-2 block text-[13px] font-semibold text-ink-2">
                  {n} {plural(n, "место", "места", "мест")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 px-4 text-[14px]">
        <Link href="/scenarios/" className="font-medium text-blue-ink underline underline-offset-2">Ситуации: если дождь, до сна, с бабушкой</Link>
        {" · "}
        <Link href="/adventures/" className="font-medium text-blue-ink underline underline-offset-2">Готовые приключения</Link>
      </p>
    </main>
  );
}
