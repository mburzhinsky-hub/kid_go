"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { KidEvent } from "@/lib/types";
import { getEventsSeed } from "@/lib/data/events";
import { placeById } from "@/lib/data/places";
import { moscowDateISO } from "@/lib/forecast";
import { formatAgeRange, formatPrice } from "@/lib/format";
import { EventCard } from "@/components/cards/EventCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

/** Static-export pages cannot render a dated event schedule at build time.
 * Generate only future, source-backed occurrences on the visitor's device.
 * Past sessions and expired programmes disappear without requiring a redeploy.
 */
function useUpcomingEvents() {
  const [events, setEvents] = useState<KidEvent[]>([]);
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setEvents(getEventsSeed()
        .filter((e) => new Date(e.end_at).getTime() > now.getTime())
        .sort((a, b) => a.start_at.localeCompare(b.start_at)));
    };
    refresh();
    const timer = window.setInterval(refresh, 5 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return events;
}

function dateLabel(iso: string, now: Date): string {
  const date = iso.slice(0, 10);
  if (date === moscowDateISO(0, now)) return "Сегодня";
  if (date === moscowDateISO(1, now)) return "Завтра";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
}

export function HomeLiveEvents() {
  const events = useUpcomingEvents();
  if (!events.length) return null;
  const now = new Date();
  return (
    <section className="mt-8">
      <SectionHeader title="Ближайшие события" subtitle="Шоу, мастер-классы и чтения — проверяйте запись перед визитом" />
      <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
        {events.map((e) => {
          const place = placeById.get(e.place_id);
          return place ? <EventCard key={e.id} event={e} place={place} dateLabel={dateLabel(e.start_at, now)} /> : null;
        })}
      </div>
    </section>
  );
}

export function PlaceLiveEvents({ placeId }: { placeId: string }) {
  const events = useUpcomingEvents().filter((e) => e.place_id === placeId);
  if (!events.length) return null;
  const now = new Date();
  return (
    <section className="mt-8">
      <h2 className="tight text-[22px] font-[800]">Ближайшие события</h2>
      <ul className="mt-3 space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-[20px] bg-yellow-50 p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-white text-yellow-ink">
              <CalendarDays size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">{e.title}</p>
              <p className="text-[13px] text-ink-2">
                {dateLabel(e.start_at, now)} · {e.start_at.slice(11, 16)}–{e.end_at.slice(11, 16)} · {e.price ? formatPrice(e.price) : "бесплатно"} · {formatAgeRange(e.age_min, e.age_max)}
              </p>
              {e.source && (
                <a href={e.source} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-[12px] font-semibold text-muted underline underline-offset-2">
                  Уточнить расписание и запись
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
