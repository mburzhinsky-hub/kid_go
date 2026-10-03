/** Маршрут в Яндекс Картах (общественный транспорт). Без API-ключа. */
export function routeUrl(lat: number, lng: number) {
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=mt`;
}
