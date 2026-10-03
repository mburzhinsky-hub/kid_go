"use client";

import { cn } from "@/lib/cn";

export function FilterChip({
  active,
  onClick,
  children,
  className,
  size = "md",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14.5px]",
        active ? "bg-ink text-white shadow-card" : "bg-white text-ink shadow-card",
        className
      )}
    >
      {children}
    </button>
  );
}
