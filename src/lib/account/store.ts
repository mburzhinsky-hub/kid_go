"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ApiUser } from "./api";

/** Состояние кабинета на устройстве: кто вошёл и до какой версии синхронизированы документы. */
interface AccountState {
  hydrated: boolean;
  user: ApiUser | null;
  /** Чьи данные сейчас лежат на устройстве (если вход слетел, а данные остались). */
  linkedUserId?: string;
  versions: Record<string, number>;
  hashes: Record<string, string>;
  /** Идёт ли обмен с сервером и всё ли отправлено. */
  sync: "idle" | "syncing" | "error";
  lastSyncAt?: number;
  /** Вход слетел (токен просрочен или отозван): данные остаются, предлагаем войти снова. */
  expired: boolean;
  setUser: (u: ApiUser | null) => void;
  patch: (p: Partial<Omit<AccountState, "hydrated">>) => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      hydrated: false,
      user: null,
      linkedUserId: undefined,
      versions: {},
      hashes: {},
      sync: "idle",
      lastSyncAt: undefined,
      expired: false,
      setUser: (user) => set({ user }),
      patch: (p) => set(p),
    }),
    {
      name: "kidgo-account",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, sync: _s, ...rest }) => rest,
    }
  )
);

export function rehydrateAccount(): Promise<void> {
  return Promise.resolve(useAccount.persist.rehydrate()).then(() => {
    useAccount.setState({ hydrated: true, sync: "idle" });
  });
}
