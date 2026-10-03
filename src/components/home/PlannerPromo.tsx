"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { useFamily } from "@/lib/store";
import { plural } from "@/lib/format";

export function PlannerPromo() {
  const kids = useFamily((s) => s.children);
  const names = kids.map((k) => k.name).join(" и ");
  return (
    <Link
      href="/planner"
      className="press relative mx-4 block overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_32px_-14px_rgba(139,61,240,0.6)]"
      style={{ background: "linear-gradient(125deg,#FF2E88 0%,#B23CF0 55%,#6A3DF5 100%)" }}
    >
      <svg aria-hidden className="absolute -right-6 -top-8 h-44 w-44 opacity-25 animate-spin-slow" viewBox="0 0 100 100">
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x="47" y="2" width="6" height="22" rx="3" fill="#fff" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </svg>
      <span className="absolute right-5 top-5 text-[40px] animate-bob">🎈</span>
      <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[12.5px] font-semibold">
        <Sparkles size={13} /> Планировщик
      </span>
      <h3 className="tight mt-3 text-[26px] font-[850] leading-[1.05]">
        Придумаем
        <br />
        ваш день ✨
      </h3>
      <p className="mt-2 max-w-[250px] text-[14.5px] leading-snug text-white/90">
        {kids.length
          ? `Учтём возраст и интересы: ${names} — ${kids.length} ${plural(kids.length, "ребёнок", "ребёнка", "детей")}.`
          : "Настроение, время и бюджет — остальное сделаем мы."}
      </p>
      <span className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white pl-5 pr-4 text-[15.5px] font-bold text-pink">
        Собрать день за 30 секунд <ArrowRight size={18} strokeWidth={2.4} />
      </span>
    </Link>
  );
}
