"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BudgetId, Child, FamilySignals, TransportId } from "@/lib/types";
import { DEFAULT_ORIGIN, suggestedTransport, type Origin } from "@/lib/location";
import type { IntentFeedback, IntentSource, IntentStatus, PlaceIntent } from "@/lib/social/types";
import { getAnonId, getUserId } from "@/lib/social/identity";

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

/** Откуда пришло намерение «Хочу сюда»: экран, подборка и автор (если человек пришёл по ссылке автора). */
export interface IntentCtx {
  source_type?: IntentSource;
  source_id?: string;
  creator_id?: string;
  collection_id?: string;
}

interface FamilyState {
  hydrated: boolean;
  city: string;
  children: Child[];
  budget: BudgetId;
  transport: TransportId;
  /** Транспорт подбирается по точке выезда, пока семья не выбрала сама. */
  transportAuto: boolean;
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

  /** «Хочу сюда» — единственный источник правды: намерения с источником и автором. wantPlaces/visitedPlaces — их проекция для движка. */
  intents: Record<string, PlaceIntent>;
  wantPlaces: string[]; // slug
  visitedPlaces: string[];
  savedPlans: SavedPlan[];

  /** «Наш день» — маршрут, собранный из «Что потом?» */
  day: string[];
  dayStart: string;

  toggleWant: (slug: string, ctx?: IntentCtx) => void;
  markVisited: (slug: string, ctx?: IntentCtx) => void;
  /** Убрать из «Хочу сходить» и «Уже были» (намерение остаётся в истории со статусом REMOVED). */
  clearIntent: (slug: string) => void;
  setIntentFeedback: (slug: string, feedback: IntentFeedback | undefined) => void;
  /** При входе / установке приложения анонимные намерения становятся намерениями пользователя. */
  claimIntents: (userId: string) => void;
  /** Слияние намерений с другого устройства: уже известные места не затираем. */
  importIntents: (items: { slug: string; status: "WANT_TO_GO" | "VISITED"; feedback?: IntentFeedback; ctx?: IntentCtx }[]) => number;
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
      transportAuto: true,
      maxDistanceKm: 10,
      maxTravelMin: 40,
      onboarded: false,
      origin: DEFAULT_ORIGIN,
      home: undefined,
      loved: [],
      disliked: [],
      seen: [],
      trips: [],
      intents: {},
      wantPlaces: [],
      visitedPlaces: [],
      savedPlans: [],
      day: [],
      dayStart: "12:00",

      toggleWant: (slug, ctx) => set((s) => applyIntent(s, slug, s.wantPlaces.includes(slug) ? "REMOVED" : "WANT_TO_GO", ctx)),
      markVisited: (slug, ctx) => set((s) => (s.visitedPlaces.includes(slug) ? s : applyIntent(s, slug, "VISITED", ctx))),
      clearIntent: (slug) => set((s) => applyIntent(s, slug, "REMOVED")),
      setIntentFeedback: (slug, feedback) =>
        set((s) => {
          const it = s.intents[slug];
          if (!it) return s;
          const loved = feedback === "LIKE" ? [...new Set([slug, ...s.loved])] : s.loved.filter((x) => x !== slug);
          const disliked = feedback === "DISLIKE" ? [...new Set([slug, ...s.disliked])] : s.disliked.filter((x) => x !== slug);
          return { intents: { ...s.intents, [slug]: { ...it, feedback, updated_at: new Date().toISOString() } }, loved, disliked };
        }),
      importIntents: (items) => {
        let added = 0;
        set((s) => {
          let cur: Pick<FamilyState, "intents" | "wantPlaces" | "visitedPlaces"> = s;
          let loved = s.loved;
          let disliked = s.disliked;
          for (const it of items) {
            const prev = cur.intents[it.slug];
            if (prev && prev.status !== "REMOVED") continue;
            cur = applyIntent(cur, it.slug, it.status, it.ctx);
            added++;
            if (it.status === "VISITED" && it.feedback) {
              cur = { ...cur, intents: { ...cur.intents, [it.slug]: { ...cur.intents[it.slug], feedback: it.feedback } } };
              if (it.feedback === "LIKE") loved = [...new Set([it.slug, ...loved])];
              if (it.feedback === "DISLIKE") disliked = [...new Set([it.slug, ...disliked])];
            }
          }
          return { ...cur, loved, disliked };
        });
        return added;
      },
      claimIntents: (userId) =>
        set((s) => ({ intents: Object.fromEntries(Object.entries(s.intents).map(([k, v]) => [k, v.user_id ? v : { ...v, user_id: userId }])) })),
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
      setPrefs: (p) => set(p.transport ? { ...p, transportAuto: false } : p),
      completeOnboarding: () => set({ onboarded: true }),
      setOrigin: (o) =>
        set((s) => ({
          origin: { ...o, updatedAt: Date.now() },
          // за МКАД ездят на машине — пока семья не выбрала транспорт сама
          transport: s.transportAuto ? suggestedTransport(o) : s.transport,
        })),
      setHome: (o) => set({ home: o ? { ...o, source: "home", label: o.label === "Рядом со мной" ? "Дом" : o.label } : undefined }),
      markSeen: (slugs) => set((s) => ({ seen: [...slugs, ...s.seen.filter((x) => !slugs.includes(x))].slice(0, 12) })),
      addTrip: (t) => set((s) => ({ trips: [{ ...t, goAt: Date.now() }, ...s.trips.filter((x) => x.key !== t.key)].slice(0, 30) })),
      rateTrip: (key, rating, tags) =>
        set((s) => {
          const trip = s.trips.find((t) => t.key === key);
          if (!trip) return s;
          const anchor = trip.steps[0];
          let cur: FamilyState = s;
          for (const st of trip.steps) if (!cur.visitedPlaces.includes(st)) cur = { ...cur, ...applyIntent(cur, st, "VISITED", { source_type: "ADVENTURE", source_id: key }) };
          return {
            trips: s.trips.map((t) => (t.key === key ? { ...t, rating, tags } : t)),
            intents: cur.intents,
            visitedPlaces: cur.visitedPlaces,
            wantPlaces: cur.wantPlaces,
            loved: rating === 3 ? [...new Set([anchor, ...s.loved])] : s.loved.filter((x) => x !== anchor),
            disliked: rating === 1 ? [...new Set([anchor, ...s.disliked])] : s.disliked.filter((x) => x !== anchor),
          };
        }),
      loadDemoFamily: () => set({ children: DEMO_CHILDREN }),
    }),
    {
      name: "kidgo-family",
      version: 4,
      // v1 подставлял демо-детей Мишу и Аню всем подряд — убираем их, если семья их не меняла
      migrate: (state, version) => {
        let cur = state as Partial<FamilyState>;
        if (version < 2) {
          const demoIds = new Set(["c1", "c2"]);
          const kids = (cur.children ?? []).filter(
            (c) => !(demoIds.has(c.id) && DEMO_CHILDREN.some((d) => d.id === c.id && d.name === c.name && d.age === c.age))
          );
          cur = {
            ...cur,
            children: kids,
            transportAuto: (cur.transport ?? "transit") === "transit",
            wantPlaces: (cur.wantPlaces ?? []).filter((x) => !["moskovsky-zoopark", "eksperimentanium"].includes(x) || kids.length > 0),
            visitedPlaces: (cur.visitedPlaces ?? []).filter((x) => x !== "park-gorkogo" || kids.length > 0),
          };
        }
        if (version < 3) cur = { ...cur, transportAuto: (cur.transport ?? "transit") === "transit" };
        if (version < 4) {
          // v4: «Хочу сюда» стало сущностью с источником — переносим старые хотелки и «уже были»
          const now = new Date().toISOString();
          const intents: Record<string, PlaceIntent> = {};
          const mk = (slug: string, status: IntentStatus): PlaceIntent => ({
            id: `pi_${slug}`,
            place_id: slug,
            status,
            source_type: "PLACE",
            created_at: now,
            updated_at: now,
          });
          for (const slug of cur.visitedPlaces ?? []) intents[slug] = mk(slug, "VISITED");
          for (const slug of cur.wantPlaces ?? []) intents[slug] = mk(slug, "WANT_TO_GO");
          cur = { ...cur, intents };
        }
        return cur as FamilyState;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, ...rest }) => rest,
    }
  )
);

/**
 * Меняет статус намерения и держит проекции wantPlaces / visitedPlaces в той же транзакции.
 * Источник (экран, подборка, автор) запоминается при первом «хочу» и не затирается, когда «хочу» превращается в «были».
 */
function applyIntent(
  s: Pick<FamilyState, "intents" | "wantPlaces" | "visitedPlaces">,
  slug: string,
  status: IntentStatus,
  ctx: IntentCtx = {}
): Pick<FamilyState, "intents" | "wantPlaces" | "visitedPlaces"> {
  const now = new Date().toISOString();
  const prev = s.intents[slug];
  const reuse = prev && prev.status !== "REMOVED" && status === "VISITED";
  const intent: PlaceIntent = {
    id: prev?.id ?? `pi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    user_id: getUserId() ?? prev?.user_id,
    anonymous_session_id: prev?.anonymous_session_id ?? getAnonId(),
    place_id: slug,
    status,
    source_type: reuse ? prev.source_type : (ctx.source_type ?? "PLACE"),
    source_id: reuse ? prev.source_id : ctx.source_id,
    creator_id: reuse ? prev.creator_id : ctx.creator_id,
    collection_id: reuse ? prev.collection_id : ctx.collection_id,
    feedback: status === "VISITED" ? prev?.feedback : undefined,
    created_at: prev && prev.status !== "REMOVED" ? prev.created_at : now,
    updated_at: now,
  };
  return {
    intents: { ...s.intents, [slug]: intent },
    wantPlaces: status === "WANT_TO_GO" ? [slug, ...s.wantPlaces.filter((x) => x !== slug)] : s.wantPlaces.filter((x) => x !== slug),
    visitedPlaces: status === "VISITED" ? [slug, ...s.visitedPlaces.filter((x) => x !== slug)] : s.visitedPlaces.filter((x) => x !== slug),
  };
}

/** Вызывается один раз в Providers: подтягиваем localStorage после гидрации React. */
export function rehydrateFamily() {
  const p = useFamily.persist.rehydrate();
  Promise.resolve(p).finally(() => {
    // возраст считается от даты рождения — растёт вместе с ребёнком
    const kids = useFamily.getState().children.map((c) => (c.birthDate ? { ...c, age: ageFromBirth(c.birthDate) } : c));
    const st = useFamily.getState();
    useFamily.setState({ hydrated: true, children: kids, transport: st.transportAuto ? suggestedTransport(st.origin) : st.transport });
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
