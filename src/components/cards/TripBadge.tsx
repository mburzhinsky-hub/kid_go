"use client";

import { useFamily } from "@/lib/store";
import { fromMoscowLabel } from "@/lib/format";
import { travelMinutes } from "@/lib/geo";
import { cn } from "@/lib/cn";

/** «🚗 ~85 мин от Москвы» — для готовых выездов за город; зависит от того, на чём едут. */
export function TripBadge({ km, className }: { km: number; className?: string }) {
  const transport = useFamily((s) => s.transport);
  const mode = transport === "car" ? "car" : "transit";
  return <span className={cn("text-[13px] font-semibold leading-snug text-purple-ink", className)}>{fromMoscowLabel(travelMinutes(km, mode), mode)}</span>;
}
