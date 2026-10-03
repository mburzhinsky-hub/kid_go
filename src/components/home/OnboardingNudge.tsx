"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useFamily } from "@/lib/store";

/** Есть дети, но нет интересов — подсказываем, как сделать подборки точнее. */
export function OnboardingNudge() {
  const show = useFamily((s) => s.hydrated && s.children.length > 0 && s.children.every((c) => !c.interests.length));
  if (!show) return null;
  return (
    <Link href="/profile" className="press mx-4 mt-7 flex items-center gap-3 rounded-[22px] bg-yellow-50 p-3.5 ring-1 ring-[#ffe7a3]">
      <span className="text-[30px]">🦖</span>
      <span className="flex-1">
        <span className="block text-[15.5px] font-bold leading-tight">Что любит ваш ребёнок?</span>
        <span className="block text-[13px] text-ink-2">Динозавры, космос, животные — добавьте интересы, и подборки станут точнее</span>
      </span>
      <ArrowRight size={20} className="text-[#b07d00]" />
    </Link>
  );
}
