/**
 * Клиент серверного API кабинета (/api/v1). Сайт и API живут на одном домене, поэтому без CORS.
 * Токен входа лежит в localStorage (и дублируется HttpOnly-кукой kg_session от сервера: вход переживает чистку хранилища в Safari).
 */
export const ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS === "1";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const API = `${BASE}/api/v1`;
const TOKEN_KEY = "kidgo-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body?: unknown,
    public retryAfter?: number
  ) {
    super(message);
  }
  /** Нет связи с сервером (а не отказ сервера). */
  get offline() {
    return this.status === 0;
  }
}

export const GENERIC_ERROR = "Не получилось. Попробуйте ещё раз.";

/**
 * Сообщение сервера показываем человеку, только если оно написано для людей («Неверный ник или пароль», «Этот ник занят»).
 * Служебные пояснения о полях запроса (латиница, JSON, имена полей) заменяем общим текстом.
 */
export function humanMessage(msg: string | undefined): string | undefined {
  if (!msg) return undefined;
  if (/[A-Za-z_{}\[\]]/.test(msg) || /курсор|тело запроса|документ|идентификатор|Метод/i.test(msg)) return undefined;
  return msg;
}

export function getToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setToken(t: string | undefined) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* режим без хранилища: останется кука */
  }
}

export async function api<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "offline", "Нет интернета. Проверьте связь и попробуйте ещё раз.");
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* не JSON: например, страница ошибки хостинга */
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    const ra = Number(res.headers.get("Retry-After")) || undefined;
    throw new ApiError(res.status, e?.code ?? "http_" + res.status, (res.status < 500 && humanMessage(e?.message)) || (res.status === 404 || res.status >= 500 ? "Сейчас не получается. Попробуйте чуть позже." : GENERIC_ERROR), data, ra);
  }
  return data as T;
}

/* ───────── формы ответов ───────── */

export interface ApiUser {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar: { kind: string; value: string };
  tint: string;
  created_at: string;
}

export interface ApiAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string;
  tint: string;
}
