"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

/** Путь «собрать день вокруг этого места»: открывает планировщик с закреплённым местом. */
export const aroundHref = (slug: string) => `/planner?anchor=${encodeURIComponent(slug)}`;

/**
 * «Собрать день вокруг этого места» — с карточки места, из поиска, с карты и с главной.
 * card — крупная кнопка-блок; chip — компактная пилюля для карточек и шторок.
 */
export function AroundLink({ slug, from, variant = "card", className, label }: { slug: string; from: string; variant?: "card" | "chip" | "link"; className?: string; label?: string }) {
  const onClick = () => track("around_place", { slug, from });
  if (variant === "link") {
    return (
      <Link href={aroundHref(slug)} onClick={onClick} className={cn("press hit relative inline-flex h-9 items-center gap-1.5 text-[14px] font-semibold text-purple-ink", className)}>
        <Sparkles size={15} /> {label ?? "Собрать день вокруг"}
      </Link>
    );
  }
  if (variant === "chip") {
    return (
      <Link
        href={aroundHref(slug)}
        onClick={onClick}
        className={cn("press hit relative inline-flex h-10 items-center gap-1.5 rounded-full bg-purple-50 px-3.5 text-[14px] font-semibold text-purple-ink", className)}
      >
        <Sparkles size={16} /> {label ?? "День вокруг этого места"}
      </Link>
    );
  }
  return (
    <Link
      href={aroundHref(slug)}
      onClick={onClick}
      className={cn("press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-purple-50 px-4 text-[16px] font-bold text-purple-ink", className)}
    >
      <Sparkles size={20} /> {label ?? "Собрать день вокруг этого места"}
    </Link>
  );
}
