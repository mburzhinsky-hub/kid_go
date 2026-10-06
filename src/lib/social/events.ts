"use client";

/**
 * Журнал событий роста. Каждое событие — AnalyticsEvent из модели: пользователь/аноним, автор, подборка, место,
 * источник/канал/кампания, город, время, платформа (web/app).
 * Пишется локально (откуда считается кабинет автора), дублируется в PostHog, если подключён,
 * и уходит на NEXT_PUBLIC_EVENTS_URL (sendBeacon), когда у приложения появится сервер.
 */
import { useSyncExternalStore } from "react";
import type { AnalyticsEvent, EventName } from "./types";
import { getAnonId, getUserId, platform } from "./identity";
import { attributionFields } from "./attribution";
import { track } from "@/lib/analytics";
import { useFamily } from "@/lib/store";

const KEY = "kidgo-events";
const MAX = 3000;

let mem: AnalyticsEvent[] | undefined;
const subs = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function read(): AnalyticsEvent[] {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(KEY) ?? "[]") as AnalyticsEvent[];
  } catch {
    mem = [];
  }
  return mem;
}

function persistSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(read()));
    } catch {
      /* квота — журнал не критичен */
    }
  }, 250);
}

type Props = Record<string, string | number | boolean | undefined>;

export function trackEvent(
  name: EventName,
  ids: { creator_id?: string; collection_id?: string; place_id?: string } & Props = {}
): AnalyticsEvent | undefined {
  if (typeof window === "undefined") return undefined;
  const { creator_id, collection_id, place_id, ...rest } = ids;
  const attr = attributionFields();
  const city = useFamily.getState().city;
  const e: AnalyticsEvent = {
    id: `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    event_name: name,
    user_id: getUserId(),
    anonymous_id: getAnonId(),
    creator_id: creator_id ?? attr.creator_id,
    collection_id: collection_id ?? attr.collection_id,
    place_id,
    properties: {
      ...rest,
      source: attr.utm_source,
      medium: attr.utm_medium,
      campaign: attr.utm_campaign,
      city,
      platform: platform(),
      // автор, который привёл человека, даже если событие произошло на другом экране
      attributed_creator_id: attr.creator_id,
      attributed_collection_id: attr.collection_id,
    },
    created_at: new Date().toISOString(),
  };
  const list = read();
  list.push(e);
  if (list.length > MAX) list.splice(0, list.length - MAX);
  version++;
  persistSoon();
  subs.forEach((s) => s());
  track(name, { ...flat(e.properties), creator_id: e.creator_id, collection_id: e.collection_id, place_id: e.place_id });
  const url = process.env.NEXT_PUBLIC_EVENTS_URL;
  if (url) {
    try {
      navigator.sendBeacon?.(url, new Blob([JSON.stringify(e)], { type: "application/json" }));
    } catch {
      /* noop */
    }
  }
  return e;
}

const flat = (p: Props) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Props;

export function readEvents(): AnalyticsEvent[] {
  return typeof window === "undefined" ? [] : read();
}

const EMPTY: AnalyticsEvent[] = [];
let snapshotVersion = -1;
let snapshot: AnalyticsEvent[] = EMPTY;

/** Живой список событий для кабинета автора. */
export function useEvents(): AnalyticsEvent[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => {
      if (snapshotVersion !== version) {
        snapshotVersion = version;
        snapshot = [...read()];
      }
      return snapshot;
    },
    () => EMPTY
  );
}

/** Первая загрузка из localStorage уже после гидрации. */
export function warmEvents() {
  if (typeof window === "undefined") return;
  mem = undefined;
  read();
  version++;
  subs.forEach((s) => s());
}
