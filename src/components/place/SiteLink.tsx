"use client";

import { ExternalLink } from "lucide-react";
import type { Place } from "@/lib/types";
import { officialSite } from "@/lib/place-site";
import { track } from "@/lib/analytics";

/** «Сайт места» — ссылка на собственный сайт места (если он известен). Переходы считаем: это то, что мы можем показать самому месту. */
export function SiteLink({ place }: { place: Pick<Place, "slug" | "source"> }) {
  const site = officialSite(place);
  if (!site) return null;
  // кириллические домены приходят в punycode (xn--…): их не показываем, чтобы не пугать
  const shown = site.host.includes("xn--") ? "" : ` · ${site.host}`;
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener"
      onClick={() => track("place_site_click", { slug: place.slug, host: site.host })}
      className="press mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-fill px-4 text-[15px] font-semibold text-ink-2"
    >
      <ExternalLink size={16} /> Сайт места{shown}
    </a>
  );
}
