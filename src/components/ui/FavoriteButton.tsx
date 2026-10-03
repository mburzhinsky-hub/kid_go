"use client";

import { Heart } from "lucide-react";
import { useFamily } from "@/lib/store";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics";

/** Сердечко «Хотим сходить». variant=card — белый кружок на фото, overlay — тёмный полупрозрачный. */
export function FavoriteButton({
  slug,
  variant = "card",
  className,
}: {
  slug: string;
  variant?: "card" | "overlay" | "plain";
  className?: string;
}) {
  const active = useFamily((s) => s.hydrated && s.wantPlaces.includes(slug));
  const toggle = useFamily((s) => s.toggleWant);
  return (
    <button
      type="button"
      aria-label={active ? "Убрать из «Хотим сходить»" : "Добавить в «Хотим сходить»"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
        track(active ? "favorite_remove" : "favorite_add", { slug });
      }}
      className={cn(
        "press grid place-items-center rounded-full",
        variant === "card" && "h-9 w-9 bg-white/95 text-ink shadow-card",
        variant === "overlay" && "h-11 w-11 bg-black/35 text-white",
        variant === "plain" && "h-11 w-11 bg-fill text-ink",
        className
      )}
    >
      <Heart
        size={variant === "card" ? 19 : 23}
        strokeWidth={2}
        className={cn("transition-transform", active && "animate-pop fill-pink text-pink")}
      />
    </button>
  );
}
