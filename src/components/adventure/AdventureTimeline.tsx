"use client";

import Link from "next/link";
import { Footprints, Bus, Car, ChevronUp, ChevronDown, Trash2, Clock } from "lucide-react";
import type { Plan, PlanStop, TransportId } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { categoryDef } from "@/lib/catalog";
import { formatDuration, plural } from "@/lib/format";
import { formatKm } from "@/lib/geo";

const STOP_COLORS = ["#FF2E88", "#8B3DF0", "#1FA9F5", "#1FAE47", "#FF7A2E", "#FFC21A"];

export function AdventureTimeline({
  plan,
  editable,
  onMove,
  onRemove,
}: {
  plan: Plan;
  editable?: boolean;
  onMove?: (slug: string, dir: -1 | 1) => void;
  onRemove?: (slug: string) => void;
}) {
  return (
    <ol className="relative">
      {plan.stops.map((stop, i) => (
        <li key={stop.place.id + i}>
          <StopRow
            stop={stop}
            index={i}
            color={STOP_COLORS[i % STOP_COLORS.length]}
            last={i === plan.stops.length - 1}
            editable={editable}
            canUp={i > 0}
            canDown={i < plan.stops.length - 1}
            onMove={onMove}
            onRemove={onRemove}
          />
          {stop.travelToNext && <TravelConnector {...stop.travelToNext} />}
        </li>
      ))}
    </ol>
  );
}

function StopRow({
  stop,
  index,
  color,
  last,
  editable,
  canUp,
  canDown,
  onMove,
  onRemove,
}: {
  stop: PlanStop;
  index: number;
  color: string;
  last: boolean;
  editable?: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove?: (slug: string, dir: -1 | 1) => void;
  onRemove?: (slug: string) => void;
}) {
  const p = stop.place;
  const cat = categoryDef(p.category);
  return (
    <div className="relative flex gap-3 animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex w-[54px] shrink-0 flex-col items-center">
        <span className="tight text-[17px] font-[800] leading-none">{stop.start}</span>
        <span className="mt-2 grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold text-white ring-4 ring-bg" style={{ background: color }}>
          {index + 1}
        </span>
        {!last && <span aria-hidden className="mt-1 w-[3px] flex-1 rounded-full" style={{ background: `linear-gradient(${color}, #e8e6e1)` }} />}
      </div>
      <div className="mb-1 min-w-0 flex-1 overflow-hidden rounded-[22px] bg-surface shadow-card">
        <Link href={`/places/${p.slug}`} className="flex gap-3 p-2.5">
          <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="96px" className="h-[84px] w-[84px] shrink-0 rounded-[16px]" />
          <div className="min-w-0 flex-1 py-0.5">
            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: cat.fg }}>
              <cat.Icon width={13} height={13} /> {cat.name}
            </span>
            <h3 className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-tight">{p.title}</h3>
            <p className="mt-1 inline-flex items-center gap-1 text-[13.5px] font-medium text-muted">
              <Clock size={13} strokeWidth={2.3} /> {formatDuration(stop.duration)}
            </p>
          </div>
        </Link>
        {stop.note && <p className="mx-2.5 mb-2.5 rounded-[12px] bg-yellow-50 px-3 py-2 text-[13px] leading-snug text-[#7a5600]">💡 {stop.note}</p>}
        {editable && (
          <div className="flex items-center justify-end gap-1 border-t border-line px-2 py-1.5">
            <IconBtn label="Выше" disabled={!canUp} onClick={() => onMove?.(p.slug, -1)}>
              <ChevronUp size={18} />
            </IconBtn>
            <IconBtn label="Ниже" disabled={!canDown} onClick={() => onMove?.(p.slug, 1)}>
              <ChevronDown size={18} />
            </IconBtn>
            <IconBtn label="Убрать" onClick={() => onRemove?.(p.slug)}>
              <Trash2 size={17} />
            </IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} disabled={disabled} className="press grid h-9 w-9 place-items-center rounded-full text-ink-2 disabled:opacity-30">
      {children}
    </button>
  );
}

const MODE: Record<TransportId, { Icon: typeof Footprints; word: string }> = {
  walk: { Icon: Footprints, word: "пешком" },
  transit: { Icon: Bus, word: "на транспорте" },
  car: { Icon: Car, word: "на машине" },
};

/** Переход между точками: «↓ 6 минут пешком». */
export function TravelConnector({ minutes, km, mode }: { minutes: number; km: number; mode: TransportId }) {
  const { Icon, word } = MODE[mode];
  return (
    <div className="flex gap-3">
      <div className="flex w-[54px] shrink-0 justify-center">
        <span aria-hidden className="w-[3px] rounded-full bg-[repeating-linear-gradient(#d9d6cf_0_5px,transparent_5px_10px)]" />
      </div>
      <div className="my-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[13.5px] font-semibold text-green">
        <Icon size={15} strokeWidth={2.4} />
        {minutes} {plural(minutes, "минута", "минуты", "минут")} {word}
        <span className="font-medium text-green/70">· {formatKm(km)}</span>
      </div>
    </div>
  );
}
