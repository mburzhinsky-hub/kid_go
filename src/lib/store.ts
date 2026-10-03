"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BudgetId, Child, FamilySignals, TransportId } from "@/lib/types";
import { DEFAULT_ORIGIN, type Origin } from "@/lib/location";

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

/** Выход «Поехали!» — чтобы потом спросить «Как прошло?». */
export interface Trip {
  key: string;
  title: string;
  emoji: string;
  steps: string[];
  goAt: number;
  rating?: 1 | 2 | 3;
  tags?: string[];
}

interface FamilyState {
  hydrated: boolean;
  city: string;
  children: Child[];
  budget: BudgetId;
  transport: TransportId;
  maxDistanceKm: number;
  /** Готовы ехать до N минут. */
  maxTravelMin: number;
  onboarded: boolean;
  origin: Origin;
  home?: Origin;

  loved: string[];
  disliked: string[];
  /** Недавно показанные якоря планировщика (ротация). */
  seen: string[];
  trips: Trip[];

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
  replaceInDay: (index: number, slug: string) => void;
  moveInDay: (slug: string, dir: -1 | 1) => void;
  clearDay: () => void;
  setDayStart: (t: string) => void;
  upsertChild: (c: Child) => void;
  removeChild: (id: string) => void;
  setPrefs: (p: Partial<Pick<FamilyState, "budget" | "transport" | "maxDistanceKm" | "maxTravelMin" | "city">>) => void;
  completeOnboarding: () => void;
  setOrigin: (o: Origin) => void;
  setHome: (o: Origin | undefined) => void;
  markSeen: (slugs: string[]) => void;
  addTrip: (t: Omit<Trip, "goAt">) => void;
  rateTrip: (key: string, rating: 1 | 2 | 3, tags: string[]) => void;
  loadDemoFamily: () => void;
}

const DEMO_CHILDREN: Child[] = [
  { id: "c1", name: "Миша", age: 5, interests: ["dinosaurs", "construction", "space"], emoji: "🦁" },
  { id: "c2", name: "Аня", age: 9, interests: ["drawing", "animals", "science"], emoji: "🦄" },
];

/** Демо-семья — только по явной кнопке в профиле, никогда по умолчанию. */
export const DEMO_FAMILY: Child[] = DEMO_CHILDREN;

export const useFamily = create<FamilyState>()(
  persist(
    (set) => ({
      hydrated: false,
      city: "Москва",
      children: [],
      budget: "5000",
      transport: "transit",
      maxDistanceKm: 10,
      maxTravelMin: 40,
      onboarded: false,
      origin: DEFAULT_ORIGIN,
      home: undefined,
      loved: [],
      disliked: [],
      seen: [],
      trips: [],
      wantPlaces: [],
      visitedPlaces: [],
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
      replaceInDay: (index, slug) => set((s) => ({ day: s.day.map((x, i) => (i === index ? slug : x)) })),
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
      setOrigin: (o) => set({ origin: { ...o, updatedAt: Date.now() } }),
      setHome: (o) => set({ home: o ? { ...o, source: "home", label: o.label === "Рядом со мной" ? "Дом" : o.label } : undefined }),
      markSeen: (slugs) => set((s) => ({ seen: [...slugs, ...s.seen.filter((x) => !slugs.includes(x))].slice(0, 12) })),
      addTrip: (t) => set((s) => ({ trips: [{ ...t, goAt: Date.now() }, ...s.trips.filter((x) => x.key !== t.key)].slice(0, 30) })),
      rateTrip: (key, rating, tags) =>
        set((s) => {
          const trip = s.trips.find((t) => t.key === key);
          if (!trip) return s;
          const anchor = trip.steps[0];
          return {
            trips: s.trips.map((t) => (t.key === key ? { ...t, rating, tags } : t)),
            visitedPlaces: [...trip.steps.filter((x) => !s.visitedPlaces.includes(x)), ...s.visitedPlaces],
            wantPlaces: s.wantPlaces.filter((x) => !trip.steps.includes(x)),
            loved: rating === 3 ? [...new Set([anchor, ...s.loved])] : s.loved.filter((x) => x !== anchor),
            disliked: rating === 1 ? [...new Set([anchor, ...s.disliked])] : s.disliked.filter((x) => x !== anchor),
          };
        }),
      loadDemoFamily: () => set({ children: DEMO_CHILDREN }),
    }),
    {
      name: "kidgo-family",
      version: 2,
      // v1 подставлял демо-детей Мишу и Аню всем подряд — убираем их, если семья их не меняла
      migrate: (state, version) => {
        const st = state as Partial<FamilyState>;
        if (version < 2) {
          const demoIds = new Set(["c1", "c2"]);
          const kids = (st.children ?? []).filter(
            (c) => !(demoIds.has(c.id) && DEMO_CHILDREN.some((d) => d.id === c.id && d.name === c.name && d.age === c.age))
          );
          return {
            ...st,
            children: kids,
            wantPlaces: (st.wantPlaces ?? []).filter((x) => !["moskovsky-zoopark", "eksperimentanium"].includes(x) || kids.length > 0),
            visitedPlaces: (st.visitedPlaces ?? []).filter((x) => x !== "park-gorkogo" || kids.length > 0),
          } as FamilyState;
        }
        return st as FamilyState;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, ...rest }) => rest,
    }
  )
);

/** Вызывается один раз в Providers: подтягиваем localStorage после гидрации React. */
export function rehydrateFamily() {
  const p = useFamily.persist.rehydrate();
  Promise.resolve(p).finally(() => {
    // возраст считается от даты рождения — растёт вместе с ребёнком
    const kids = useFamily.getState().children.map((c) => (c.birthDate ? { ...c, age: ageFromBirth(c.birthDate) } : c));
    useFamily.setState({ hydrated: true, children: kids });
  });
}

/** Полных лет на сегодня по дате "YYYY-MM-DD" или "YYYY-MM". */
export function ageFromBirth(birth: string, now = new Date()): number {
  const [y, m, d] = birth.split("-").map(Number);
  let age = now.getFullYear() - y;
  const mm = now.getMonth() + 1;
  if (mm < m || (mm === m && now.getDate() < (d || 1))) age--;
  return Math.max(0, age);
}

/** Возраст в месяцах — для малышей до 3 лет. */
export function ageMonths(c: Pick<Child, "age" | "birthDate">, now = new Date()): number {
  if (!c.birthDate) return c.age * 12 + 6;
  const [y, m] = c.birthDate.split("-").map(Number);
  return Math.max(0, (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m);
}

export function childLabel(c: Pick<Child, "name" | "age" | "birthDate">): string {
  const months = ageMonths(c);
  const age = months < 24 ? `${months} мес` : `${c.age} ${c.age % 10 === 1 && c.age !== 11 ? "год" : c.age % 10 >= 2 && c.age % 10 <= 4 && (c.age < 10 || c.age > 20) ? "года" : "лет"}`;
  return c.name ? `${c.name}, ${age}` : `Ребёнок, ${age}`;
}

/** Сигналы семьи для движка. */
export function familySignals(s: Pick<FamilyState, "wantPlaces" | "visitedPlaces" | "loved" | "disliked" | "seen">): FamilySignals {
  return { want: s.wantPlaces, visited: s.visitedPlaces, loved: s.loved, disliked: s.disliked, seen: s.seen };
}
