/**
 * Яндекс Метрика: чистые функции без обращения к window, чтобы их можно было проверить тестом.
 *
 * Главное правило: в Метрику уходит только адрес страницы БЕЗ параметров. В адресах сайта лежат данные о семье
 * (`kids=` с возрастами детей в /planner/results, личные хотелки в /import), а данные о детях не должны покидать устройство.
 * Исключение — рекламные метки utm_*: они нужны, чтобы видеть, откуда пришли люди.
 */

/** Номер счётчика (публичный, виден в коде любого сайта с Метрикой). */
export const YM_ID = 113672662;

/** Счётчик работает только на боевом домене: тесты, превью и localhost не должны портить статистику. */
export const TRACKED_HOSTS = ["kids-go.fun", "www.kids-go.fun"];

/** Разделы, которые в Метрику не попадают совсем: кабинеты, админка, импорт личных хотелок. */
const PRIVATE_PREFIXES = ["/admin", "/cabinet", "/import", "/profile", "/api"];

/** Метки рекламных ссылок — единственные параметры адреса, которые разрешено отправлять. */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/**
 * Можно ли запускать счётчик на ЭТОЙ странице. Сам тег Метрики при загрузке отправляет служебный запрос (`nohit`)
 * с полным адресом из строки браузера, и повлиять на него нельзя. Поэтому счётчик стартует только тогда, когда в адресе
 * нет ничего, кроме utm_*: ни `kids=`, ни поиска, ни хотелок, ни якоря, и страница не из закрытых разделов.
 * Если человек пришёл по такой ссылке, счётчик запустится позже, при первом переходе на чистый адрес.
 */
export function isSafeToStart(pathname: string, search: string, hash: string): boolean {
  if (isPrivatePath(pathname)) return false;
  if (hash && hash !== "#") return false;
  for (const k of new URLSearchParams(search).keys()) if (!UTM_KEYS.includes(k)) return false;
  return true;
}

export function isTrackedHost(hostname: string): boolean {
  return TRACKED_HOSTS.includes(hostname.toLowerCase());
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Адрес для Метрики: origin + путь (+ utm_*, если разрешено). Всё остальное в query отбрасывается. */
export function cleanHitUrl(origin: string, pathname: string, search: string, keepUtm: boolean): string {
  let q = "";
  if (keepUtm) {
    const src = new URLSearchParams(search);
    const out = new URLSearchParams();
    for (const k of UTM_KEYS) {
      const v = src.get(k);
      if (v) out.set(k, v.slice(0, 100));
    }
    q = out.toString();
  }
  return origin + pathname + (q ? `?${q}` : "");
}

/** Реферер: чужие сайты оставляем как есть, а свои же страницы — без query и hash. */
export function cleanReferrer(referrer: string, origin: string): string {
  if (!referrer) return "";
  try {
    const u = new URL(referrer);
    if (u.origin === origin) return u.origin + u.pathname;
    return referrer;
  } catch {
    return "";
  }
}
