/**
 * Анонимный идентификатор устройства и (когда появится вход) id пользователя.
 * Ни регистрации, ни установки не требуем: анонимные «хочу сюда» и сохранения привязаны к этому id
 * и при входе / установке переезжают в аккаунт (claimAnonymous в repo.ts).
 * Хранится в localStorage с копией в cookie — внутри браузера Instagram localStorage иногда сбрасывается между сессиями.
 */
const ANON_KEY = "kidgo-anon";
const USER_KEY = "kidgo-uid";
const COOKIE = "kg_anon";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "/";

let cachedAnon: string | undefined;

const rand = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function readCookie(name: string): string | undefined {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}

function writeCookie(name: string, value: string, days: number) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=${BASE}; SameSite=Lax`;
  } catch {
    /* noop */
  }
}

export function getAnonId(): string {
  if (typeof window === "undefined") return "ssr";
  if (cachedAnon) return cachedAnon;
  let v: string | null | undefined;
  try {
    v = localStorage.getItem(ANON_KEY);
  } catch {
    /* режим без хранилища */
  }
  v ||= readCookie(COOKIE);
  if (!v) v = `a_${rand()}`;
  try {
    localStorage.setItem(ANON_KEY, v);
  } catch {
    /* noop */
  }
  writeCookie(COOKIE, v, 365);
  cachedAnon = v;
  return v;
}

export function getUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem(USER_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setUserId(id: string | undefined) {
  try {
    if (id) localStorage.setItem(USER_KEY, id);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

/** Запущено как установленное приложение (иконка на экране «Домой») или в обычном браузере. */
export function platform(): "app" | "web" {
  if (typeof window === "undefined") return "web";
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return "app";
    if ((navigator as unknown as { standalone?: boolean }).standalone) return "app";
  } catch {
    /* noop */
  }
  return "web";
}

export const readCookieValue = readCookie;
export const writeCookieValue = writeCookie;
