"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useFamily } from "@/lib/store";

/** Пока семья не рассказала о себе — мягко предлагаем (в демо стоят Миша и Аня). */
export function OnboardingNudge() {
  const show = useFamily((s) => s.hydrated && !s.onboarded);
  if (!show) return null;
  return (
    <Link href="/onboarding" className="press mx-4 mt-7 flex items-center gap-3 rounded-[22px] bg-yellow-50 p-3.5 ring-1 ring-[#ffe7a3]">
      <span className="text-[30px]">👋</span>
      <span className="flex-1">
        <span className="block text-[15.5px] font-bold leading-tight">Расскажите о своих детях</span>
        <span className="block text-[13px] text-ink-2">Сейчас подборки собраны для демо-семьи Миши и Ани</span>
      </span>
      <ArrowRight size={20} className="text-[#b07d00]" />
    </Link>
  );
}
