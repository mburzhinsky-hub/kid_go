"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CalendarPlus, CalendarCheck, ChevronRight } from "lucide-react";
import { useFamily } from "@/lib/store";
import { useSocial } from "@/lib/social/store";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { WantButton, InviteFriends, VisitedControl, WantProof } from "@/components/social/WantButton";
import type { Photo } from "@/lib/types";

/** Нижняя панель экрана: фиксированная, с учётом «чёлки» и кнопки «домой». */
export function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-5">
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  );
}

/**
 * Страница места: главная кнопка — «Хочу сюда» (мгновенный переключатель, без окон), рядом «В наш день».
 * Всё остальное — «Мы уже были», «Позвать друзей» — в PlaceIntentRow под заголовком.
 */
export function PlaceCTA({ slug, title }: { slug: string; title: string; lat?: number; lng?: number }) {
  const inDay = useFamily((s) => s.hydrated && s.day.includes(slug));
  const addToDay = useFamily((s) => s.addToDay);
  const toast = useToast((s) => s.show);

  // «Недавно смотрели» — для выбора мест в конструкторе подборки
  useEffect(() => {
    useSocial.getState().pushRecent(slug);
  }, [slug]);

  return (
    <StickyBar>
      <WantButton slug={slug} size="lg" className="min-w-0 flex-1" />
      {inDay ? (
        <Link href="/day" aria-label={`Наш день: ${title}`} className="press inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[16px] font-bold text-green-ink shadow-card">
          <CalendarCheck size={24} /> В дне <ChevronRight size={16} className="-ml-1 text-muted-2" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            addToDay([slug]);
            track("place_add_to_day", { slug });
            toast("Добавили в наш день 💛", { label: "Открыть", href: "/day" });
          }}
          className="press inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[16px] font-bold text-ink shadow-card"
        >
          <CalendarPlus size={24} className="text-pink-ink" /> В наш день
        </button>
      )}
    </StickyBar>
  );
}

/** Под заголовком места: «Мы уже были», «Позвать друзей», честный счётчик «N семей хотят сюда» (если есть данные). */
export function PlaceIntentRow({ slug, title, subtitle, photo, tint, emoji }: { slug: string; title: string; subtitle: string; photo: Photo; tint: string; emoji: string }) {
  const place = { slug, title, subtitle, photos: [photo], tint, emoji };
  return (
    <div className="mt-4">
      <WantProof slug={slug} className="mb-2" />
      <div className="flex flex-wrap items-start gap-2">
        <VisitedControl slug={slug} />
        <InviteFriends place={place as never} always />
      </div>
    </div>
  );
}

export function StickyCTA({
  children,
  onClick,
  href,
  icon,
  secondary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  const cls = "press flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink";
  return (
    <StickyBar>
      {secondary}
      {href ? (
        <Link href={href} className={cls} onClick={onClick}>
          {icon}
          {children}
        </Link>
      ) : (
        <button className={cls} onClick={onClick}>
          {icon}
          {children}
        </button>
      )}
    </StickyBar>
  );
}
