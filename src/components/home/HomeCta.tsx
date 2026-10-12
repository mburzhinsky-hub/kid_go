"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useFamily } from "@/lib/store";
import { locationMode } from "@/lib/location";
import { kidLabel } from "@/lib/format";
import { GeoScope } from "@/components/location/GeoScope";
import { RouteArt, runRouteBurst, useRouteAnimation } from "./RouteArt";

/**
 * Главное действие главной: «Собрать наш день». Всё остальное (поиск, карта, каталог) — вторично.
 * Над кнопкой — видимый выбор «Москва / Москва + область». Справа — маленький анимированный маршрут (RouteArt).
 * Дети из профиля и охват «с областью» подмешиваются в то же описание, без лишних строк: высота блока не прыгает.
 */
export function HomeCta() {
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const origin = useFamily((s) => s.origin);
  const geoScope = useFamily((s) => s.geoScope);
  const region = locationMode(origin) === "any" && geoScope === "moscow-region";
  const who = kids.map(kidLabel).join(" · ");
  const { ref, phase } = useRouteAnimation();

  const lead = hydrated && who ? `Учтём: ${who}. ` : "";
  const text = lead
    ? `${lead}${region ? "Места, еда и маршрут — и за городом." : "Подберём места, еду и маршрут."}`
    : region
      ? "Подберём места, еду и маршрут для всей семьи — в том числе с выездом за город."
      : "Подберём интересные места, вкусную еду и удобный маршрут для всей семьи.";

  return (
    <section aria-labelledby="home-cta-title" className="px-4">
      <GeoScope where="home" />
      <div ref={ref} data-s={phase} className="kgr kgr-card relative mt-3 flex min-h-[276px] flex-col overflow-hidden rounded-[28px] px-[18px] pb-[18px] pt-4 animate-rise">
        <RouteArt />
        <span className="relative z-10 inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-purple/10 px-2.5 text-[13px] font-bold text-purple-ink">
          <Sparkles size={14} strokeWidth={2.4} aria-hidden /> Идеи для семейного дня
        </span>
        <h2 id="home-cta-title" className="tight relative z-10 mt-3 text-[26px] font-[850] leading-[1.06] text-ink max-[349px]:max-w-[9.5rem] min-[375px]:text-[27px]">
          Куда отправимся <span className="kgr-grad block">сегодня?</span>
        </h2>
        <p className="relative z-10 mb-2 mt-2 max-w-[min(12.25rem,64%)] text-pretty text-[14px] leading-[1.38] text-ink-2">{text}</p>
        <Link
          href="/planner"
          onPointerDown={(e) => {
            if (e.button === 0) runRouteBurst(ref.current);
          }}
          onPointerCancel={() => ref.current?.removeAttribute("data-go")}
          onClick={(e) => {
            if (e.detail === 0) runRouteBurst(ref.current); // с клавиатуры pointerdown не бывает
          }}
          className="kgr-btn press relative z-10 mt-auto inline-flex h-12 w-fit items-center gap-2 rounded-full pl-[18px] pr-3.5 text-[16px] font-bold text-white max-[349px]:h-11 max-[349px]:pl-4 max-[349px]:pr-3 max-[349px]:text-[15px]"
        >
          Собрать наш день <ArrowRight size={19} strokeWidth={2.6} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
