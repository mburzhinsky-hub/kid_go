"use client";

import { useEffect, useState } from "react";
import type { Child } from "@/lib/types";
import { plural } from "@/lib/format";

/** Игривая загрузка: показываем, что именно мы учитываем — это и есть ценность. */
export function PlannerLoader({ kids, onDone }: { kids: Pick<Child, "name" | "age">[]; onDone: () => void }) {
  const ages = kids.map((k) => k.age).join(" и ");
  const steps = [
    "Смотрим прогноз по часам…",
    kids.length ? `Ищем места для ${ages} ${plural(kids[kids.length - 1].age, "года", "лет", "лет")}…` : "Ищем лучшие места…",
    "Проверяем, что всё открыто…",
    "Считаем дорогу от вас и бюджет…",
    "Ставим прогулку в сухое окно…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 520);
    const done = setTimeout(onDone, 2700);
    return () => {
      clearInterval(t);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-8 text-center" aria-live="polite">
      <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-[#ffd1e5] opacity-70 blur-3xl" />
      <div className="absolute -right-10 bottom-32 h-64 w-64 rounded-full bg-[#d6e6ff] opacity-80 blur-3xl" />
      <div className="relative h-44 w-44">
        <span className="absolute inset-0 rounded-full border-[6px] border-dashed border-pink/30 animate-spin-slow" />
        {["🎈", "🦖", "🍦", "🎠", "🧸", "🚀"].map((e, k) => (
          <span
            key={e}
            className="absolute left-1/2 top-1/2 -ml-5 -mt-5 text-[38px]"
            style={{
              transform: `rotate(${k * 60}deg) translateY(-78px) rotate(-${k * 60}deg)`,
            }}
          >
            <span className="inline-block animate-bob" style={{ animationDelay: `${k * 0.2}s` }}>
              {e}
            </span>
          </span>
        ))}
        <span className="absolute inset-0 grid place-items-center text-[52px] animate-pop">✨</span>
      </div>
      <h1 className="tight relative mt-10 text-[28px] font-[850]">Придумываем приключение…</h1>
      <p key={i} className="relative mt-2 h-6 text-[16px] font-medium text-muted animate-rise">
        {steps[i]}
      </p>
      <div className="relative mt-6 h-2 w-48 overflow-hidden rounded-full bg-[#e9e7e2]">
        <span className="block h-full rounded-full bg-pink transition-all duration-500" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>
    </main>
  );
}
