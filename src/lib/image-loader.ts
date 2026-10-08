/**
 * Loader для next/image: ресайз и формат (AVIF/WebP) делает CDN,
 * а не сервер Next.js — быстрее на мобильном интернете и дешевле в проде.
 * NEXT_PUBLIC_IMAGE_PROXY — для локальных тестов/офлайн-стендов (подмена CDN).
 */
const PROXY = process.env.NEXT_PUBLIC_IMAGE_PROXY;
const LOCAL = process.env.NEXT_PUBLIC_PHOTOS_LOCAL === "1";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (PROXY) return `${PROXY}/img?w=${width}&src=${encodeURIComponent(src)}`;
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
