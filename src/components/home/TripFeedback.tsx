"use client";

import { useEffect, useState } from "react";
import { useFamily, type Trip } from "@/lib/store";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

const FACES: { v: 1 | 2 | 3; e: string; label: string }[] = [
  { v: 1, e: "😕", label: "Не очень" },
  { v: 2, e: "🙂", label: "Нормально" },
  { v: 3, e: "😍", label: "Восторг" },
];
const TAGS_BAD = ["Шумно", "Толпа", "Дорого", "Далеко ехать", "Ребёнку скучно", "Закрыто / не так, как написано"];
const TAGS_GOOD = ["Ребёнку понравилось", "Хотим ещё", "Удобно с коляской", "Вкусно", "Всё по плану"];

/** «Как прошло?» — самый ценный сигнал для рекомендаций: оценка дня и теги. */
export function TripFeedback() {
  const trips = useFamily((s) => s.trips);
  const hydrated = useFamily((s) => s.hydrated);
  const rate = useFamily((s) => s.rateTrip);
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const trip: Trip | undefined = hydrated && now ? trips.find((t) => !t.rating && now - t.goAt > 2 * 3600e3 && now - t.goAt < 4 * 86400e3) : undefined;
  const [face, setFace] = useState<1 | 2 | 3 | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="mx-4 mt-7 rounded-[24px] bg-green-50 p-4 text-[15px] font-semibold text-green-ink animate-rise">
        Спасибо! Учтём это в следующих подборках 💚
      </div>
    );
  if (!trip) return null;
  const tagList = face === 3 ? TAGS_GOOD : TAGS_BAD;
  return (
    <section className="mx-4 mt-7 rounded-[24px] bg-surface p-4 shadow-card animate-rise" aria-label="Как прошёл день">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Как прошло?</p>
      <h2 className="mt-1 text-[18px] font-bold leading-tight">
        {trip.emoji} {trip.title}
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {FACES.map((f) => (
          <button
            key={f.v}
            onClick={() => {
              setFace(f.v);
              setTags([]);
            }}
            aria-pressed={face === f.v}
            className={cn("press flex flex-col items-center gap-1 rounded-[20px] py-2.5 text-[13px] font-semibold", face === f.v ? "bg-pink-50 ring-2 ring-inset ring-pink" : "bg-fill")}
          >
            <span className="text-[30px] leading-none">{f.e}</span>
            {f.label}
          </button>
        ))}
      </div>
      {face && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5 animate-fade">
            {tagList.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                  aria-pressed={on}
                  className={cn("press hit relative h-9 rounded-full px-3 text-[14px] font-semibold", on ? "bg-ink text-white" : "bg-fill text-ink")}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              rate(trip.key, face, tags);
              track("plan_feedback", { key: trip.key, rating: face, tags: tags.join("|") });
              setDone(true);
            }}
            className="press mt-3 h-12 w-full rounded-full bg-pink text-[16px] font-bold text-white shadow-pink"
          >
            Готово
          </button>
        </>
      )}
    </section>
  );
}
