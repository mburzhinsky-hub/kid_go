import { cn } from "@/lib/cn";
import type { AuthorRef } from "@/lib/social/types";

/** Круглый аватар автора: эмодзи на цветной подложке (как аватары детей в профиле). */
export function CreatorAvatar({ author, size = 40, className, ring }: { author: Pick<AuthorRef, "avatar" | "tint" | "name">; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      role="img"
      aria-label={author.name}
      className={cn("grid shrink-0 place-items-center rounded-full leading-none", ring && "ring-[3px] ring-white shadow-card", className)}
      style={{ width: size, height: size, background: author.tint, fontSize: Math.round(size * 0.54) }}
    >
      {author.avatar}
    </span>
  );
}

/** Метка «Автор подборок» — без галочек «проверено»: доверие строим на содержимом, а не на значке. */
export function CreatorBadge({ className, label = "Автор подборок" }: { className?: string; label?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full bg-purple-50 px-2.5 text-[12px] font-semibold text-purple-ink", className)}>{label}</span>;
}
