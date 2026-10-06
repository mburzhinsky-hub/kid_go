"use client";

import { create } from "zustand";
import type { ShareTarget } from "@/components/social/ShareSheet";

/** Общие шиты: «Поделиться» и «Открыть в приложении» открываются откуда угодно (в том числе из тоста). */
interface UiState {
  share: ShareTarget | null;
  install: { open: boolean; link: string; ids?: { creator_id?: string; collection_id?: string } };
  openShare: (t: ShareTarget) => void;
  closeShare: () => void;
  openInstall: (link: string, ids?: { creator_id?: string; collection_id?: string }) => void;
  closeInstall: () => void;
  transfer: boolean;
  openTransfer: () => void;
  closeTransfer: () => void;
}

export const useSocialUi = create<UiState>((set) => ({
  share: null,
  install: { open: false, link: "" },
  openShare: (share) => set({ share }),
  closeShare: () => set({ share: null }),
  openInstall: (link, ids) => set({ install: { open: true, link, ids } }),
  closeInstall: () => set((s) => ({ install: { ...s.install, open: false } })),
  transfer: false,
  openTransfer: () => set({ transfer: true }),
  closeTransfer: () => set({ transfer: false }),
}));
