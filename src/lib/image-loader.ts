/**
 * Loader для next/image: ресайз и формат (AVIF/WebP) делает CDN,
 * а не сервер Next.js — быстрее на мобильном интернете и дешевле в проде.
 * NEXT_PUBLIC_IMAGE_PROXY — для локальных тестов/офлайн-стендов (подмена CDN).
 */
import { commonsInfo, commonsThumb } from "./commons";

const PROXY = process.env.NEXT_PUBLIC_IMAGE_PROXY;
const LOCAL = process.env.NEXT_PUBLIC_PHOTOS_LOCAL === "1";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (PROXY) return `${PROXY}/img?w=${width}&src=${encodeURIComponent(src)}`;
  const cm = commonsInfo(src);
  if (cm) {
    if (!LOCAL) return commonsThumb(cm.file, width);
    return `${BASE}/photos/${cm.id}-${width <= 480 ? 480 : width <= 960 ? 960 : 1440}.webp`;
  }
  if (LOCAL && src.startsWith("https://images.unsplash.com/")) {
    // Собственные копии (их кладёт scripts/fetch-photos.mjs): три размера, берём ближайший не меньше нужного.
    const id = src.slice("https://images.unsplash.com/".length).split("?")[0];
    const w = width <= 480 ? 480 : width <= 960 ? 960 : 1440;
    return `${BASE}/photos/${id}-${w}.webp`;
  }
  if (src.startsWith("https://images.unsplash.com/")) {
    const q = quality ?? 70;
    return `${src}?w=${width}&q=${q}&auto=format&fit=crop&cs=tinysrgb`;
  }
  return src;
}

/** Картинка для превью ссылки (1200×630): своя JPEG-копия, если фото хранятся на сайте, иначе оригинал. */
export function ogImageUrl(src: string): string {
  if (!src) return `${BASE}/og.jpg`; // у места нет фото: общая картинка сайта
  const cm = commonsInfo(src);
  if (cm) return LOCAL ? `${BASE}/photos/${cm.id}-og.jpg` : commonsThumb(cm.file, 1280);
  if (LOCAL && src.startsWith("https://images.unsplash.com/")) {
    const id = src.slice("https://images.unsplash.com/".length).split("?")[0];
    return `${BASE}/photos/${id}-og.jpg`;
  }
  return `${src}?w=1200&h=630&fit=crop&q=75`;
}

/** Абсолютный адрес снимка для разметки schema.org. Пустой src (у места нет фото) — undefined. */
export function schemaImageUrl(src: string, site: string): string | undefined {
  if (!src) return undefined;
  const cm = commonsInfo(src);
  if (cm) return LOCAL ? `${site}${BASE}/photos/${cm.id}-1440.webp` : commonsThumb(cm.file, 1280);
  return src;
}
