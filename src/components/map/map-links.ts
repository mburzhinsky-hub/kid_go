import type { GeoPoint } from "@/lib/types";

/**
 * Запасная карта: виджет Яндекс Карт во фрейме и ссылка «открыть в Яндекс Картах».
 * Нужен, когда сервера тайлов OpenStreetMap/OpenFreeMap/CARTO недоступны (блокировки, слабая сеть):
 * виджет Яндекса открывается там, где иностранные тайлы — нет. Без ключа API.
 */
export interface Pin {
  lat: number;
  lng: number;
  /** Номер на метке (шаг маршрута). */
  n?: number;
}

const pts = (pins: Pin[]) =>
  pins
    .slice(0, 40)
    .map((p, i) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)},pm2rdm${p.n ?? (pins.length <= 9 ? i + 1 : "")}`)
    .join("~");

/** Масштаб, при котором рамка (в градусах долготы) целиком влезает в экран шириной ~480 px. */
export function zoomForSpan(spanLng: number): number {
  const z = Math.floor(Math.log2(675 / Math.max(spanLng * 1.5, 0.005)));
  return Math.max(8, Math.min(16, z));
}

export function frameOf(points: GeoPoint[]): { center: GeoPoint; zoom: number } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const span = Math.max(Math.max(...lngs) - Math.min(...lngs), (Math.max(...lats) - Math.min(...lats)) * 1.7);
  return { center, zoom: zoomForSpan(span) };
}

export function yandexWidgetUrl(center: GeoPoint, zoom: number, pins: Pin[] = []): string {
  const q = new URLSearchParams({ ll: `${center.lng.toFixed(5)},${center.lat.toFixed(5)}`, z: String(zoom), l: "map", lang: "ru_RU" });
  if (pins.length) q.set("pt", pts(pins));
  return `https://yandex.ru/map-widget/v1/?${q}`;
}

export function yandexMapsUrl(center: GeoPoint, zoom: number, pins: Pin[] = []): string {
  const q = new URLSearchParams({ ll: `${center.lng.toFixed(5)},${center.lat.toFixed(5)}`, z: String(zoom) });
  if (pins.length) q.set("pt", pts(pins));
  return `https://yandex.ru/maps/?${q}`;
}
