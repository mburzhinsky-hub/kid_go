"use client";

/**
 * Документы синхронизации: что именно из локального состояния уезжает на сервер и как сливается с серверной копией.
 * На сервер НЕ уходит ничего о детях и семье: только места, намерения, выходы, сохранённые планы и подборки.
 */
import { useFamily, type SavedPlan, type Trip } from "@/lib/store";
import { useSocial } from "@/lib/social/store";
import type { IntentFeedback, PlaceIntent } from "@/lib/social/types";

export type DocName = "intents" | "trips" | "plans" | "saves" | "follows";

interface IntentsBody {
  items: Record<string, SyncIntent>;
  loved: string[];
  disliked: string[];
}
type SyncIntent = Omit<PlaceIntent, "user_id" | "anonymous_session_id">;
interface ListBody<T> {
  items: T[];
}

export interface DocSpec<T = unknown> {
  name: DocName;
  read: () => T;
  write: (v: T) => void;
  merge: (local: T, remote: T) => T;
  isEmpty: (v: T) => boolean;
  /** Приводит то, что пришло с сервера, к ожидаемой форме (сервер хранит любой JSON). */
  sanitize: (raw: unknown) => T;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const uniq = (a: string[]) => [...new Set(a)];
const slugOk = (s: unknown): s is string => typeof s === "string" && /^[\w-]{1,80}$/.test(s);
const FEEDBACK: IntentFeedback[] = ["LIKE", "OK", "DISLIKE"];

/* ───────── намерения («хочу сюда», «были», оценки) ───────── */

const intentsDoc: DocSpec<IntentsBody> = {
  name: "intents",
  read() {
    const s = useFamily.getState();
    const items: Record<string, SyncIntent> = {};
    for (const [slug, it] of Object.entries(s.intents)) {
      const { user_id: _u, anonymous_session_id: _a, ...rest } = it;
      items[slug] = rest;
    }
    return { items, loved: [...s.loved], disliked: [...s.disliked] };
  },
  write(b) {
    const s = useFamily.getState();
    const intents: Record<string, PlaceIntent> = {};
    for (const [slug, it] of Object.entries(b.items)) intents[slug] = { ...it, user_id: s.intents[slug]?.user_id, anonymous_session_id: s.intents[slug]?.anonymous_session_id };
    const byRecent = (st: string) =>
      Object.values(intents)
        .filter((i) => i.status === st)
        .sort((a, b2) => (a.updated_at < b2.updated_at ? 1 : -1))
        .map((i) => i.place_id);
    useFamily.setState({ intents, wantPlaces: byRecent("WANT_TO_GO"), visitedPlaces: byRecent("VISITED"), loved: b.loved, disliked: b.disliked });
  },
  merge(l, r) {
    const items: Record<string, SyncIntent> = { ...r.items };
    for (const [slug, it] of Object.entries(l.items)) {
      const o = items[slug];
      items[slug] = !o || it.updated_at >= o.updated_at ? it : o;
    }
    // оценка места, которое человек сам убрал или переоценил позже, не должна «воскресать» из объединения
    const loved = uniq([...l.loved, ...r.loved]).filter((s) => items[s]?.feedback !== "DISLIKE" && items[s]?.feedback !== "OK");
    const disliked = uniq([...l.disliked, ...r.disliked]).filter((s) => items[s]?.feedback !== "LIKE" && !loved.includes(s));
    return { items, loved, disliked };
  },
  isEmpty: (v) => !Object.keys(v.items).length && !v.loved.length && !v.disliked.length,
  sanitize(raw) {
    const o = isObj(raw) ? raw : {};
    const items: Record<string, SyncIntent> = {};
    if (isObj(o.items))
      for (const [slug, v] of Object.entries(o.items)) {
        if (!slugOk(slug) || !isObj(v) || !["WANT_TO_GO", "VISITED", "REMOVED"].includes(String(v.status))) continue;
        const fb = FEEDBACK.includes(v.feedback as IntentFeedback) ? (v.feedback as IntentFeedback) : undefined;
        items[slug] = {
          id: typeof v.id === "string" ? v.id.slice(0, 40) : `pi_${slug}`,
          place_id: slug,
          status: v.status as SyncIntent["status"],
          source_type: (typeof v.source_type === "string" ? v.source_type : "PLACE") as SyncIntent["source_type"],
          source_id: typeof v.source_id === "string" ? v.source_id.slice(0, 80) : undefined,
          creator_id: typeof v.creator_id === "string" ? v.creator_id.slice(0, 64) : undefined,
          collection_id: typeof v.collection_id === "string" ? v.collection_id.slice(0, 64) : undefined,
          feedback: fb,
          created_at: typeof v.created_at === "string" ? v.created_at : new Date(0).toISOString(),
          updated_at: typeof v.updated_at === "string" ? v.updated_at : new Date(0).toISOString(),
        };
      }
    return { items, loved: arr<unknown>(o.loved).filter(slugOk), disliked: arr<unknown>(o.disliked).filter(slugOk) };
  },
};

/* ───────── выходы «Поехали!» с оценкой (какие сценарии посетили) ───────── */

const tripsDoc: DocSpec<ListBody<Trip>> = {
  name: "trips",
  read: () => ({ items: useFamily.getState().trips.map((t) => ({ ...t })) }),
  write: (b) => useFamily.setState({ trips: b.items.slice(0, 30) }),
  merge(l, r) {
    const by = new Map<string, Trip>();
    for (const t of [...r.items, ...l.items]) {
      const o = by.get(t.key);
      if (!o || t.goAt > o.goAt || (t.goAt === o.goAt && t.rating && !o.rating)) by.set(t.key, t);
    }
    return { items: [...by.values()].sort((a, b) => b.goAt - a.goAt).slice(0, 30) };
  },
  isEmpty: (v) => !v.items.length,
  sanitize(raw) {
    const items: Trip[] = [];
    for (const v of arr<unknown>(isObj(raw) ? raw.items : [])) {
      if (!isObj(v) || typeof v.key !== "string" || typeof v.title !== "string" || !Array.isArray(v.steps)) continue;
      items.push({
        key: v.key.slice(0, 160),
        title: v.title.slice(0, 160),
        emoji: typeof v.emoji === "string" ? v.emoji.slice(0, 8) : "✨",
        steps: v.steps.filter(slugOk).slice(0, 12),
        goAt: Number(v.goAt) || 0,
        rating: v.rating === 1 || v.rating === 2 || v.rating === 3 ? v.rating : undefined,
        tags: arr<unknown>(v.tags).filter((t): t is string => typeof t === "string").slice(0, 12),
      });
    }
    return { items: items.slice(0, 30) };
  },
};

/* ───────── сохранённые планы-сценарии ───────── */

const plansDoc: DocSpec<ListBody<SavedPlan>> = {
  name: "plans",
  read: () => ({ items: useFamily.getState().savedPlans.map((p) => ({ ...p })) }),
  write: (b) => useFamily.setState({ savedPlans: b.items }),
  merge(l, r) {
    const by = new Map<string, SavedPlan>();
    for (const p of [...r.items, ...l.items]) {
      const o = by.get(p.key);
      if (!o || p.savedAt > o.savedAt) by.set(p.key, p);
    }
    return { items: [...by.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, 100) };
  },
  isEmpty: (v) => !v.items.length,
  sanitize(raw) {
    const items: SavedPlan[] = [];
    for (const v of arr<unknown>(isObj(raw) ? raw.items : [])) {
      if (!isObj(v) || typeof v.key !== "string" || typeof v.title !== "string") continue;
      items.push({
        key: v.key.slice(0, 160),
        title: v.title.slice(0, 160),
        emoji: typeof v.emoji === "string" ? v.emoji.slice(0, 8) : "✨",
        steps: Array.isArray(v.steps) ? v.steps.filter(slugOk).slice(0, 12) : undefined,
        savedAt: Number(v.savedAt) || 0,
      });
    }
    return { items: items.slice(0, 100) };
  },
};

/* ───────── сохранённые чужие подборки (только id и время; сами подборки читаются с сервера) ───────── */

interface SaveRef {
  id: string;
  saved_at: string;
}
const idOk = (s: unknown): s is string => typeof s === "string" && /^[\w-]{1,64}$/.test(s);

const savesDoc: DocSpec<ListBody<SaveRef>> = {
  name: "saves",
  read: () => ({ items: useSocial.getState().saved.map((s) => ({ id: s.id, saved_at: s.saved_at })) }),
  write(b) {
    const cur = useSocial.getState().saved;
    const snap = new Map(cur.map((s) => [s.id, s.snapshot]));
    useSocial.setState({ saved: b.items.map((s) => ({ id: s.id, saved_at: s.saved_at, snapshot: snap.get(s.id) })) });
  },
  merge(l, r) {
    const by = new Map<string, SaveRef>();
    for (const s of [...r.items, ...l.items]) {
      const o = by.get(s.id);
      if (!o || s.saved_at > o.saved_at) by.set(s.id, s);
    }
    return { items: [...by.values()].sort((a, b) => (a.saved_at < b.saved_at ? 1 : -1)).slice(0, 200) };
  },
  isEmpty: (v) => !v.items.length,
  sanitize(raw) {
    return {
      items: arr<unknown>(isObj(raw) ? raw.items : [])
        .filter((v): v is Record<string, unknown> => isObj(v) && idOk(v.id))
        .map((v) => ({ id: String(v.id), saved_at: typeof v.saved_at === "string" ? v.saved_at : new Date(0).toISOString() }))
        .slice(0, 200),
    };
  },
};

/* ───────── подписки на авторов ───────── */

const followsDoc: DocSpec<ListBody<string>> = {
  name: "follows",
  read: () => ({ items: [...useSocial.getState().follows] }),
  write: (b) => useSocial.setState({ follows: b.items }),
  merge: (l, r) => ({ items: uniq([...l.items, ...r.items]).slice(0, 200) }),
  isEmpty: (v) => !v.items.length,
  sanitize: (raw) => ({ items: arr<unknown>(isObj(raw) ? raw.items : []).filter(idOk).slice(0, 200) }),
};

export const DOCS: DocSpec<any>[] = [intentsDoc, tripsDoc, plansDoc, savesDoc, followsDoc]; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Стабильный короткий отпечаток содержимого: сравниваем «что было отправлено» и «что сейчас». */
export function fingerprint(v: unknown): string {
  const s = JSON.stringify(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s.length}:${(h >>> 0).toString(36)}`;
}
