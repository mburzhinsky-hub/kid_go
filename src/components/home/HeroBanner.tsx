"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  photo: Photo;
  tint: string;
  emoji: string;
  overlay: string;
  doodle?: "crown" | "rain" | "dino" | "star";
}

export function HeroBanner({ slides }: { slides: HeroSlide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    const timer = setInterval(() => {
      if (paused.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5500);
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearInterval(timer);
    };
  }, [slides.length]);

  return (
    <section aria-roledescription="carousel" aria-label="Идеи на выходные" className="relative px-4">
      <div
        ref={ref}
        onPointerDown={() => (paused.current = true)}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[26px] shadow-card"
      >
        {slides.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            className="relative block aspect-[16/10.4] w-full shrink-0 snap-center overflow-hidden"
            aria-roledescription="slide"
            aria-label={`${i + 1} из ${slides.length}: ${s.title}`}
          >
            <SmartImage
              photo={s.photo}
              tint={s.tint}
              emoji={s.emoji}
              sizes="(max-width: 480px) 100vw, 448px"
              priority={i === 0}
              quality={75}
              className="absolute inset-0"
            />
            <div className="absolute inset-0" style={{ background: s.overlay }} />
            <Doodle kind={s.doodle} />
            <div className="absolute inset-y-0 left-0 flex w-[66%] flex-col justify-center gap-2 pl-5 pr-2">
              <h2 className="tight max-w-[235px] text-[31px] font-[850] leading-[1.02] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
                {s.title}
              </h2>
              <p className="max-w-[220px] text-[15.5px] font-medium leading-snug text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.3)]">
                {s.subtitle}
              </p>
              <span className="mt-2 inline-flex h-11 w-max items-center gap-2 rounded-full bg-pink pl-5 pr-4 text-[15.5px] font-semibold text-white shadow-pink">
                {s.cta} <ArrowRight size={19} strokeWidth={2.3} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <span
            key={s.id}
            className={cn("h-[7px] rounded-full bg-white transition-all duration-300", i === index ? "w-[18px]" : "w-[7px] opacity-70")}
          />
        ))}
      </div>
    </section>
  );
}

/** Рисованные белые каракули поверх фото — как корона и сердечко в референсе. */
function Doodle({ kind = "crown" }: { kind?: HeroSlide["doodle"] }) {
  const common = { fill: "none", strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
      {kind === "crown" && (
        <>
          <path d="M228 50l9 26 14-22 8 24 16-20 2 32-46 8z" stroke="#fff" {...common} transform="rotate(-14 250 60)" />
          <path d="M352 52c-6-12-24-6-18 10 3 9 18 18 18 18s13-11 14-21c1-15-14-17-14-7z" stroke="#C7F25A" {...common} />
          <path d="M318 214l6 6M330 204l3 9" stroke="#fff" {...common} />
        </>
      )}
      {kind === "rain" && (
        <>
          <path d="M300 60c-14 0-22 10-20 22h56c4-14-8-26-22-22-3-6-8-10-14 0z" stroke="#fff" {...common} />
          <path d="M292 100l-4 10M310 100l-4 10M328 100l-4 10" stroke="#9AD3FF" {...common} />
          <path d="M360 190l8-8 8 8-8 8z" stroke="#FFE15A" {...common} />
        </>
      )}
      {kind === "dino" && (
        <>
          <path d="M330 54l10 16 12-12 4 18 16-6-8 16" stroke="#fff" {...common} />
          <circle cx="250" cy="44" r="7" stroke="#FFE15A" {...common} />
          <path d="M360 200c8 0 8 10 16 10" stroke="#C7F25A" {...common} />
        </>
      )}
      {kind === "star" && (
        <>
          <path d="M340 40l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" stroke="#fff" {...common} />
          <path d="M262 70c6-4 12 0 10 6" stroke="#FF9FCB" {...common} />
        </>
      )}
    </svg>
  );
}
