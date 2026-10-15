import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, CONTACT_EMAIL } from "@/components/legal/LegalPage";
import { places } from "@/lib/data/places";
import { plural } from "@/lib/format";
import { PARTNER_PHOTOS, REAL_PHOTOS, commonsPageUrl, licenseUrl } from "@/lib/data/place-photos";

export const metadata: Metadata = { title: "Авторы фото", description: "Кто снял фотографии мест в Kids Go и на каких условиях они опубликованы.", alternates: { canonical: "/photo-credits" } };

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const link = "font-semibold text-pink-ink underline";

export default function PhotoCreditsPage() {
  const rows = places.filter((p) => REAL_PHOTOS[p.slug]?.length);
  const total = rows.reduce((n, p) => n + REAL_PHOTOS[p.slug].length, 0);
  const own = places.filter((p) => PARTNER_PHOTOS[p.slug]?.photos.length);
  const ownTotal = own.reduce((n, p) => n + PARTNER_PHOTOS[p.slug].photos.length, 0);
  const snimkov = (n: number) => `${n} ${plural(n, "снимок", "снимка", "снимков")}`;
  const counts = `Из Commons — ${snimkov(total)}, ${rows.length} ${plural(rows.length, "место", "места", "мест")}` + (own.length ? `; от самих мест — ${snimkov(ownTotal)}, ${own.length} ${plural(own.length, "место", "места", "мест")}` : "") + ".";
  return (
    <LegalPage title="Авторы фото" updated="октябрь 2026">
      <p>
        Фотографии мест в Kids Go — настоящие снимки этих мест. Часть из них — из{" "}
        <a className={link} href="https://commons.wikimedia.org" {...ext}>
          Wikimedia Commons
        </a>
        , свободной медиатеки: их авторы разрешили использовать снимки на условиях лицензий Creative Commons. Остальные нам прислали сами места, с их согласия. Мы уменьшили и обрезали снимки, чтобы они быстро открывались на телефоне. {counts}
      </p>
      <p>
        Если вы автор снимка и не хотите, чтобы он был здесь, напишите на{" "}
        <a className={link} href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        : мы уберём его.
      </p>
      {own.map((p) => {
        const set = PARTNER_PHOTOS[p.slug];
        return (
          <section key={`own-${p.slug}`}>
            <h2>
              <Link href={`/places/${p.slug}/`}>{p.title}</Link>
            </h2>
            <ul>
              <li>
                <a className={link} href={set.url} {...ext}>
                  {set.author}
                </a>
                : {snimkov(set.photos.length)}, {set.note}
              </li>
            </ul>
          </section>
        );
      })}
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
