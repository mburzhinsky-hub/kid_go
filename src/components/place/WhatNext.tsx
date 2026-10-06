"use client";

import Link from "next/link";
import { useState } from "react";
import { Footprints, Bus, Car, Plus, Check, Star } from "lucide-react";
import type { Photo, TransportId } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { useFamily } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
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
}

export interface NextGroup {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  items: NextItem[];
}

const MODE = { walk: { Icon: Footprints, word: "пешком" }, transit: { Icon: Bus, word: "на транспорте" }, car: { Icon: Car, word: "на машине" } };

/**
 * «Что сделать после?» — ключевая механика: из любого места
 * в один тап собираем «наш день» с ближайшим следующим шагом.
 */
export function WhatNext({ currentSlug, groups }: { currentSlug: string; groups: NextGroup[] }) {
  const [active, setActive] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === active) ?? groups[0];
  const day = useFamily((s) => s.day);
  const addToDay = useFamily((s) => s.addToDay);
  const toast = useToast((s) => s.show);
  if (!group) return null;
  const [lead, ...others] = group.items;

  const add = (slug: string, title: string) => {
    addToDay([currentSlug, slug]);
    track("what_next_add", { from: currentSlug, to: slug });
    toast(`«${title}» в нашем дне 💛`, { href: "/day", label: "Открыть" });
  };

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            aria-pressed={g.id === group.id}
            className={cn(
              "press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-semibold transition-colors",
              g.id === group.id ? "bg-ink text-white" : "text-ink"
            )}
            style={g.id === group.id ? undefined : { background: g.bg }}
          >
            <span className="text-[17px]">{g.emoji}</span> {g.label}
          </button>
        ))}
      </div>

      <div key={group.id} className="mt-3 animate-rise">
        {lead && (
          <div className="overflow-hidden rounded-[22px] bg-surface shadow-card">
            <Link href={placeHref(lead)} className="relative block">
              <SmartImage photo={lead.photo} tint={lead.tint} emoji={lead.emoji} sizes="440px" className="aspect-[16/8] w-full" />
              <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13.5px] font-bold shadow-card">
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
              <AddButton added={day.includes(lead.slug)} onAdd={() => add(lead.slug, lead.title)} className="mt-3 w-full" big />
            </div>
          </div>
        )}
        {others.length > 0 && (
          <ul className="mt-2.5 space-y-2">
            {others.map((it) => (
              <li key={it.slug} className="flex items-center gap-3 rounded-[18px] bg-surface p-2 shadow-card">
                <Link href={placeHref(it)} className="flex min-w-0 flex-1 items-center gap-3">
                  <SmartImage photo={it.photo} tint={it.tint} emoji={it.emoji} sizes="64px" className="h-14 w-14 shrink-0 rounded-[12px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{it.title}</span>
                    <span className="flex items-center gap-1 text-[13px] text-muted">
                      <TravelIcon mode={it.mode} /> {it.minutes} мин {MODE[it.mode].word}
                    </span>
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
  return <Icon size={14} strokeWidth={2.3} className="text-green" />;
}

function AddButton({ added, onAdd, className, big }: { added: boolean; onAdd: () => void; className?: string; big?: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={added}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors",
        big ? "h-12 text-[15.5px]" : "h-10 px-3.5 text-[14px]",
        added ? "bg-green-50 text-green" : big ? "bg-pink-50 text-pink" : "bg-pink text-white",
        className
      )}
    >
      {added ? <Check size={18} strokeWidth={2.6} /> : <Plus size={18} strokeWidth={2.6} />}
      {added ? "В нашем дне" : big ? "Добавить в наш день" : "В день"}
    </button>
  );
}
