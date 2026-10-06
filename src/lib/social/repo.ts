"use client";

/**
 * Слой данных подборок для клиента. UI вызывает ТОЛЬКО эти функции и хуки — не знает ни про localStorage, ни про БД.
 * Сейчас реализация локальная (zustand + журнал событий); при подключении сервера меняется тело функций
 * (оптимистично обновляем стор → отправляем запрос), сигнатуры остаются. Схема БД — prisma/schema.prisma.
 *
 *  Чтение:   getCreator, getCollection, listPublicCollections, useAllCollections
 *  Запись:   createCollection, updateCollection, publishCollection, deleteCollection, saveCollection, unsaveCollection
 *  Намерения (хочу сюда / были): intents.ts      События: events.ts      Кабинет автора: stats.ts
 */
import { useMemo } from "react";
import type { AuthorRef, Collection, CollectionCover, CollectionItem, CreatorProfile, ResolvedCollection, Visibility } from "./types";
import { useSocial, type MyProfile } from "./store";
import { SEED_CREATORS } from "./seed";
import { authorOf, normalizeHandle, seedCollection, seedCollectionsOf, seedCreatorByHandle, slugify } from "./catalog";
import { getAnonId, setUserId } from "./identity";
import { trackEvent } from "./events";
import { useFamily } from "@/lib/store";

export interface NewCollectionInput {
  title: string;
  description?: string;
  items: { place_id: string; creator_note?: string }[];
  cover?: CollectionCover;
  visibility?: Visibility;
  age_min?: number;
  age_max?: number;
  /** Подборка «от имени автора» (кабинет): кто подписан. */
  as?: AuthorRef;
}

export const MAX_ITEMS = 30;
export const MAX_NOTE = 240;
export const MAX_TITLE = 100;

const rnd = () => Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();

/* ───────── профиль автора ───────── */

export const reservedHandles = () => new Set(SEED_CREATORS.map((c) => c.username));

export function validateHandle(raw: string, current?: string): string | null {
  const h = normalizeHandle(raw);
  if (h.length < 3) return "Минимум 3 символа";
  if (h.length > 30) return "Не длиннее 30 символов";
  if (!/^[a-z0-9._-]+$/.test(h)) return "Латиница, цифры, точка, дефис";
  if (reservedHandles().has(h) && h !== current) return "Этот ник занят";
  return null;
}

export const myAuthor = (me: MyProfile): AuthorRef => ({ id: me.id, name: me.name, username: me.username, avatar: me.avatar, tint: me.tint, hasPage: false });

/** Первая публикация делает человека автором. Анонимные намерения переезжают на его профиль. */
export function becomeCreator(p: { name: string; username: string; avatar: string; tint: string; bio?: string }): MyProfile {
  const st = useSocial.getState();
  const me: MyProfile = {
    id: st.me?.id ?? `u-${getAnonId()}`,
    name: p.name.trim().slice(0, 60),
    username: normalizeHandle(p.username),
    avatar: p.avatar,
    tint: p.tint,
    bio: (p.bio ?? st.me?.bio ?? "").slice(0, 200),
    status: st.me?.status ?? "APPROVED",
  };
  st.setMe(me);
  setUserId(me.id);
  useFamily.getState().claimIntents(me.id);
  return me;
}

/* ───────── чтение ───────── */

/** Все подборки, известные устройству: демо-каталог + созданные здесь. Скрытые модерацией и черновики чужих не показываем. */
export function resolveAll(s = useSocial.getState()): ResolvedCollection[] {
  const out: ResolvedCollection[] = [];
  for (const r of SEED_CREATORS.flatMap(seedCollectionsOf)) {
    const o = s.adminCollections[r.collection.id];
    out.push(o?.status ? { ...r, collection: { ...r.collection, status: o.status } } : r);
  }
  for (const c of s.collections) {
    const author = s.authors[c.id] ?? (s.me && c.user_id === s.me.id ? myAuthor(s.me) : undefined);
    if (!author) continue;
    const o = s.adminCollections[c.id];
    out.push({ collection: o?.status ? { ...c, status: o.status } : c, author, source: "local" });
  }
  return out;
}

const isPublic = (r: ResolvedCollection) => r.collection.status === "PUBLISHED" && r.collection.visibility === "PUBLIC";

export function useAllCollections(): ResolvedCollection[] {
  const collections = useSocial((s) => s.collections);
  const authors = useSocial((s) => s.authors);
  const me = useSocial((s) => s.me);
  const adminCollections = useSocial((s) => s.adminCollections);
  return useMemo(() => resolveAll({ ...useSocial.getState(), collections, authors, me, adminCollections }), [collections, authors, me, adminCollections]);
}

export function useCreatorStatus(userId: string | undefined, fallback: CreatorProfile["status"] = "APPROVED") {
  const o = useSocial((s) => (userId ? s.adminCreators[userId] : undefined));
  return o?.status ?? fallback;
}

/** Публичные подборки для главной и страниц авторов (рекомендованные админом — раньше). */
export function usePublicCollections(opts: { creatorId?: string; limit?: number } = {}): ResolvedCollection[] {
  const all = useAllCollections();
  const adminCreators = useSocial((s) => s.adminCreators);
  const adminCollections = useSocial((s) => s.adminCollections);
  return useMemo(() => {
    const creatorFeatured = (id: string) => adminCreators[id]?.featured ?? SEED_CREATORS.find((c) => c.user_id === id)?.featured ?? false;
    const score = (r: ResolvedCollection) => (adminCollections[r.collection.id]?.featured ? 2 : 0) + (creatorFeatured(r.author.id) ? 1 : 0);
    const ok = all
      .filter(isPublic)
      .filter((r) => (opts.creatorId ? r.collection.user_id === opts.creatorId : true))
      .filter((r) => (adminCreators[r.author.id]?.status ?? "APPROVED") === "APPROVED");
    const sorted = ok.sort((a, b) => score(b) - score(a));
    return opts.limit ? sorted.slice(0, opts.limit) : sorted;
  }, [all, adminCreators, adminCollections, opts.creatorId, opts.limit]);
}

export interface KnownCreator {
  author: AuthorRef;
  bio: string;
  status: CreatorProfile["status"];
  featured: boolean;
  /** Из демо-каталога (есть страница /@username) или создан на этом устройстве. */
  origin: "seed" | "local";
  collections: number;
}

/** Авторы, известные устройству: демо-каталог, мой профиль и авторы подборок, которые я сохранил или создавал «от имени». Для админки. */
export function useKnownCreators(): KnownCreator[] {
  const all = useAllCollections();
  const me = useSocial((s) => s.me);
  const saved = useSocial((s) => s.saved);
  const adminCreators = useSocial((s) => s.adminCreators);
  return useMemo(() => {
    const out = new Map<string, KnownCreator>();
    const put = (author: AuthorRef, bio: string, status: CreatorProfile["status"], featured: boolean, origin: KnownCreator["origin"]) => {
      if (out.has(author.id)) return;
      const o = adminCreators[author.id];
      out.set(author.id, { author, bio, status: o?.status ?? status, featured: o?.featured ?? featured, origin, collections: 0 });
    };
    for (const c of SEED_CREATORS) put(authorOf(c), c.bio, c.status, c.featured, "seed");
    if (me) put(myAuthor(me), me.bio, me.status, false, "local");
    for (const r of all) put(r.author, "", "APPROVED", false, r.source === "seed" ? "seed" : "local");
    for (const sv of saved) if (sv.snapshot) put(sv.snapshot.author, "", "APPROVED", false, "local");
    for (const r of all) {
      const k = out.get(r.author.id);
      if (k) k.collections++;
    }
    return [...out.values()];
  }, [all, me, saved, adminCreators]);
}

/** Подборки, созданные на этом устройстве от своего имени (без «от имени автора» из кабинета). */
export function useMyCollections(): Collection[] {
  const collections = useSocial((s) => s.collections);
  const authors = useSocial((s) => s.authors);
  const me = useSocial((s) => s.me);
  return useMemo(() => {
    const anon = typeof window === "undefined" ? "" : `u-${getAnonId()}`;
    return collections.filter((c) => !authors[c.id] && (c.user_id === me?.id || c.user_id === anon));
  }, [collections, authors, me]);
}

export function findLocal(id: string): ResolvedCollection | undefined {
  return resolveAll().find((r) => r.collection.id === id);
}

/* ───────── запись ───────── */

function toItems(collection_id: string, items: NewCollectionInput["items"]): CollectionItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => i.place_id && !seen.has(i.place_id) && seen.add(i.place_id))
    .slice(0, MAX_ITEMS)
    .map((i, position) => ({ id: `${collection_id}-${position + 1}`, collection_id, place_id: i.place_id, position, creator_note: i.creator_note?.trim().slice(0, MAX_NOTE) || undefined }));
}

function uniqueSlug(title: string, userId: string, exceptId?: string) {
  const taken = new Set(resolveAll().filter((r) => r.collection.user_id === userId && r.collection.id !== exceptId).map((r) => r.collection.slug));
  const base = slugify(title);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Создаёт черновик. Публикация — отдельным вызовом, чтобы можно было посмотреть превью. */
export function createCollection(input: NewCollectionInput): Collection {
  const st = useSocial.getState();
  const author = input.as ?? (st.me ? myAuthor(st.me) : undefined);
  const userId = author?.id ?? `u-${getAnonId()}`;
  const id = `col-${Date.now().toString(36)}${rnd()}`;
  const t = nowIso();
  const c: Collection = {
    id,
    user_id: userId,
    title: input.title.trim().slice(0, MAX_TITLE),
    slug: uniqueSlug(input.title, userId),
    description: (input.description ?? "").trim().slice(0, 600),
    cover: input.cover ?? { kind: "collage" },
    city: useFamily.getState().city || "Москва",
    visibility: input.visibility ?? "PUBLIC",
    status: "DRAFT",
    age_min: input.age_min ?? 0,
    age_max: input.age_max ?? 12,
    created_at: t,
    updated_at: t,
    items: toItems(id, input.items),
  };
  st.upsertCollection(c, input.as);
  trackEvent("collection_created", { collection_id: id, creator_id: userId, places: c.items.length });
  return c;
}

export function updateCollection(id: string, patch: Partial<Omit<NewCollectionInput, "as">>): Collection | null {
  const st = useSocial.getState();
  const cur = st.collections.find((c) => c.id === id);
  if (!cur) return null;
  const next: Collection = {
    ...cur,
    title: patch.title !== undefined ? patch.title.trim().slice(0, MAX_TITLE) : cur.title,
    slug: patch.title !== undefined && cur.status === "DRAFT" ? uniqueSlug(patch.title, cur.user_id, id) : cur.slug,
    description: patch.description !== undefined ? patch.description.trim().slice(0, 600) : cur.description,
    cover: patch.cover ?? cur.cover,
    visibility: patch.visibility ?? cur.visibility,
    age_min: patch.age_min ?? cur.age_min,
    age_max: patch.age_max ?? cur.age_max,
    items: patch.items ? toItems(id, patch.items) : cur.items,
    updated_at: nowIso(),
  };
  st.upsertCollection(next);
  return next;
}

export function publishCollection(id: string, visibility?: Visibility): Collection | null {
  const st = useSocial.getState();
  const cur = st.collections.find((c) => c.id === id);
  if (!cur || !cur.items.length) return null;
  const t = nowIso();
  const next: Collection = { ...cur, status: "PUBLISHED", visibility: visibility ?? cur.visibility, published_at: cur.published_at ?? t, updated_at: t };
  st.upsertCollection(next);
  trackEvent("collection_published", { collection_id: id, creator_id: cur.user_id, visibility: next.visibility, places: next.items.length });
  return next;
}

export function deleteCollection(id: string) {
  useSocial.getState().removeCollection(id);
}

export function saveCollection(r: ResolvedCollection, source?: string) {
  const st = useSocial.getState();
  if (st.saved.some((x) => x.id === r.collection.id)) return;
  st.saveCollection({ id: r.collection.id, saved_at: nowIso(), snapshot: r.source === "seed" ? undefined : r });
  trackEvent("collection_save", { collection_id: r.collection.id, creator_id: r.author.id, source_screen: source });
}

export function unsaveCollection(r: Pick<ResolvedCollection, "collection" | "author">) {
  useSocial.getState().unsaveCollection(r.collection.id);
  trackEvent("collection_unsave", { collection_id: r.collection.id, creator_id: r.author.id });
}

export const useIsSaved = (id: string) => useSocial((s) => s.hydrated && s.saved.some((x) => x.id === id));

/** Сохранённые подборки: каталожные подтягиваем по id, остальные берём из снимка. */
export function useSavedCollections(): ResolvedCollection[] {
  const saved = useSocial((s) => s.saved);
  const all = useAllCollections();
  return useMemo(() => {
    const out: ResolvedCollection[] = [];
    for (const sv of saved) {
      const live = all.find((r) => r.collection.id === sv.id);
      const r = live ?? sv.snapshot;
      if (r) out.push(r);
    }
    return out;
  }, [saved, all]);
}

/** Название и ссылка подборки по id — для подписи «из подборки …» в Избранном (каталог, свои и сохранённые снимки). */
export function useCollectionLookup(): (id?: string) => ResolvedCollection | undefined {
  const all = useAllCollections();
  const saved = useSocial((s) => s.saved);
  return useMemo(() => {
    const byId = new Map<string, ResolvedCollection>();
    for (const sv of saved) if (sv.snapshot) byId.set(sv.id, sv.snapshot);
    for (const r of all) byId.set(r.collection.id, r);
    return (id?: string) => (id ? byId.get(id) : undefined);
  }, [all, saved]);
}

export const useFollowing = (id: string) => useSocial((s) => s.hydrated && s.follows.includes(id));

export function toggleFollow(a: AuthorRef) {
  const st = useSocial.getState();
  const was = st.follows.includes(a.id);
  st.toggleFollow(a.id);
  trackEvent(was ? "creator_unfollow" : "creator_follow", { creator_id: a.id });
}

/* ───────── асинхронный интерфейс для серверной реализации ───────── */

export interface SocialRepository {
  getCreator(handle: string): Promise<{ creator: CreatorProfile; collections: ResolvedCollection[] } | null>;
  getCollection(handle: string, slug: string): Promise<ResolvedCollection | null>;
  createCollection(input: NewCollectionInput): Promise<Collection>;
  updateCollection(id: string, patch: Partial<Omit<NewCollectionInput, "as">>): Promise<Collection | null>;
  publishCollection(id: string, visibility?: Visibility): Promise<Collection | null>;
  deleteCollection(id: string): Promise<void>;
  saveCollection(r: ResolvedCollection): Promise<void>;
  unsaveCollection(r: ResolvedCollection): Promise<void>;
}

/** Локальная реализация: тот же интерфейс, что получит серверная. Демо-каталог читается без устройства (SSG), остальное — из стора. */
export const socialRepo: SocialRepository = {
  async getCreator(handle) {
    const creator = seedCreatorByHandle(handle);
    return creator ? { creator, collections: seedCollectionsOf(creator) } : null;
  },
  async getCollection(handle, slug) {
    return seedCollection(handle, slug);
  },
  async createCollection(input) {
    return createCollection(input);
  },
  async updateCollection(id, patch) {
    return updateCollection(id, patch);
  },
  async publishCollection(id, v) {
    return publishCollection(id, v);
  },
  async deleteCollection(id) {
    deleteCollection(id);
  },
  async saveCollection(r) {
    saveCollection(r);
  },
  async unsaveCollection(r) {
    unsaveCollection(r);
  },
};

export { authorOf };
