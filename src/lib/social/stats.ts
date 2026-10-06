/**
 * Кабинет автора: сводка из журнала событий. Главная метрика — сколько людей захотели сходить в места благодаря подборке.
 * Источник — тот же журнал, который в проде приходит с сервера (NEXT_PUBLIC_EVENTS_URL); формулы от этого не меняются.
 * Задел под B2B-партнёров: те же агрегаты по place_id (просмотры, «хочу сюда», маршруты, клики по билетам).
 */
import type { AnalyticsEvent, CollectionStats, PlaceInterest } from "./types";

export const EMPTY_STATS: CollectionStats = { views: 0, saves: 0, shares: 0, placeOpens: 0, wantToGo: 0, appClicks: 0, maps: 0 };

type Match = (e: AnalyticsEvent) => boolean;

export const byCollection = (id: string): Match => (e) => e.collection_id === id;
export const byCreator = (id: string): Match => (e) => e.creator_id === id;

/** Уникальный «вклад» человека: повторные «хочу» и «убрал» не раздувают число — считаем чистый итог по человеку и месту. */
function netWant(events: AnalyticsEvent[]) {
  const byKey = new Map<string, { place: string; n: number }>();
  for (const e of events) {
    if (e.event_name !== "place_want_to_go" && e.event_name !== "place_want_to_go_remove") continue;
    const k = `${e.anonymous_id}|${e.place_id}|${e.collection_id ?? ""}`;
    const cur = byKey.get(k) ?? { place: e.place_id ?? "", n: 0 };
    cur.n = e.event_name === "place_want_to_go" ? 1 : 0; // последнее действие побеждает
    byKey.set(k, cur);
  }
  return [...byKey.values()].filter((x) => x.n > 0);
}

export function statsOf(events: AnalyticsEvent[], match: Match): CollectionStats {
  const ev = events.filter(match);
  const count = (n: AnalyticsEvent["event_name"]) => ev.filter((e) => e.event_name === n).length;
  const saved = new Map<string, number>();
  for (const e of ev) {
    if (e.event_name === "collection_save") saved.set(e.anonymous_id + e.collection_id, 1);
    if (e.event_name === "collection_unsave") saved.delete(e.anonymous_id + e.collection_id);
  }
  return {
    views: count("collection_view"),
    saves: saved.size,
    shares: count("collection_share"),
    placeOpens: count("collection_place_open"),
    wantToGo: netWant(ev).length,
    appClicks: count("collection_app_open_click") + count("collection_app_install_click"),
    maps: count("collection_map_open"),
  };
}

/** «Какие места заинтересовали аудиторию»: рейтинг по «Хочу сюда», затем по открытиям. */
export function placeInterest(events: AnalyticsEvent[], match: Match): PlaceInterest[] {
  const ev = events.filter(match);
  const map = new Map<string, PlaceInterest>();
  const get = (id: string) => {
    let v = map.get(id);
    if (!v) map.set(id, (v = { place_id: id, want: 0, opens: 0 }));
    return v;
  };
  for (const w of netWant(ev)) get(w.place).want++;
  for (const e of ev) if (e.event_name === "collection_place_open" && e.place_id) get(e.place_id).opens++;
  return [...map.values()].sort((a, b) => b.want - a.want || b.opens - a.opens);
}

/** Атрибутированные «хочу сюда» вне страницы подборки: человек пришёл по ссылке автора, а захотел на другом экране. */
export function attributedWants(events: AnalyticsEvent[], collectionId: string) {
  return events.filter((e) => e.event_name === "place_want_to_go" && e.properties.attributed_collection_id === collectionId && e.collection_id !== collectionId).length;
}

export function totalsOf(events: AnalyticsEvent[], ids: string[]): CollectionStats {
  const set = new Set(ids);
  return statsOf(events, (e) => !!e.collection_id && set.has(e.collection_id));
}
