"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { goBack, useCanGoBack } from "@/lib/nav";
import { cn } from "@/lib/cn";

type Tone = "card" | "light" | "photo" | "float";

const TONE: Record<Tone, string> = {
  /** на обычном фоне экрана */
  card: "h-11 w-11 bg-surface text-ink shadow-card",
  /** на фото или цветной шапке: белая подложка */
  light: "h-11 w-11 bg-white text-ink shadow-card",
  /** поверх фотографии */
  photo: "h-11 w-11 bg-black/35 text-white",
  /** поверх карты, в одну линию с поиском */
  float: "h-12 w-12 bg-white text-ink shadow-float",
};

/** Стрелка «назад» для всех внутренних экранов: возвращает на предыдущий экран приложения или на `fallback`. */
export function BackButton({ fallback = "/", label = "Назад", tone = "card", className, onClick }: { fallback?: string; label?: string; tone?: Tone; className?: string; onClick?: () => void }) {
  const router = useRouter();
  return (
    <button type="button" onClick={onClick ?? (() => goBack(router, fallback))} aria-label={label} className={cn("press grid shrink-0 place-items-center rounded-full", TONE[tone], className)}>
      <ArrowLeft size={24} strokeWidth={2} />
    </button>
  );
}

/** Для экранов-вкладок: стрелка только если пришли «вглубь» (с главной, из карточки и т.п.), а не нажали вкладку внизу. */
export function TabBackButton({ fallback = "/", tone = "card", className }: { fallback?: string; tone?: Tone; className?: string }) {
  const can = useCanGoBack();
  if (!can) return null;
  return <BackButton fallback={fallback} tone={tone} className={className} />;
}
