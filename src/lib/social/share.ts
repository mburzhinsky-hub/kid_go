/**
 * Ссылки и шаринг подборок и мест.
 *  - демо-подборки живут по красивому адресу /@автор/slug (статическая страница, нормальный превью-снимок в соцсетях);
 *  - подборки, созданные на устройстве, переносят себя в ссылке (/c/?d=…): друг открывает их без регистрации и без сервера.
 * Системное меню «Поделиться» — через Web Share API; Telegram и WhatsApp — прямыми ссылками; для Instagram — системное меню
 * или «Скопировать ссылку» (никакой выдуманной интеграции).
 */
import type { AuthorRef, Collection, ResolvedCollection } from "./types";
import { slugify } from "./catalog";
import { useAccount } from "@/lib/account/store";
import { ACCOUNTS_ENABLED } from "@/lib/account/api";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL;

/** Адрес сайта: на клиенте — откуда реально открыта страница, на сервере — из окружения. */
export function siteOrigin(): string {
  if (typeof window !== "undefined") return `${location.origin}${BASE}`;
  return SITE ?? "https://kids-go.fun";
}

export type ShareChannel = "native" | "telegram" | "whatsapp" | "copy" | "other";

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const withUtm = (url: string, u?: UtmParams) => {
  if (!u) return url;
  const q = new URLSearchParams();
  if (u.utm_source) q.set("utm_source", u.utm_source);
  if (u.utm_medium) q.set("utm_medium", u.utm_medium);
  if (u.utm_campaign) q.set("utm_campaign", u.utm_campaign);
  const s = q.toString();
  return s ? `${url}${url.includes("?") ? "&" : "?"}${s}` : url;
};

/* ───────── снимок подборки в ссылке ───────── */

interface SnapshotV1 {
  v: 1;
  i: string;
  t: string;
  d?: string;
  c: string; // slug места-обложки или "*" — коллаж
  a: [number, number];
  y?: string;
  s?: number;
  u: { i: string; n: string; h: string; e: string; k?: string };
  p: [string, string?][];
}

const MAX_ITEMS = 30;
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

function b64urlEncode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeSnapshot(r: ResolvedCollection): string {
  const c = r.collection;
  const snap: SnapshotV1 = {
    v: 1,
    i: c.id,
    t: c.title,
    d: c.description || undefined,
    c: c.cover.kind === "place" ? c.cover.slug : "*",
    a: [c.age_min, c.age_max],
    y: c.city,
    s: Math.round(new Date(c.published_at ?? c.updated_at).getTime() / 1000) || undefined,
    u: { i: r.author.id, n: r.author.name, h: r.author.username, e: r.author.avatar, k: r.author.tint },
    p: [...c.items].sort((a, b) => a.position - b.position).slice(0, MAX_ITEMS).map((it) => (it.creator_note ? [it.place_id, it.creator_note] : [it.place_id])),
  };
  return b64urlEncode(JSON.stringify(snap));
}

/** Разбор ссылки: всё проверяем, ничего не доверяем — данные пришли из адресной строки. */
export function decodeSnapshot(d: string): ResolvedCollection | null {
  try {
    const s = JSON.parse(b64urlDecode(d)) as Partial<SnapshotV1>;
    if (s.v !== 1 || typeof s.t !== "string" || !Array.isArray(s.p) || !s.u) return null;
    const id = /^[\w-]{1,64}$/.test(String(s.i)) ? String(s.i) : `snap-${slugify(s.t, 24)}`;
    const items = s.p
      .slice(0, MAX_ITEMS)
      .filter((x): x is [string, string?] => Array.isArray(x) && typeof x[0] === "string" && /^[\w-]{1,80}$/.test(x[0]))
      .map(([place_id, note], position) => ({ id: `${id}-${position + 1}`, collection_id: id, place_id, position, creator_note: note ? clip(note, 400) : undefined }));
    if (!items.length) return null;
    const when = s.s ? new Date(s.s * 1000).toISOString() : new Date(0).toISOString();
    const age = Array.isArray(s.a) && s.a.length === 2 ? ([Math.max(0, Math.min(18, Number(s.a[0]) || 0)), Math.max(0, Math.min(18, Number(s.a[1]) || 12))] as const) : ([0, 12] as const);
    const collection: Collection = {
      id,
      user_id: clip(s.u.i, 64) || "u-unknown",
      title: clip(s.t, 140),
      slug: slugify(s.t),
      description: clip(s.d, 600),
      cover: s.c && s.c !== "*" ? { kind: "place", slug: clip(s.c, 80) } : { kind: "collage" },
      city: clip(s.y, 40) || "Москва",
      visibility: "UNLISTED",
      status: "PUBLISHED",
      age_min: age[0],
      age_max: age[1],
      created_at: when,
      updated_at: when,
      published_at: when,
      items,
    };
    const author: AuthorRef = { id: collection.user_id, name: clip(s.u.n, 60) || "Автор", username: clip(s.u.h, 40).replace(/[^\w.-]/g, ""), avatar: clip(s.u.e, 8) || "🧸", tint: /^#[0-9a-f]{6}$/i.test(String(s.u.k)) ? String(s.u.k) : "#FFE4F1" };
    return { collection, author, source: "snapshot" };
  } catch {
    return null;
  }
}

/* ───────── адреса ───────── */

/** Относительный путь страницы подборки (без базового пути и меток). */
export function collectionPath(r: ResolvedCollection): string {
  if (r.source === "seed") return `/@${r.author.username}/${r.collection.slug}/`;
  // на своём сервере — короткий красивый адрес с превью; без сервера (GitHub Pages) — со снимком внутри
  if (isServerBacked(r)) return ACCOUNTS_ENABLED ? `/c/${r.collection.id}/` : `/c/?id=${r.collection.id}`;
  return `/c/?d=${encodeSnapshot(r)}`;
}

/** Подборка живёт на сервере и открывается другом по короткой ссылке: она моя, опубликована и не приватная. */
function isServerBacked(r: ResolvedCollection): boolean {
  const c = r.collection;
  if (!/^[a-z0-9]{10}$/.test(c.id)) return false;
  if (c.visibility === "PRIVATE" || c.status !== "PUBLISHED") return false;
  // чужая сохранённая подборка тоже открывается по id, если автор не спрятал её
  if (r.source === "snapshot") return true;
  const user = useAccount.getState().user;
  return !!user && c.user_id === user.id;
}

export function collectionUrl(r: ResolvedCollection, utm?: UtmParams): string {
  return withUtm(`${siteOrigin()}${collectionPath(r)}`, utm);
}

/** Ссылка на место. cr/col переносят привязку к автору дальше: друг, которого позвали, тоже засчитается подборке. */
export function placeUrl(slug: string, utm?: UtmParams, via?: { creator_id?: string; collection_id?: string }): string {
  const q = new URLSearchParams();
  if (via?.creator_id) q.set("cr", via.creator_id);
  if (via?.collection_id) q.set("col", via.collection_id);
  // места из OpenStreetMap не предгенерированы: у них свой экран, который подтягивает данные по id
  if (slug.startsWith("osm-")) q.set("id", slug);
  const base = slug.startsWith("osm-") ? `${siteOrigin()}/nearby/` : `${siteOrigin()}/places/${slug}/`;
  const url = q.toString() ? `${base}?${q}` : base;
  return withUtm(url, utm);
}

export const creatorUrl = (username: string, utm?: UtmParams) => withUtm(`${siteOrigin()}/@${username}/`, utm);

/* ───────── тексты ───────── */

export const collectionShareText = (r: ResolvedCollection) => `${r.collection.title} ✨ Автор подборки: ${r.author.name}`;
export const placeInviteText = () => "Хотим сходить сюда с детьми 👋 Кто с нами?";

/* ───────── каналы ───────── */

export const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export async function nativeShare(data: { title: string; text: string; url: string }): Promise<boolean> {
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // закрыли системное меню
  }
}

export const telegramLink = (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
export const whatsappLink = (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
