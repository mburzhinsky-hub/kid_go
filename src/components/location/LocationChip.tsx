"use client";

import { useState } from "react";
import { ChevronDown, LocateFixed, Home, MapPin, Globe2 } from "lucide-react";
import { useFamily } from "@/lib/store";
import { LocationSheet } from "./LocationSheet";
import { cn } from "@/lib/cn";

/** Чип точки выезда в шапке: «📍 Сокольники ▾». */
export function LocationChip({ className, tone = "fill" }: { className?: string; tone?: "fill" | "card" }) {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const [open, setOpen] = useState(false);
  const any = !hydrated || origin.source === "default";
  const Icon = any ? Globe2 : origin.source === "gps" ? LocateFixed : origin.source === "home" ? Home : MapPin;
  const label = any ? "Вся Москва" : origin.source === "home" ? "Дом" : origin.label;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Где ищем: ${label}. Изменить`}
        className={cn(
          "press flex h-10 max-w-[190px] items-center gap-1 rounded-full pl-3 pr-2.5 text-[15px] font-semibold",
          tone === "fill" ? "bg-fill" : "bg-surface shadow-card",
          className
        )}
      >
        <Icon size={15} strokeWidth={2.3} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown size={17} strokeWidth={2.4} className="shrink-0 text-ink-2" />
      </button>
      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
