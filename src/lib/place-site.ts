import type { Place } from "@/lib/types";

/**
 * Источники, которые НЕ являются сайтом самого места: энциклопедии, карты, соцсети, агрегаторы и городские порталы.
 * Для остальных `place.source` — собственный сайт места или его учредителя, на него и ведём кнопку «Сайт места».
 */
const NOT_OFFICIAL = [
  "wikipedia.org",
  "2gis.ru",
  "yandex.ru",
  "yandex.com",
  "vk.com",
  "kp.ru",
  "putevka.com",
  "russpass.ru",
  "welcome.mosreg.ru",
  "odinparki.ru",
  "um.mos.ru",
  "walking.sport.mos.ru",
  "afisha.ru",
  "kudago.com",
  "tripadvisor.ru",
  "google.com",
];

export function officialSite(place: Pick<Place, "source">): { url: string; host: string } | null {
  if (!place.source) return null;
  try {
    const u = new URL(place.source);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.replace(/^www\./, "");
    if (NOT_OFFICIAL.some((d) => host === d || host.endsWith("." + d))) return null;
    return { url: u.href, host };
  } catch {
    return null;
  }
}
