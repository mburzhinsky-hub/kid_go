"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthorRef, Collection, CollectionStatus, CreatorStatus, ResolvedCollection } from "./types";

/**
 * Состояние автора и подборок на устройстве: мой профиль автора, созданные подборки (в том числе черновики),
 * сохранённые чужие подборки (со снимком, чтобы не потерять после закрытия ссылки), подписки.
 * Через слой repo.ts это же состояние заменяется запросами к серверу — компоненты ничего не заметят.
 */

export interface MyProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  tint: string;
  bio: string;
  /** Админ может заранее принять/отклонить автора; для личного профиля по умолчанию принят. */
  status: CreatorStatus;
}

export interface SavedCollection {
  id: string;
  saved_at: string;
  /** Для подборок не из каталога храним снимок: ссылка могла быть одноразовой. */
  snapshot?: ResolvedCollection;
}

interface SocialState {
  hydrated: boolean;
  me?: MyProfile;
  /** Созданные на этом устройстве (свои и от имени автора из кабинета). */
  collections: Collection[];
  /** Для подборок «от имени автора»: кто на самом деле автор. */
  authors: Record<string, AuthorRef>;
  saved: SavedCollection[];
  follows: string[];
  recent: string[];
  adminCreators: Record<string, { status?: CreatorStatus; featured?: boolean }>;
  adminCollections: Record<string, { status?: CollectionStatus; featured?: boolean }>;

  setMe: (p: MyProfile) => void;
  upsertCollection: (c: Collection, author?: AuthorRef) => void;
  removeCollection: (id: string) => void;
  saveCollection: (s: SavedCollection) => void;
  unsaveCollection: (id: string) => void;
  toggleFollow: (id: string) => void;
  pushRecent: (slug: string) => void;
  setAdminCreator: (id: string, v: { status?: CreatorStatus; featured?: boolean }) => void;
  setAdminCollection: (id: string, v: { status?: CollectionStatus; featured?: boolean }) => void;
}

export const useSocial = create<SocialState>()(
  persist(
    (set) => ({
      hydrated: false,
      me: undefined,
      collections: [],
      authors: {},
      saved: [],
      follows: [],
      recent: [],
      adminCreators: {},
      adminCollections: {},

      setMe: (me) => set({ me }),
      upsertCollection: (c, author) =>
        set((s) => ({
          collections: s.collections.some((x) => x.id === c.id) ? s.collections.map((x) => (x.id === c.id ? c : x)) : [c, ...s.collections],
          authors: author ? { ...s.authors, [c.id]: author } : s.authors,
        })),
      removeCollection: (id) => set((s) => ({ collections: s.collections.filter((c) => c.id !== id), authors: Object.fromEntries(Object.entries(s.authors).filter(([k]) => k !== id)) })),
      saveCollection: (sc) => set((s) => (s.saved.some((x) => x.id === sc.id) ? s : { saved: [sc, ...s.saved] })),
      unsaveCollection: (id) => set((s) => ({ saved: s.saved.filter((x) => x.id !== id) })),
      toggleFollow: (id) => set((s) => ({ follows: s.follows.includes(id) ? s.follows.filter((x) => x !== id) : [id, ...s.follows] })),
      pushRecent: (slug) => set((s) => (s.recent[0] === slug ? s : { recent: [slug, ...s.recent.filter((x) => x !== slug)].slice(0, 12) })),
      setAdminCreator: (id, v) => set((s) => ({ adminCreators: { ...s.adminCreators, [id]: { ...s.adminCreators[id], ...v } } })),
      setAdminCollection: (id, v) => set((s) => ({ adminCollections: { ...s.adminCollections, [id]: { ...s.adminCollections[id], ...v } } })),
    }),
    {
      name: "kidgo-social",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, ...rest }) => rest,
    }
  )
);

export function rehydrateSocial() {
  Promise.resolve(useSocial.persist.rehydrate()).finally(() => useSocial.setState({ hydrated: true }));
}
