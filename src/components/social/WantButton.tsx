"use client";

import { Heart, UserPlus, ThumbsUp, ThumbsDown, Meh, CheckCircle2 } from "lucide-react";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useFamily } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { useIntent, toggleWantToGo, markPlaceVisited, removeIntent, rateVisited, resolveCtx } from "@/lib/social/intents";
import { useIntentSource, type IntentSourceValue } from "@/lib/social/intent-source";
import { detectEnv } from "@/lib/social/app";
import { getUserId } from "@/lib/social/identity";
import { placeInviteText, placeUrl, siteOrigin } from "@/lib/social/share";
import { useSocialUi } from "@/lib/social/ui-store";
import { useWantCount } from "@/lib/social/proof";
import type { IntentFeedback } from "@/lib/social/types";
import { plural } from "@/lib/format";

/**
 * После «Хочу сюда»: понятное подтверждение без модальных окон.
 * Человеку без аккаунта в обычном браузере (один раз за сессию) мягко предлагаем сохранить хотелки в приложении.
 */
export function wantFeedback(added: boolean, src?: IntentSourceValue) {
  const toast = useToast.getState().show;
  if (!added) return toast("Убрали из хотелок");
  const env = detectEnv();
  let offered = false;
  try {
    offered = !!sessionStorage.getItem("kg-app-offer");
  } catch {
    /* noop */
  }
  if (!env.standalone && !getUserId() && !offered) {
    try {
      sessionStorage.setItem("kg-app-offer", "1");
    } catch {
      /* noop */
    }
    const ctx = resolveCtx(src);
    return toast("Добавили в ваши хотелки ❤️", {
      label: "Сохранить в приложении",
      onClick: () => useSocialUi.getState().openInstall(`${siteOrigin()}/favorites/`, { creator_id: ctx.creator_id, collection_id: ctx.collection_id }),
    });
  }
  toast("Добавили в ваши хотелки ❤️", { label: "Смотреть", href: "/favorites?tab=want" });
}

/** Переключатель «Хочу сюда» с учётом источника экрана. */
export function useWantToggle(slug: string, override?: IntentSourceValue) {
  const ctx = useIntentSource();
  const { want, visited } = useIntent(slug);
  const src = override ?? ctx;
  return {
    want,
    visited,
    toggle: () => wantFeedback(toggleWantToGo(slug, src), src),
  };
}

/** Главная кнопка «Хочу сюда»: ♡ → ♥ «В хотелках». Мгновенно, без окон. */
export function WantButton({ slug, size = "md", className, source, label = "Хочу сюда" }: { slug: string; size?: "lg" | "md"; className?: string; source?: IntentSourceValue; label?: string }) {
  const { want, toggle } = useWantToggle(slug, source);
  const hydrated = useFamily((s) => s.hydrated);
  return (
    <button
      type="button"
      aria-pressed={want}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={cn(
        "press inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors",
        size === "lg" ? "h-14 text-[18px]" : "h-12 text-[16px]",
        want ? "bg-pink-50 text-pink-ink ring-1 ring-pink/25" : "bg-pink text-white shadow-pink",
        !hydrated && "opacity-90",
        className
      )}
    >
      <Heart size={size === "lg" ? 24 : 20} strokeWidth={2} className={cn(want && "animate-pop fill-pink")} />
      {want ? "В хотелках" : label}
    </button>
  );
}

/** «Позвать друзей» — третий контур роста: ссылка на место с привязкой к автору, который привёл. */
export function openInvite(place: Pick<Place, "slug" | "title" | "subtitle" | "photos" | "tint" | "emoji">, src?: IntentSourceValue) {
  const ctx = resolveCtx(src);
  const ids = { place_id: place.slug, creator_id: ctx.creator_id, collection_id: ctx.collection_id };
  useSocialUi.getState().openShare({
    kind: "place",
    heading: "Позвать друзей",
    text: placeInviteText(),
    buildUrl: (utm) => placeUrl(place.slug, utm, { creator_id: ctx.creator_id, collection_id: ctx.collection_id }),
    preview: { tile: { photo: place.photos[0], tint: place.tint, emoji: place.emoji }, title: place.title, subtitle: "Хотим сходить сюда с детьми 👋" },
    ids,
  });
}

export function InviteFriends({ place, className, always, short }: { place: Place; className?: string; always?: boolean; short?: boolean }) {
  const ctx = useIntentSource();
  const { want } = useIntent(place.slug);
  if (!want && !always) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openInvite(place, ctx);
      }}
      className={cn("press hit relative inline-flex h-10 items-center gap-1.5 rounded-full bg-blue-50 px-3.5 text-[15px] font-semibold text-blue-ink animate-rise", className)}
    >
      <UserPlus size={16} /> {short ? "Позвать" : "Позвать друзей"}
    </button>
  );
}

/** «127 семей хотят сюда» — только если сервер вернул настоящее число; иначе ничего. */
export function WantProof({ slug, className }: { slug: string; className?: string }) {
  const n = useWantCount(slug);
  if (!n) return null;
  return <p className={cn("text-[14px] font-medium text-muted", className)}>👨‍👩‍👧 {n.toLocaleString("ru-RU")} {plural(n, "семья хочет", "семьи хотят", "семей хотят")} сюда</p>;
}

const FEEDBACK: { id: IntentFeedback; label: string; Icon: typeof ThumbsUp }[] = [
  { id: "LIKE", label: "Да", Icon: ThumbsUp },
  { id: "OK", label: "Нормально", Icon: Meh },
  { id: "DISLIKE", label: "Не очень", Icon: ThumbsDown },
];

/** «Понравилось?» — необязательная оценка посещённого места; учитывается в рекомендациях. */
export function FeedbackRow({ slug, className, compact }: { slug: string; className?: string; compact?: boolean }) {
  const { intent } = useIntent(slug);
  const buttons = FEEDBACK.map(({ id, label, Icon }) => (
    <button
      key={id}
      aria-pressed={intent?.feedback === id}
      aria-label={label}
      onClick={() => rateVisited(slug, intent?.feedback === id ? undefined : id)}
      className={cn("press inline-flex items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold", compact ? "h-10 w-12" : "h-10 px-3.5", intent?.feedback === id ? "bg-ink text-white" : "bg-fill text-ink")}
    >
      <Icon size={compact ? 20 : 16} /> {!compact && label}
    </button>
  ));
  if (compact)
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <p className="mr-auto text-[14px] font-semibold">Понравилось?</p>
        {buttons}
      </div>
    );
  return (
    <div className={className}>
      <p className="text-[14px] font-semibold">Понравилось?</p>
      <div className="mt-1.5 flex flex-wrap gap-2">{buttons}</div>
    </div>
  );
}

/** «Мы уже были» + необязательное «Понравилось?». */
export function VisitedControl({ slug, className, askFeedback = true }: { slug: string; className?: string; askFeedback?: boolean }) {
  const ctx = useIntentSource();
  const { visited } = useIntent(slug);
  if (!visited)
    return (
      <button
        type="button"
        onClick={() => {
          markPlaceVisited(slug, ctx);
          useToast.getState().show("Отметили: уже были ✅");
        }}
        className={cn("press hit relative inline-flex h-10 items-center gap-1.5 rounded-full bg-green-50 px-3.5 text-[15px] font-semibold text-green-ink", className)}
      >
        <CheckCircle2 size={16} /> Мы уже были
      </button>
    );
  return (
    <div className={cn("animate-rise", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-green-50 px-3.5 text-[15px] font-semibold text-green-ink">
          <CheckCircle2 size={16} /> Были здесь
        </span>
        <button onClick={() => removeIntent(slug)} className="press hit relative h-10 rounded-full px-2 text-[14px] font-medium text-muted">
          Отменить
        </button>
      </div>
      {askFeedback && <FeedbackRow slug={slug} className="mt-2.5" />}
    </div>
  );
}
