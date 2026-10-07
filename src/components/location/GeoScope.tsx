"use client";

import { useState } from "react";
import { useFamily } from "@/lib/store";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import type { GeoScope as GeoScopeId } from "@/lib/types";
import { MapPin } from "lucide-react";
import { LocationChip } from "./LocationChip";
import { LocationSheet } from "./LocationSheet";

const OPTIONS: { id: GeoScopeId; label: string }[] = [
  { id: "moscow", label: "Москва" },
  { id: "moscow-region", label: "Москва + область" },
];

/**
 * Видимый и постоянный выбор географии: «Москва» или «Москва + область».
 * Хранится в профиле семьи и одинаков на главной, в планировщике, сценариях, поиске, карте и результатах.
 * Если человек выбрал точку или округ — показываем её (она важнее общего охвата), по тапу открывается выбор.
 */
export function GeoScope({ className, where, size = "md" }: { className?: string; where?: string; size?: "sm" | "md" }) {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const geoScope = useFamily((s) => s.geoScope);
  const setPrefs = useFamily((s) => s.setPrefs);

  const [open, setOpen] = useState(false);

  if (hydrated && origin.source !== "default") return <LocationChip tone="card" className={className} />;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div role="radiogroup" aria-label="Где ищем" className="inline-flex rounded-full bg-fill p-1">
        {OPTIONS.map((o) => {
          const on = geoScope === o.id;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (on) return;
                track("geo_scope_set", { scope: o.id, where });
                setPrefs({ geoScope: o.id });
              }}
              className={cn(
                "press hit relative inline-flex items-center justify-center rounded-full font-semibold transition-colors",
                size === "sm" ? "h-9 px-3 text-[14px]" : "h-10 px-3.5 text-[15px]",
                on ? (o.id === "moscow-region" ? "bg-purple-ink text-white shadow-card" : "bg-ink text-white shadow-card") : "text-ink-2"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {/* точный район или адрес — по-прежнему в один тап (раньше жил в шапке) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Где ищем: указать район или адрес"
        className={cn("press hit relative grid shrink-0 place-items-center rounded-full bg-fill text-ink-2", size === "sm" ? "h-9 w-9" : "h-10 w-10")}
      >
        <MapPin size={size === "sm" ? 16 : 18} strokeWidth={2} />
      </button>
      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
