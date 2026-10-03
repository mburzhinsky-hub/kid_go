"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Users, Clock, Wallet, Route, Umbrella, Sun, Heart, Share2, Shuffle, Sparkles } from "lucide-react";
import type { Photo, Place } from "@/lib/types";
import { buildPlan, chainLabel, type StopInput } from "@/lib/plan";
import { SmartImage } from "@/components/ui/SmartImage";
import { BackButton, ShareButton } from "@/components/place/PhotoGallery";
import { AdventureTimeline } from "./AdventureTimeline";
import { StickyCTA } from "@/components/place/PlaceCTA";
import { IconRocket } from "@/components/icons/brand-icons";
import { useFamily } from "@/lib/store";
import { useToast, ToastHost } from "@/components/ui/Toast";
import { formatAgeRange, formatBudget, formatDuration, toMinutes } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export interface AdventureViewProps {
  planKey: string;
  title: string;
  tagline: string;
  description?: string;
  cover?: Photo;
  emoji: string;
  tint: string;
  start: string;
  stops: { place: Place; duration?: number; note?: string; travelOverride?: number }[];
  ageOverride?: [number, number];
  recommend?: number;
  why?: string[];
  explanation?: string;
  alternativeHref: string;
  saveSteps?: string[];
  editable?: boolean;
  onMove?: (slug: string, dir: -1 | 1) => void;
  onRemove?: (slug: string) => void;
  children?: React.ReactNode;
}

const START_OPTIONS = ["10:00", "11:00", "12:30", "14:00", "16:00"];

export function multiRouteUrl(places: Place[]) {
  return `https://yandex.ru/maps/?rtext=${places.map((p) => `${p.latitude},${p.longitude}`).join("~")}&rtt=mt`;
}

export function AdventureView(props: AdventureViewProps) {
  const [start, setStart] = useState(props.start);
  const plan = useMemo(
    () =>
      buildPlan(props.stops as StopInput[], {
        key: props.planKey,
        title: props.title,
        start,
        transport: "transit",
      }),
    [props.stops, props.planKey, props.title, start]
  );
  const saved = useFamily((s) => s.savedPlans.some((p) => p.key === props.planKey));
  const toggleSaved = useFamily((s) => s.toggleSavedPlan);
  const toast = useToast((s) => s.show);
  const ageMin = props.ageOverride?.[0] ?? plan.ageMin;
  const ageMax = props.ageOverride?.[1] ?? plan.ageMax;
  const places = plan.stops.map((s) => s.place);
  const cover = props.cover ?? places[0]?.photos[0];
  const startOptions = START_OPTIONS.includes(props.start) ? START_OPTIONS : [props.start, ...START_OPTIONS].sort((a, b) => toMinutes(a) - toMinutes(b));

  const save = () => {
    toggleSaved({ key: props.planKey, title: props.title, emoji: props.emoji, steps: props.saveSteps });
    toast(saved ? "Убрали из сохранённых" : "Сохранили в «Наши хотелки» ❤️", saved ? undefined : { href: "/favorites?tab=plans", label: "Открыть" });
    track(saved ? "adventure_unsave" : "adventure_save", { key: props.planKey });
  };

  return (
    <main className="pb-36">
      <div className="relative">
        {cover && (
          <SmartImage photo={cover} tint={props.tint} emoji={props.emoji} sizes="(max-width: 480px) 100vw, 480px" priority quality={75} className="h-[310px] w-full rounded-b-[30px]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute inset-x-4 top-[max(14px,env(safe-area-inset-top))] flex items-center justify-between">
          <BackButton />
          <div className="flex gap-2.5">
            <button
              onClick={save}
              aria-label={saved ? "Убрать из сохранённых" : "Сохранить приключение"}
              aria-pressed={saved}
              className="press grid h-11 w-11 place-items-center rounded-full bg-black/35 text-white"
            >
              <Heart size={23} strokeWidth={2} className={cn(saved && "animate-pop fill-pink text-pink")} />
            </button>
            <ShareButton title={props.title} />
          </div>
        </div>
        <div className="absolute -bottom-7 left-4 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-[30px] shadow-float">{props.emoji}</div>
        {props.recommend && (
          <span className="absolute bottom-4 right-4 inline-flex h-9 items-center gap-1 rounded-full bg-yellow px-3 text-[14px] font-bold">
            👍 {props.recommend}% рекомендуют
          </span>
        )}
      </div>

      <div className="px-4">
        <h1 className="tight mt-10 text-[31px] font-[850] leading-[1.06]">{props.title}</h1>
        <p className="mt-1.5 text-[17px] leading-snug text-[#6b6f7c]">{props.tagline}</p>
        <p className="mt-2 text-[14.5px] font-semibold text-ink-2">{chainLabel(places)}</p>

        <div className="mt-5 grid grid-cols-4">
          <Stat Icon={Users} color="#8B3DF0" value={formatAgeRange(ageMin, ageMax)} label="возраст" />
          <Stat Icon={Clock} color="#2F7BFF" value={formatDuration(plan.totalMinutes)} label="весь день" divider />
          <Stat Icon={Wallet} color="#1FAE47" value={formatBudget(plan.budget)} label="на семью" divider />
          <Stat Icon={Route} color="#FF3B4E" value={formatKm(plan.distanceKm || 0.1)} label="между точками" divider />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {plan.rainProof ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3.5 text-[14px] font-semibold text-blue">
              <Umbrella size={16} /> Подходит для дождя
            </span>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-50 px-3.5 text-[14px] font-semibold text-orange">
              <Sun size={16} /> Лучше в сухую погоду
            </span>
          )}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-purple-50 px-3.5 text-[14px] font-semibold text-purple">
            {plan.stops.length} {plan.stops.length === 1 ? "место" : plan.stops.length < 5 ? "места" : "мест"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionPill onClick={save} active={saved} icon={<Heart size={19} className={cn(saved && "fill-current")} />}>
            {saved ? "Сохранено" : "Сохранить"}
          </ActionPill>
          <ShareAction title={props.title} />
          <ActionPill href={props.alternativeHref} icon={<Shuffle size={19} />}>
            Другой вариант
          </ActionPill>
        </div>

        {(props.explanation || props.why?.length) && (
          <section className="mt-6 rounded-[24px] p-4" style={{ background: "linear-gradient(135deg,#FFE9F3 0%,#F4EAFF 100%)" }}>
            <h2 className="flex items-center gap-1.5 text-[16px] font-bold">
              <Sparkles size={17} className="text-pink" /> Почему это вам подойдёт
            </h2>
            {props.explanation && <p className="mt-1.5 text-[15px] leading-snug text-ink-2">{props.explanation}</p>}
            {!!props.why?.length && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {props.why.map((w) => (
                  <span key={w} className="inline-flex h-8 items-center rounded-full bg-white px-3 text-[13px] font-semibold">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {props.description && <p className="mt-5 text-[16px] leading-[1.5] text-ink-2">{props.description}</p>}

        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="tight text-[24px] font-[800]">План дня</h2>
            <span className="text-[13px] font-medium text-muted">время можно менять</span>
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <span className="flex shrink-0 items-center pr-1 text-[14px] font-semibold text-muted">Начать в</span>
            {startOptions.map((t) => (
              <button
                key={t}
                onClick={() => setStart(t)}
                aria-pressed={t === start}
                className={cn(
                  "press h-9 shrink-0 rounded-full px-3.5 text-[14.5px] font-bold transition-colors",
                  t === start ? "bg-ink text-white" : "bg-surface text-ink shadow-card"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <AdventureTimeline plan={plan} editable={props.editable} onMove={props.onMove} onRemove={props.onRemove} />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-ink p-4 text-white">
            <span className="text-[28px]">🏁</span>
            <div className="text-[14.5px] leading-snug">
              <p className="font-bold">
                Финиш около {plan.stops.length ? addMin(plan.stops[plan.stops.length - 1].start, plan.stops[plan.stops.length - 1].duration) : start}
              </p>
              <p className="text-white/75">
                {formatDuration(plan.totalMinutes)} · {formatBudget(plan.budget)} · {formatKm(plan.distanceKm || 0.1)}
              </p>
            </div>
          </div>
        </section>
        {props.children}
      </div>

      <StickyCTA
        href={multiRouteUrl(places)}
        onClick={() => track("adventure_go", { key: props.planKey })}
        icon={<IconRocket width={24} height={24} />}
        secondary={
          <button
            onClick={save}
            aria-label={saved ? "Убрать из сохранённых" : "Сохранить в хотелки"}
            aria-pressed={saved}
            className="press grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-white text-ink shadow-card"
          >
            <Heart size={24} className={cn(saved && "fill-pink text-pink")} />
          </button>
        }
      >
        Поехали!
      </StickyCTA>
      <ToastHost bottom={96} />
    </main>
  );
}

function addMin(hhmm: string, d: number) {
  const t = toMinutes(hhmm) + d;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function Stat({ Icon, color, value, label, divider }: { Icon: typeof Users; color: string; value: string; label: string; divider?: boolean }) {
  return (
    <div className="relative flex flex-col items-center px-1 text-center">
      {divider && <span aria-hidden className="absolute left-0 top-2 h-[78%] w-px bg-line" />}
      <Icon size={28} strokeWidth={1.9} style={{ color }} />
      <p className="mt-1.5 text-[14.5px] font-semibold leading-tight">{value}</p>
      <p className="mt-0.5 text-[12.5px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function ActionPill({
  children,
  icon,
  onClick,
  href,
  active,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const cls = cn(
    "press flex h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] text-[13px] font-semibold transition-colors",
    active ? "bg-pink-50 text-pink" : "bg-surface text-ink shadow-card"
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {icon}
        {children}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}

function ShareAction({ title }: { title: string }) {
  const toast = useToast((s) => s.show);
  return (
    <ActionPill
      icon={<Share2 size={19} />}
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ title, url: location.href });
          else {
            await navigator.clipboard.writeText(location.href);
            toast("Ссылка скопирована 💌");
          }
        } catch {
          /* закрыли системный шит */
        }
      }}
    >
      Поделиться
    </ActionPill>
  );
}
