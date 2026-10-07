import type { TransportId } from "@/lib/types";

/** Режим маршрута в Яндекс Картах: общественный транспорт, машина, пешком. */
const RTT: Record<TransportId, string> = { transit: "mt", car: "auto", walk: "pd" };

/** Маршрут в Яндекс Картах до одного места — тем способом, которым семья едет. Без API-ключа. */
export function routeUrl(lat: number, lng: number, mode: TransportId = "transit") {
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=${RTT[mode]}`;
}

/** Маршрут через все места дня. */
export function multiRouteUrl(points: { latitude: number; longitude: number }[], mode: TransportId = "transit") {
  return `https://yandex.ru/maps/?rtext=${points.map((p) => `${p.latitude},${p.longitude}`).join("~")}&rtt=${RTT[mode]}`;
}
