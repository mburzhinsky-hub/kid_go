/**
 * Loader для next/image: ресайз и формат (AVIF/WebP) делает CDN,
 * а не сервер Next.js — быстрее на мобильном интернете и дешевле в проде.
 * NEXT_PUBLIC_IMAGE_PROXY — для локальных тестов/офлайн-стендов (подмена CDN).
 */
const PROXY = process.env.NEXT_PUBLIC_IMAGE_PROXY;

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (PROXY) return `${PROXY}/img?w=${width}&src=${encodeURIComponent(src)}`;
  if (src.startsWith("https://images.unsplash.com/")) {
    const q = quality ?? 70;
    return `${src}?w=${width}&q=${q}&auto=format&fit=crop&cs=tinysrgb`;
  }
  return src;
}
