/**
 * Фото, которые прислали сами места (kind «partner»). Свои копии лежат в репозитории: public/partner/<id>-480|960|1440.webp
 * и <id>-og.jpg (их делает scripts/add-partner-photo.mjs). Адрес снимка в данных: /partner/<id>, где id = pt-<хеш имени файла>.
 */
export const PARTNER_PREFIX = "/partner/";

export const partnerSrc = (id: string) => `${PARTNER_PREFIX}${id}`;

export function partnerId(src: string): string | null {
  if (!src.startsWith(PARTNER_PREFIX)) return null;
  const id = src.slice(PARTNER_PREFIX.length);
  return /^pt-[0-9a-f]{10}$/.test(id) ? id : null;
}
