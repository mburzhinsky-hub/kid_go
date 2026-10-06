"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function ReadMore({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180;
  return (
    <div>
      <p className={cn("text-[17px] leading-[1.5] text-ink-2", !open && long && "line-clamp-4")} style={!open && long ? { WebkitLineClamp: lines } : undefined}>
        {text}
      </p>
      {long && (
        <button onClick={() => setOpen((v) => !v)} className="press hit relative mt-1.5 inline-flex items-center gap-1 text-[16px] font-medium text-blue-ink">
          {open ? "Свернуть" : "Читать полностью"}
          <ChevronDown size={20} strokeWidth={2} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
