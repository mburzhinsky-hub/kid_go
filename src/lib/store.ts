"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BudgetId, Child, TransportId } from "@/lib/types";

/**
 * Клиентское состояние семьи. Сейчас живёт в localStorage;
 * при подключении Auth (Supabase/Clerk) синхронизируется с таблицами
 * family / child / favorite через тот же интерфейс.
 */

export interface SavedPlan {
  key: string; // slug приключения или "custom:slug+slug"
  title: string;
  emoji: string;
  steps?: string[]; // для собранных планов
  savedAt: number;
}

interface FamilyState {
  hydrated: boolean;
  city: string;
  children: Child[];
  budget: BudgetId;
  transport: TransportId;
  maxDistanceKm: number;
  onboarded: boolean;

  wantPlaces: string[]; // slug
  visitedPlaces: string[];
  savedPlans: SavedPlan[];

  /** «Наш день» — маршрут, собранный из «Что потом?» */
  day: string[];
  dayStart: string;

  toggleWant: (slug: string) => void;
  markVisited: (slug: string) => void;
  toggleSavedPlan: (plan: Omit<SavedPlan, "savedAt">) => void;
  addToDay: (slugs: string[]) => void;
  removeFromDay: (slug: string) => void;
  moveInDay: (slug: string, dir: -1 | 1) => void;
  clearDay: () => void;
  setDayStart: (t: string) => void;
  upsertChild: (c: Child) => void;
  removeChild: (id: string) => void;
  setPrefs: (p: Partial<Pick<FamilyState, "budget" | "transport" | "maxDistanceKm" | "city">>) => void;
  completeOnboarding: () => void;
}

const DEMO_CHILDREN: Child[] = [
  { id: "c1", name: "Миша", age: 5, interests: ["dinosaurs", "construction", "space"], emoji: "🦁" },
  { id: "c2", name: "Аня", age: 9, interests: ["drawing", "animals", "science"], emoji: "🦄" },
];

export const useFamily = create<FamilyState>()(
  persist(
    (set) => ({
      hydrated: false,
      city: "Москва",
      children: DEMO_CHILDREN,
      budget: "5000",
      transport: "transit",
      maxDistanceKm: 10,
      onboarded: false,
      wantPlaces: ["moskovsky-zoopark", "eksperimentanium"],
      visitedPlaces: ["park-gorkogo"],
      savedPlans: [],
      day: [],
      dayStart: "12:00",

      toggleWant: (slug) =>
        set((s) => ({
          wantPlaces: s.wantPlaces.includes(slug) ? s.wantPlaces.filter((x) => x !== slug) : [slug, ...s.wantPlaces],
        })),
      markVisited: (slug) =>
        set((s) => ({
          visitedPlaces: s.visitedPlaces.includes(slug) ? s.visitedPlaces : [slug, ...s.visitedPlaces],
          wantPlaces: s.wantPlaces.filter((x) => x !== slug),
        })),
      toggleSavedPlan: (plan) =>
        set((s) => ({
          savedPlans: s.savedPlans.some((p) => p.key === plan.key)
            ? s.savedPlans.filter((p) => p.key !== plan.key)
            : [{ ...plan, savedAt: Date.now() }, ...s.savedPlans],
        })),
      addToDay: (slugs) =>
        set((s) => {
          const next = [...s.day];
          for (const sl of slugs) if (!next.includes(sl)) next.push(sl);
          return { day: next.slice(0, 6) };
        }),
      removeFromDay: (slug) => set((s) => ({ day: s.day.filter((x) => x !== slug) })),
      moveInDay: (slug, dir) =>
        set((s) => {
          const i = s.day.indexOf(slug);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.day.length) return s;
          const next = [...s.day];
          [next[i], next[j]] = [next[j], next[i]];
          return { day: next };
        }),
      clearDay: () => set({ day: [] }),
      setDayStart: (t) => set({ dayStart: t }),
      upsertChild: (c) =>
        set((s) => ({
          children: s.children.some((x) => x.id === c.id)
            ? s.children.map((x) => (x.id === c.id ? c : x))
            : [...s.children, c],
        })),
      removeChild: (id) => set((s) => ({ children: s.children.filter((c) => c.id !== id) })),
      setPrefs: (p) => set(p),
      completeOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: "kidgo-family",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, ...rest }) => rest,
    }
  )
);

/** Вызывается один раз в Providers: подтягиваем localStorage после гидрации React. */
export function rehydrateFamily() {
  const p = useFamily.persist.rehydrate();
  Promise.resolve(p).finally(() => useFamily.setState({ hydrated: true }));
}
