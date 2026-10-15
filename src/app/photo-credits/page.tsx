import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, CONTACT_EMAIL } from "@/components/legal/LegalPage";
import { places } from "@/lib/data/places";
import { REAL_PHOTOS, commonsPageUrl, licenseUrl } from "@/lib/data/place-photos";

export const metadata: Metadata = { title: "Авторы фото", description: "Кто снял фотографии мест в Kids Go и на каких условиях они опубликованы.", alternates: { canonical: "/photo-credits" } };

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const link = "font-semibold text-pink-ink underline";

export default function PhotoCreditsPage() {
  const rows = places.filter((p) => REAL_PHOTOS[p.slug]?.length);
  const total = rows.reduce((n, p) => n + REAL_PHOTOS[p.slug].length, 0);
  return (
    <LegalPage title="Авторы фото" updated="октябрь 2026">
      <p>
        Фотографии мест в Kids Go — настоящие снимки этих мест из{" "}
        <a className={link} href="https://commons.wikimedia.org" {...ext}>
          Wikimedia Commons
        </a>
        , свободной медиатеки. Их авторы разрешили использовать снимки на условиях лицензий Creative Commons. Мы уменьшили и обрезали снимки, чтобы они быстро открывались на телефоне. Всего {total} снимков, {rows.length} мест.
      </p>
      <p>
        Если вы автор снимка и не хотите, чтобы он был здесь, напишите на{" "}
        <a className={link} href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        : мы уберём его.
      </p>
      {rows.map((p) => (
        <section key={p.slug}>
          <h2>
            <Link href={`/places/${p.slug}/`}>{p.title}</Link>
          </h2>
          <ul>
            {REAL_PHOTOS[p.slug].map((ph, i) => {
              const lu = licenseUrl(ph.l);
              return (
                <li key={i}>
                  <a className={link} href={commonsPageUrl(ph.f)} {...ext}>
                    {ph.a}
                  </a>
                  ,{" "}
                  {lu ? (
                    <a className={link} href={lu} {...ext}>
                      {ph.l}
                    </a>
                  ) : ph.l === "Public domain" ? (
                    "общественное достояние"
                  ) : (
                    ph.l
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </LegalPage>
  );
}
