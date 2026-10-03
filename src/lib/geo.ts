import type { GeoPoint, TransportId } from "@/lib/types";

/** Центр Москвы — точка по умолчанию, если геолокация недоступна. */
export const DEFAULT_LOCATION: GeoPoint = { lat: 55.7579, lng: 37.6156 };

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const pt = (p: { latitude: number; longitude: number }): GeoPoint => ({
  lat: p.latitude,
  lng: p.longitude,
});

/**
 * Оценка времени в пути (MVP без routing API).
 * Коэффициент 1.3 — поправка на реальную уличную сеть.
 */
export function travelMinutes(km: number, mode: TransportId): number {
  const road = km * 1.3;
  if (mode === "walk") return Math.max(2, Math.round((road / 4.3) * 60));
  if (mode === "car") return Math.max(6, Math.round((road / 25) * 60 + 6)); // + парковка
  // метро + наземный: ~30 км/ч по сети и 10 минут на дойти/подождать/пересесть
  return Math.max(10, Math.round((road / 32) * 60 + 10));
}

/** Пешком — если близко; иначе — выбранный транспорт. */
export function legMode(km: number, preferred: TransportId): TransportId {
  if (km <= 1.6) return "walk";
  return preferred === "walk" ? "transit" : preferred;
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 50) * 50)} м`;
  return `${km.toFixed(1).replace(".0", "")} км`;
}

export function distanceFromUser(p: { latitude: number; longitude: number }, user: GeoPoint = DEFAULT_LOCATION) {
  return haversineKm(user, pt(p));
}
