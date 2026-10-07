"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Footprints, Bus, Car, Plus, Check, Star } from "lucide-react";
import type { Photo, TransportId } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { useFamily } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { plural, quote } from "@/lib/format";
import { placeHref } from "@/lib/place-href";

export interface NextItem {
  slug: string;
  title: string;
  kind: string; // «семейное кафе», «парк»
  photo: Photo;
  tint: string;
  emoji: string;
  /** Только настоящая оценка (есть отзывы); иначе не показываем. */
  rating?: number;
  minutes: number;
  mode: TransportId;
  extra?: string;
  /** Прямая ссылка на меню (только настоящая, из базы). */
  menuUrl?: string;
  ageMin: number;
  ageMax: number;
}

export interface NextGroup {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  /** Почему это логичное продолжение — одна фраза. */
  why: string;
  items: NextItem[];
  /** Для сортировки на сервере; на клиенте не нужен. */
  score?: number;
}

const MODE = { walk: { Icon: Footprints, word: "пешком" }, transit: { Icon: Bus, word: "на транспорте" }, car: { Icon: Car, word: "на машине" } };

/**
 * «Что потом?» — ключевая механика: из любого места
 * в один тап собираем «наш день» с логичным следующим шагом.
 * На клиенте уточняем по детям семьи и по тому, что уже есть в «нашем дне»:
 * если в дне уже есть кафе — «Поесть» уходит назад, добавленные места показываем отмеченными.
 */
export function WhatNext({ currentSlug, groups, groupOf }: { currentSlug: string; groups: NextGroup[]; groupOf: Record<string, string> }) {
  const [active, setActive] = useState<string | undefined>(undefined);
  const day = useFamily((s) => s.day);
  const kids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const addToDay = useFamily((s) => s.addToDay);
  const toast = useToast((s) => s.show);

  const shown = useMemo(() => {
    const covered = new Set(hydrated ? day.filter((s) => s !== currentSlug).map((s) => groupOf[s]).filter(Boolean) : []);
    const fits = (it: NextItem) => !hydrated || kids.length === 0 || kids.every((k) => k.age >= it.ageMin - 1 && k.age <= it.ageMax + 1);
    const prepared = groups
      .map((g) => {
        const fit = g.items.filter(fits);
        // не режем до нуля: если ничего не подошло по возрасту, показываем то, что есть
        const list = (fit.length > 0 ? fit : g.items).slice(0, 3);
        return { ...g, items: list, done: covered.has(g.id) };
      })
      .filter((g) => g.items.length > 0);
    // уже покрытые днём продолжения — в конец, но не прячем: «добавить ещё одно кафе» бывает нужно
    return [...prepared.filter((g) => !g.done), ...prepared.filter((g) => g.done)];
  }, [groups, groupOf, day, kids, hydrated, currentSlug]);

  const group = shown.find((g) => g.id === active) ?? shown[0];
  if (!group) return null;
  const [lead, ...others] = group.items;

  const add = (slug: string, title: string) => {
    addToDay([currentSlug, slug]);
    track("what_next_add", { from: currentSlug, to: slug });
    toast(`${quote(title)} в нашем дне 💛`, { href: "/day", label: "Открыть" });
  };

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {shown.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            aria-pressed={g.id === group.id}
            className={cn(
              "press hit relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold transition-colors",
              g.id === group.id ? "bg-ink text-white" : "text-ink"
            )}
            style={g.id === group.id ? undefined : { background: g.bg }}
          >
            <span className="text-[17px]">{g.emoji}</span> {g.label}
          </button>
        ))}
      </div>

      <div key={group.id} className="mt-3 animate-rise">
        <p className="mb-2 px-1 text-[14px] leading-snug text-muted">{group.why}</p>
        {lead && (
          <div className="overflow-hidden rounded-[24px] bg-surface shadow-card">
            <Link href={placeHref(lead)} className="relative block">
              <SmartImage photo={lead.photo} tint={lead.tint} emoji={lead.emoji} sizes="440px" className="aspect-[16/8] w-full" />
              <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[14px] font-bold shadow-card">
                <TravelIcon mode={lead.mode} /> Через {lead.minutes} {plural(lead.minutes, "минуту", "минуты", "минут")}
              </span>
            </Link>
            <div className="p-3.5">
              <p className="text-[17px] font-bold leading-snug">
                Через {lead.minutes} {plural(lead.minutes, "минуту", "минуты", "минут")} — {lead.kind}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-muted">
                {lead.rating != null && lead.rating > 0 && <><Star size={14} className="fill-star text-star" /> {lead.rating.toFixed(1)} · </>}
                {lead.title}
                {lead.extra && <> · {lead.extra}</>}
              </p>
              {lead.menuUrl && (
                <a href={lead.menuUrl} target="_blank" rel="noreferrer" className="press hit relative mt-2 inline-flex h-10 items-center rounded-full bg-orange-50 px-4 text-[14px] font-semibold text-orange-ink">
                  Меню
                </a>
              )}
              <AddButton added={day.includes(lead.slug)} onAdd={() => add(lead.slug, lead.title)} className="mt-3 w-full" big />
            </div>
          </div>
        )}
        {others.length > 0 && (
          <ul className="mt-2.5 space-y-2">
            {others.map((it) => (
              <li key={it.slug} className="flex items-center gap-3 rounded-[20px] bg-surface p-2 shadow-card">
                <Link href={placeHref(it)} className="flex min-w-0 flex-1 items-center gap-3">
                  <SmartImage photo={it.photo} tint={it.tint} emoji={it.emoji} sizes="64px" className="h-14 w-14 shrink-0 rounded-[12px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{it.title}</span>
                    <span className="flex items-center gap-1 text-[13px] text-muted">
                      <TravelIcon mode={it.mode} /> {it.minutes} мин {MODE[it.mode].word}
                    </span>
                    {it.menuUrl && <span className="block text-[12px] font-semibold text-orange-ink">есть ссылка на меню</span>}
                  </span>
                </Link>
                <AddButton added={day.includes(it.slug)} onAdd={() => add(it.slug, it.title)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TravelIcon({ mode }: { mode: TransportId }) {
  const { Icon } = MODE[mode];
  return <Icon size={14} strokeWidth={2} className="text-green-ink" />;
}

function AddButton({ added, onAdd, className, big }: { added: boolean; onAdd: () => void; className?: string; big?: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={added}
      className={cn(
        "press hit relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors",
        big ? "h-12 text-[16px]" : "h-10 px-4 text-[14px]",
        added ? "bg-green-50 text-green-ink" : big ? "bg-pink-50 text-pink-ink" : "bg-pink text-white",
        className
      )}
    >
      {added ? <Check size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
      {added ? "В нашем дне" : big ? "Добавить в наш день" : "В день"}
    </button>
  );
}
