"use client";

import { useEffect, useState } from "react";
import type { OpeningHours } from "@/lib/types";
import { openState, type OpenState } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Считается на клиенте: статус зависит от текущего времени, не от времени сборки. */
export function OpenStatus({ hours, className }: { hours: OpeningHours; className?: string }) {
  const [state, setState] = useState<OpenState | null>(null);
  useEffect(() => {
    setState(openState(hours));
    const t = setInterval(() => setState(openState(hours)), 60_000);
    return () => clearInterval(t);
  }, [hours]);
  if (!state) return <span className={cn("inline-block h-7 w-36 rounded-full skeleton", className)} />;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold",
        state.open ? "bg-green-50 text-green" : "bg-red-50 text-red",
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", state.open ? "bg-green" : "bg-red")} />
      {state.open
        ? state.always
          ? "Открыто круглосуточно"
          : `Открыто до ${state.closesAt}`
        : state.opensAt
          ? `Закрыто · откроется ${state.tomorrow ? "завтра " : ""}в ${state.opensAt}`
          : "Временно закрыто"}
    </span>
  );
}
