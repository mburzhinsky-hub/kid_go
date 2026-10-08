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
 * В городе — коэффициент 1.3 к прямой; за городом дороги прямее и быстрее
 * (шоссе), поэтому длинные поездки считаем отдельно.
 */
export function roadKm(km: number): number {
  return Math.min(km, 6) * 1.3 + Math.max(0, km - 6) * 1.2;
}

export function travelMinutes(km: number, mode: TransportId): number {
  const road = roadKm(km);
  if (mode === "walk") return Math.max(2, Math.round((road / 4.3) * 60));
  if (mode === "car") {
    // первые ~8 км — город (25 км/ч), дальше шоссе (55 км/ч) + парковка
    const city = Math.min(road, 8);
    const hw = Math.max(0, road - 8);
    return Math.max(6, Math.round((city / 25) * 60 + (hw / 55) * 60 + 6));
  }
  // метро + наземный ~30 км/ч и 10 минут на «дойти/подождать/пересесть»;
  // за городом — электричка/автобус: медленнее и ещё одна пересадка
  const city = Math.min(road, 12);
  const out = Math.max(0, road - 12);
  return Math.max(10, Math.round((city / 32) * 60 + (out / 38) * 60 + 10 + (road > 25 ? 12 : 0)));
}

/** Пешком — если близко; иначе — выбранный транспорт. */
export function legMode(km: number, preferred: TransportId): TransportId {
  if (km <= 1.6) return "walk";
  return preferred === "walk" ? "transit" : preferred;
}

export function formatKm(km: number): string {
  if (km < 1) {
    const m = Math.max(100, Math.round((km * 1000) / 50) * 50);
    // 0,98 км округляется до 1000 м — это уже «1 км»
    if (m < 1000) return `${m} м`;
    km = 1;
  }
  const r = Math.round(km * 10) / 10;
  return `${String(r).replace(".", ",")} км`;
}

export function distanceFromUser(p: { latitude: number; longitude: number }, user: GeoPoint = DEFAULT_LOCATION) {
  return haversineKm(user, pt(p));
}
