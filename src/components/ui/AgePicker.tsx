"use client";

import { cn } from "@/lib/cn";

const AGES = Array.from({ length: 13 }, (_, i) => i);

/** Возраст одним тапом: «до года», 1 … 12. */
export function AgePicker({ value, onPick, className }: { value?: number | null; onPick: (age: number) => void; className?: string }) {
  return (
    <div className={cn("grid grid-cols-5 gap-2", className)} role="radiogroup" aria-label="Возраст ребёнка">
      {AGES.map((a) => {
        const on = value === a;
        return (
          <button
            key={a}
            role="radio"
            aria-checked={on}
            onClick={() => onPick(a)}
            className={cn(
              "press h-[52px] rounded-[16px] text-[16px] font-bold transition-colors",
              a === 0 && "col-span-2 text-[15px]",
              on ? "bg-pink text-white shadow-pink" : "bg-surface text-ink shadow-card"
            )}
          >
            {a === 0 ? "до года" : a}
          </button>
        );
      })}
    </div>
  );
}
