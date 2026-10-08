"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useFamily } from "@/lib/store";
import { locationMode } from "@/lib/location";
import { kidLabel } from "@/lib/format";
import { GeoScope } from "@/components/location/GeoScope";

/**
 * Главное действие главной: «Собрать наш день». Всё остальное (поиск, карта, каталог) — вторично.
 * Над кнопкой — видимый выбор «Москва / Москва + область», под текстом — дети из профиля.
 */
export function HomeCta() {
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const origin = useFamily((s) => s.origin);
  const geoScope = useFamily((s) => s.geoScope);
  const region = locationMode(origin) === "any" && geoScope === "moscow-region";
  const who = kids.map(kidLabel).join(" · ");
  return (
    <section aria-labelledby="home-cta-title" className="px-4">
      <GeoScope where="home" />
      <div
        className="relative mt-3 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_16px_32px_-14px_rgba(139,61,240,0.6)]"
        style={{ background: "linear-gradient(125deg,#FF2E88 0%,#B23CF0 55%,#6A3DF5 100%)" }}
      >
        <svg aria-hidden className="absolute -right-8 -top-10 h-44 w-44 opacity-20 animate-spin-slow" viewBox="0 0 100 100">
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x="47" y="2" width="6" height="22" rx="3" fill="#fff" transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </svg>
        <span className="absolute right-5 top-4 text-[38px] animate-bob" aria-hidden>
          🎈
        </span>
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-black/20 px-2.5 text-[13px] font-semibold">
          <Sparkles size={14} /> 3 готовых варианта дня
        </span>
        <h2 id="home-cta-title" className="tight mt-3 max-w-[260px] text-[28px] font-[850] leading-[1.05]">
          Что будем делать сегодня?
        </h2>
        <p className="mt-2 max-w-[290px] text-[15px] leading-snug text-white/90">
          {hydrated && who ? `Учтём: ${who}. ` : ""}
          Куда пойти, где поесть и как ехать — одним маршрутом, за полминуты.
        </p>
        {region && <p className="mt-1.5 max-w-[290px] text-[13px] leading-snug text-white/80">С областью: на полдня и дольше предложим выезд за город.</p>}
        <Link href="/planner" className="press mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-white pl-5 pr-4 text-[17px] font-bold text-pink-ink">
          Собрать наш день <ArrowRight size={20} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}
