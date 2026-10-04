import type { Place } from "@/lib/types";

/** Ссылка на карточку места. Динамические (OpenStreetMap) места не предгенерируются — у них свой клиентский экран. */
export const placeHref = (p: Pick<Place, "slug">) => (p.slug.startsWith("osm-") ? `/nearby?id=${encodeURIComponent(p.slug)}` : `/places/${p.slug}`);
