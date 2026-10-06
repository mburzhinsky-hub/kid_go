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
        "press hit relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors",
        size === "sm" ? "h-9 px-3.5 text-[14px]" : "h-10 px-4 text-[15px]",
        active ? "bg-ink text-white shadow-card" : "bg-white text-ink shadow-card",
        className
      )}
    >
      {children}
    </button>
  );
}
