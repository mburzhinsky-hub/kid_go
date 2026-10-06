"use client";

/**
 * «Хочу сюда» — быстрый переключатель намерения, а не лайк: помнит источник (подборка, карта, приключение…),
 * автора и подборку, которые привели человека. Без регистрации: анонимный id устройства + localStorage.
 */
import { useFamily, type IntentCtx } from "@/lib/store";
import type { IntentFeedback, IntentStatus, PlaceIntent } from "./types";
import { attributionFields } from "./attribution";
import { trackEvent } from "./events";
import type { IntentSourceValue } from "./intent-source";

/** Контекст экрана + привязка к автору, если человек пришёл по его ссылке (окно 30 дней). */
export function resolveCtx(src?: IntentSourceValue): IntentCtx {
  const attr = attributionFields();
  return {
    source_type: src?.source_type ?? "PLACE",
    source_id: src?.source_id,
    creator_id: src?.creator_id ?? attr.creator_id,
    collection_id: src?.collection_id ?? attr.collection_id,
  };
}

/** Переключает «Хочу сюда». Возвращает новое состояние: true — добавили. */
export function toggleWantToGo(slug: string, src?: IntentSourceValue): boolean {
  const st = useFamily.getState();
  const was = st.wantPlaces.includes(slug);
  const ctx = resolveCtx(src);
  st.toggleWant(slug, ctx);
  trackEvent(was ? "place_want_to_go_remove" : "place_want_to_go", { place_id: slug, creator_id: ctx.creator_id, collection_id: ctx.collection_id, source_type: ctx.source_type, source_id: ctx.source_id });
  return !was;
}

export function markPlaceVisited(slug: string, src?: IntentSourceValue) {
  const st = useFamily.getState();
  if (st.visitedPlaces.includes(slug)) return;
  const ctx = resolveCtx(src);
  st.markVisited(slug, ctx);
  trackEvent("place_visited", { place_id: slug, creator_id: ctx.creator_id, collection_id: ctx.collection_id, source_type: ctx.source_type });
}

export function removeIntent(slug: string) {
  useFamily.getState().clearIntent(slug);
}

export function rateVisited(slug: string, feedback: IntentFeedback | undefined) {
  useFamily.getState().setIntentFeedback(slug, feedback);
}

/** Состояние намерения для карточки. До гидрации — «нет», чтобы не мигало. */
export function useIntent(slug: string): { status?: IntentStatus; want: boolean; visited: boolean; intent?: PlaceIntent } {
  const hydrated = useFamily((s) => s.hydrated);
  const intent = useFamily((s) => s.intents[slug]);
  const status = hydrated ? intent?.status : undefined;
  return { status, want: status === "WANT_TO_GO", visited: status === "VISITED", intent: hydrated ? intent : undefined };
}

/** Причина, по которой место в хотелках — для подписи «из подборки …» в Избранном. */
export const intentFromCollection = (i?: PlaceIntent) => (i && i.collection_id ? i.collection_id : undefined);
