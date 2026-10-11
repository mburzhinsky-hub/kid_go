/**
 * Фото из Wikimedia Commons. Адрес снимка в данных: https://commons.wikimedia.org/wiki/Special:FilePath/<файл>?lid=<id>,
 * где lid — короткий id своей копии на хостинге (public/photos/<lid>-480|960|1440.webp, -og.jpg; их делает scripts/fetch-photos.mjs).
 * Без своей копии (разработка, запасной режим) снимок берётся с Commons по стандартным размерам миниатюр.
 */
export const COMMONS_PREFIX = "https://commons.wikimedia.org/wiki/Special:FilePath/";

export function commonsInfo(src: string): { file: string; id: string } | null {
  if (!src.startsWith(COMMONS_PREFIX)) return null;
  const [file, q = ""] = src.slice(COMMONS_PREFIX.length).split("?");
  const id = new URLSearchParams(q).get("lid");
  return id ? { file, id } : null;
}

/** Стандартные ширины миниатюр Wikimedia: другие размеры сервер не обязан отдавать. */
const STD = [330, 500, 960, 1280, 1920];
export const commonsThumb = (file: string, width: number) => `${COMMONS_PREFIX}${file}?width=${STD.find((w) => w >= width) ?? 1920}`;
