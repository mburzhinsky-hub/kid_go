"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWantToggle } from "@/components/social/WantButton";

/**
 * Сердечко «Хочу сюда» на карточках. Это намерение, а не лайк: помнит, с какого экрана и из какой подборки оно пришло
 * (источник берётся из контекста экрана). variant=card — белый кружок на фото, overlay — тёмный полупрозрачный.
 */
export function FavoriteButton({
  slug,
  variant = "card",
  className,
}: {
  slug: string;
  variant?: "card" | "overlay" | "plain";
  className?: string;
}) {
  const { want, toggle } = useWantToggle(slug);
  return (
    <button
      type="button"
      aria-label={want ? "Убрать из «Хочу сходить»" : "Хочу сюда"}
      aria-pressed={want}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={cn(
        "press grid place-items-center rounded-full",
        variant === "card" && "h-9 w-9 bg-white/95 text-ink shadow-card",
        variant === "overlay" && "h-11 w-11 bg-black/35 text-white",
        variant === "plain" && "h-11 w-11 bg-fill text-ink",
        className
      )}
    >
      <Heart size={variant === "card" ? 19 : 23} strokeWidth={2} className={cn("transition-transform", want && "animate-pop fill-pink text-pink")} />
    </button>
  );
}
