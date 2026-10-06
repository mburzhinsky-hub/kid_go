/**
 * Атрибуция: какой автор и какая подборка привели человека.
 * Хранится первое и последнее касание (окно 30 дней), чтобы цепочка «посмотрел → хочу сюда → поставил приложение →
 * сохранил → (позже) купил билет» не терялась после клика. Платформенно-нейтрально: ничего не привязано к конкретной соцсети.
 */
import type { AttributionTouch, Referral } from "./types";
import { getAnonId, getUserId, readCookieValue, writeCookieValue } from "./identity";

const KEY = "kidgo-attr";
const REF_KEY = "kidgo-referrals";
export const ATTRIBUTION_WINDOW_MS = 30 * 24 * 3600 * 1000;

interface Stored {
  first?: AttributionTouch;
  last?: AttributionTouch;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY) ?? readCookieValue("kg_attr");
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* noop */
  }
  return {};
}

function save(s: Stored) {
  const raw = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* noop */
  }
  // короткая копия в cookie: переживает очистку хранилища во встроенных браузерах
  if (raw.length < 900) writeCookieValue("kg_attr", raw, 30);
}

const fresh = (t?: AttributionTouch) => (t && Date.now() - t.at < ATTRIBUTION_WINDOW_MS ? t : undefined);

export function getAttribution(): { first?: AttributionTouch; last?: AttributionTouch } {
  if (typeof window === "undefined") return {};
  const s = load();
  return { first: fresh(s.first), last: fresh(s.last) };
}

/** Автор/подборка, которых нужно записать в намерение или событие. */
export function attributionFields(): { creator_id?: string; collection_id?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  const t = getAttribution().last;
  if (!t) return {};
  return { creator_id: t.creator_id, collection_id: t.collection_id, utm_source: t.utm_source, utm_medium: t.utm_medium, utm_campaign: t.utm_campaign };
}

/** Читаем UTM и сквозные параметры автора из адреса. */
export function readParams(search: string) {
  const q = new URLSearchParams(search);
  const g = (k: string) => q.get(k)?.slice(0, 80) || undefined;
  return { utm_source: g("utm_source"), utm_medium: g("utm_medium"), utm_campaign: g("utm_campaign"), cr: g("cr"), col: g("col") };
}

function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const u = new URL(document.referrer);
    return u.host === location.host ? undefined : u.host;
  } catch {
    return undefined;
  }
}

/**
 * Регистрирует касание. Вызывается, когда человек открывает страницу автора/подборки или место по ссылке с метками.
 * Собственные просмотры автора не считаем (own).
 */
export function registerTouch(t: { creator_id?: string; collection_id?: string; own?: boolean }): AttributionTouch | undefined {
  if (typeof window === "undefined" || t.own) return undefined;
  const p = readParams(location.search);
  const creator_id = t.creator_id ?? p.cr;
  const collection_id = t.collection_id ?? p.col;
  const hasSignal = creator_id || collection_id || p.utm_source;
  if (!hasSignal) return undefined;
  const touch: AttributionTouch = {
    creator_id,
    collection_id,
    utm_source: p.utm_source,
    utm_medium: p.utm_medium,
    utm_campaign: p.utm_campaign,
    referrer: referrerHost(),
    landing_path: location.pathname,
    at: Date.now(),
  };
  const cur = load();
  // касание без автора не затирает действующую привязку к автору
  const keepAuthor = !creator_id && fresh(cur.last)?.creator_id;
  save({ first: fresh(cur.first) ?? touch, last: keepAuthor ? { ...fresh(cur.last)!, utm_source: touch.utm_source ?? cur.last?.utm_source } : touch });
  if (creator_id || collection_id) recordReferral(touch);
  return touch;
}

function recordReferral(t: AttributionTouch) {
  try {
    const sk = `kg-ref-${t.creator_id ?? ""}-${t.collection_id ?? ""}`;
    if (sessionStorage.getItem(sk)) return; // один переход за сессию
    sessionStorage.setItem(sk, "1");
  } catch {
    /* noop */
  }
  const r: Referral = {
    id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    creator_id: t.creator_id,
    collection_id: t.collection_id,
    anonymous_id: getAnonId(),
    user_id: getUserId(),
    utm_source: t.utm_source,
    utm_medium: t.utm_medium,
    utm_campaign: t.utm_campaign,
    referrer: t.referrer,
    landing_path: t.landing_path,
    created_at: new Date(t.at).toISOString(),
  };
  try {
    const list: Referral[] = JSON.parse(localStorage.getItem(REF_KEY) ?? "[]");
    localStorage.setItem(REF_KEY, JSON.stringify([r, ...list].slice(0, 300)));
  } catch {
    /* noop */
  }
}

export function readReferrals(): Referral[] {
  try {
    return JSON.parse(localStorage.getItem(REF_KEY) ?? "[]") as Referral[];
  } catch {
    return [];
  }
}
