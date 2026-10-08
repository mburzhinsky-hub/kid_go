"use client";

import Link from "next/link";
import { Footprints, Bus, Car, ChevronUp, ChevronDown, Trash2, Clock, Replace, UtensilsCrossed } from "lucide-react";
import type { Plan, PlanStop, TransportId } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { categoryDef } from "@/lib/catalog";
import { formatDuration, plural } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { cn } from "@/lib/cn";
import { placeHref } from "@/lib/place-href";

const STOP_COLORS = ["#D8196F", "#7A2FE0", "#0B78B8", "#16883A", "#C4540C", "#8A5A00"];

export function AdventureTimeline({
  plan,
  editable,
  onMove,
  onRemove,
  onReplace,
}: {
  plan: Plan;
  editable?: boolean;
  onMove?: (slug: string, dir: -1 | 1) => void;
  onRemove?: (slug: string) => void;
  onReplace?: (index: number) => void;
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
            onReplace={onReplace ? () => onReplace(i) : undefined}
            showMenu={!!stop.place.menu_url && (stop.foodOption === true || (stop.foodOption == null && (stop.place.category === "cafe" || plan.totalMinutes >= 180)))}
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
  onReplace,
  showMenu,
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
  onReplace?: () => void;
  showMenu?: boolean;
}) {
  const p = stop.place;
  const w = stop.weather;
  const wxIcon = w ? (w.condition === "rain" ? "🌧" : w.condition === "snow" ? "🌨" : w.condition === "sun" ? "☀️" : "⛅") : null;
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
      <div className="mb-1 min-w-0 flex-1 overflow-hidden rounded-[24px] bg-surface shadow-card">
        <Link href={placeHref(p)} className="flex gap-3 p-2.5">
          <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="96px" className="h-[84px] w-[84px] shrink-0 rounded-[16px]" />
          <div className="min-w-0 flex-1 py-0.5">
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: cat.ink }}>
              <cat.Icon width={13} height={13} /> {cat.name}
            </span>
            <h3 className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-tight">{p.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-medium text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock size={14} strokeWidth={2} /> {formatDuration(stop.duration)}
              </span>
              {w && (
                <span
                  className={cn("inline-flex items-center gap-0.5", w.bad && !p.indoor ? "font-semibold text-blue-ink" : "")}
                  title={`Вероятность осадков ${w.pop}%`}
                >
                  {wxIcon} {w.temp > 0 ? "+" : ""}
                  {w.temp}°{p.indoor && !p.outdoor ? " · под крышей" : w.bad ? ` · ${w.condition === "snow" ? "снег" : "дождь"} ${w.pop}%` : ""}
                </span>
              )}
            </p>
          </div>
        </Link>
        {stop.note && <p className="mx-2.5 mb-2.5 rounded-[12px] bg-yellow-50 px-3 py-2 text-[13px] leading-snug text-yellow-ink">💡 {stop.note}</p>}
        {showMenu && p.menu_url && (
          <a href={p.menu_url} target="_blank" rel="noreferrer" className="press hit relative mx-2.5 mb-2.5 inline-flex h-10 items-center gap-2 rounded-full bg-orange-50 px-3.5 text-[14px] font-semibold text-orange-ink">
            <UtensilsCrossed size={16} /> {p.category === "cafe" ? "Посмотреть меню" : "Где поесть / меню"}
          </a>
        )}
        {(editable || onReplace) && (
          <div className="flex items-center justify-end gap-1 border-t border-line px-2 py-1.5">
            {onReplace && (
              <button onClick={onReplace} className="press hit relative mr-auto inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-semibold text-ink-2">
                <Replace size={16} /> Заменить
              </button>
            )}
            {editable && (
              <>
                <IconBtn label="Выше" disabled={!canUp} onClick={() => onMove?.(p.slug, -1)}>
                  <ChevronUp size={20} />
                </IconBtn>
                <IconBtn label="Ниже" disabled={!canDown} onClick={() => onMove?.(p.slug, 1)}>
                  <ChevronDown size={20} />
                </IconBtn>
                <IconBtn label="Убрать" onClick={() => onRemove?.(p.slug)}>
                  <Trash2 size={16} />
                </IconBtn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} disabled={disabled} className="press hit relative grid h-9 w-9 place-items-center rounded-full text-ink-2 disabled:opacity-30">
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
      <div className="my-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[14px] font-semibold text-green-ink">
        <Icon size={16} strokeWidth={2.5} />
        {minutes} {plural(minutes, "минута", "минуты", "минут")} {word}
        <span className="font-medium text-green-ink/70">· {formatKm(km)}</span>
      </div>
    </div>
  );
}
