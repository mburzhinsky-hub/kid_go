"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Users, Clock, Wallet, Route, Umbrella, Sun, Heart, Share2, Shuffle, Sparkles, CalendarPlus, Home, CloudRain, ArrowRight } from "lucide-react";
import type { Photo, Place, PlanStop } from "@/lib/types";
import { buildPlan, chainLabel, type StopInput } from "@/lib/plan";
import { SmartImage } from "@/components/ui/SmartImage";
import { BackButton, ShareButton } from "@/components/place/PhotoGallery";
import { AdventureTimeline } from "./AdventureTimeline";
import { StickyCTA } from "@/components/place/PlaceCTA";
import { IconRocket } from "@/components/icons/brand-icons";
import { useFamily } from "@/lib/store";
import { useForecast } from "@/lib/use-context";
import { bringList, daySummary, moscowDateISO, weekdayOf, windowWx } from "@/lib/forecast";
import { wxFor } from "@/lib/recommend/engine";
import { alternativesFor, type Alternative } from "@/lib/alternatives";
import { downloadICS } from "@/lib/calendar";
import { travelToPlace, formatTravel } from "@/lib/location";
import { getPlaceSync } from "@/lib/data/repository";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast, ToastHost } from "@/components/ui/Toast";
import { formatAgeRange, formatBudget, formatDuration, moscowNow, toMinutes } from "@/lib/format";
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
  /** Замена шага в «Нашем дне» (хранится в профиле). */
  onReplace?: (index: number, slug: string) => void;
  /** План живёт в ссылке — при замене шага обновляем ссылку. */
  syncUrl?: boolean;
  dayOffset?: number;
  children?: React.ReactNode;
}

const START_OPTIONS = ["10:00", "11:00", "12:30", "14:00", "16:00"];

export function multiRouteUrl(places: Place[]) {
  return `https://yandex.ru/maps/?rtext=${places.map((p) => `${p.latitude},${p.longitude}`).join("~")}&rtt=mt`;
}

export function AdventureView(props: AdventureViewProps) {
  const [start, setStart] = useState(props.start);
  const [stopsIn, setStopsIn] = useState(props.stops);
  const [modified, setModified] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  useEffect(() => {
    setStopsIn(props.stops);
    setModified(false);
  }, [props.stops]);

  const fam = useFamily();
  const { forecast } = useForecast();
  const dayOffset = props.dayOffset ?? 0;
  const dateISO = moscowDateISO(dayOffset);
  const weekday = dayOffset ? weekdayOf(dateISO) : moscowNow().weekday;
  const kids = fam.children;
  const youngest = kids.length ? Math.min(...kids.map((k) => k.age)) : 5;

  const plan = useMemo(() => {
    const p = buildPlan(stopsIn as StopInput[], { key: props.planKey, title: props.title, start, transport: fam.transport });
    if (forecast) {
      const summary = daySummary(forecast, dateISO).weather;
      p.stops.forEach((s, i) => {
        const r = wxFor(s.place, toMinutes(s.start), s.duration, { forecast, dateISO, youngest }, { weather: summary, mood: "surprise", constraints: undefined });
        s.weather = r.w;
        if (r.w?.bad && s.place.outdoor && !s.place.indoor) {
          s.backup = alternativesFor(p.stops, i, { kids, transport: fam.transport, weekday, forecast, dateISO, indoorOnly: true })[0]?.place.slug;
        }
      });
    }
    return p;
  }, [stopsIn, props.planKey, props.title, start, fam.transport, forecast, dateISO, youngest, kids, weekday]);

  const saveKey = modified ? `custom:${plan.stops.map((s) => s.place.slug).join("+")}` : props.planKey;
  const saved = fam.savedPlans.some((p) => p.key === saveKey);
  const toast = useToast((s) => s.show);
  const ageMin = modified ? plan.ageMin : props.ageOverride?.[0] ?? plan.ageMin;
  const ageMax = modified ? plan.ageMax : props.ageOverride?.[1] ?? plan.ageMax;
  const places = plan.stops.map((s) => s.place);
  const cover = props.cover ?? places[0]?.photos[0];
  const startOptions = START_OPTIONS.includes(props.start) ? START_OPTIONS : [props.start, ...START_OPTIONS].sort((a, b) => toMinutes(a) - toMinutes(b));
  const fromHome = fam.hydrated && places[0] && fam.origin.source !== "default" ? travelToPlace(fam.origin, places[0], fam.transport) : null;
  const endMin = plan.stops.length ? toMinutes(plan.stops[plan.stops.length - 1].start) + plan.stops[plan.stops.length - 1].duration : toMinutes(start);
  const bring = forecast ? bringList(windowWx(forecast, dateISO, toMinutes(start), endMin), youngest, places.some((p) => p.outdoor)) : [];
  const badIndex = plan.stops.findIndex((s) => s.weather?.bad && s.place.outdoor && !s.place.indoor);
  const badStop = badIndex >= 0 ? plan.stops[badIndex] : undefined;
  const backup = badStop?.backup ? getPlaceSync(badStop.backup) : null;

  const save = () => {
    fam.toggleSavedPlan({ key: saveKey, title: props.title, emoji: props.emoji, steps: modified ? plan.stops.map((s) => s.place.slug) : props.saveSteps });
    toast(saved ? "Убрали из сохранённых" : "Сохранили в «Наши хотелки» ❤️", saved ? undefined : { href: "/favorites?tab=plans", label: "Открыть" });
    track(saved ? "adventure_unsave" : "adventure_save", { key: saveKey });
  };

  const replaceStop = (index: number, place: Place, why: string) => {
    const next = stopsIn.map((s, i) => (i === index ? { place, duration: s.duration ?? place.average_duration } : s));
    setStopsIn(next);
    setModified(true);
    setReplacing(null);
    props.onReplace?.(index, place.slug);
    if (props.syncUrl && typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("steps", next.map((s) => s.place.slug).join(","));
      window.history.replaceState(null, "", u.toString());
    }
    toast(`Заменили на «${place.title}» ✨`);
    track("step_swapped", { reason: why, to: place.slug });
  };

  const go = () => {
    fam.addTrip({ key: saveKey, title: props.title, emoji: props.emoji, steps: plan.stops.map((s) => s.place.slug) });
    track("plan_go", { key: saveKey });
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

        {badStop && (
          <div className="mt-4 rounded-[22px] bg-blue-50 p-3.5 animate-rise" role="status">
            <p className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-blue">
              <CloudRain size={19} className="mt-0.5 shrink-0" />
              <span>
                В {badStop.start} в «{badStop.place.title}» по прогнозу {badStop.weather?.condition === "snow" ? "снег" : "дождь"} ({badStop.weather?.pop}%).
                {backup ? ` Рядом есть крытое — «${backup.title}».` : " Можно сдвинуть начало или заменить шаг."}
              </span>
            </p>
            {backup && (
              <button onClick={() => replaceStop(badIndex, backup, "weather")} className="press mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-blue text-[15px] font-bold text-white">
                Заменить на «{backup.title}» <ArrowRight size={17} />
              </button>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-2">
          <ActionPill onClick={save} active={saved} icon={<Heart size={19} className={cn(saved && "fill-current")} />}>
            {saved ? "Сохранено" : "Сохранить"}
          </ActionPill>
          <ShareAction title={props.title} />
          <ActionPill
            onClick={() => {
              downloadICS(plan, dayOffset);
              track("plan_calendar", { key: saveKey });
            }}
            icon={<CalendarPlus size={19} />}
          >
            В календарь
          </ActionPill>
          <ActionPill href={props.alternativeHref} icon={<Shuffle size={19} />}>
            Другой день
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

        {bring.length > 0 && (
          <section className="mt-4 rounded-[22px] bg-surface p-3.5 shadow-card">
            <h2 className="text-[15px] font-bold">Что взять с собой</h2>
            <ul className="mt-1.5 space-y-1 text-[14.5px] text-ink-2">
              {bring.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        )}

        {props.description && <p className="mt-5 text-[16px] leading-[1.5] text-ink-2">{props.description}</p>}

        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="tight text-[24px] font-[800]">План дня</h2>
            <Link href={`/map?plan=${places.map((p) => p.slug).join(",")}`} className="press text-[14px] font-semibold text-blue">
              На карте →
            </Link>
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <span className="flex shrink-0 items-center pr-1 text-[14px] font-semibold text-muted">Начать в</span>
            {startOptions.map((t) => (
              <button
                key={t}
                onClick={() => setStart(t)}
                aria-pressed={t === start}
                className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[14.5px] font-bold transition-colors", t === start ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
              >
                {t}
              </button>
            ))}
          </div>
          {fromHome && (
            <div className="mt-4 flex items-center gap-2 rounded-[18px] bg-fill px-3.5 py-2 text-[13.5px] font-semibold text-ink-2">
              <Home size={15} className="shrink-0" />
              <span>
                {fam.origin.source === "home" ? "Дом" : fam.origin.label} → {places[0].title}: {formatTravel(fromHome)}
                <span className="font-medium text-muted"> · выйти около {leaveAt(start, fromHome.minutes)}</span>
              </span>
            </div>
          )}
          <div className="mt-5">
            <AdventureTimeline plan={plan} editable={props.editable} onMove={props.onMove} onRemove={props.onRemove} onReplace={(i) => setReplacing(i)} />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-ink p-4 text-white">
            <span className="text-[28px]">🏁</span>
            <div className="text-[14.5px] leading-snug">
              <p className="font-bold">Финиш около {plan.stops.length ? addMin(plan.stops[plan.stops.length - 1].start, plan.stops[plan.stops.length - 1].duration) : start}</p>
              <p className="text-white/75">
                {formatDuration(plan.totalMinutes)} · {formatBudget(plan.budget)} · {formatKm(plan.distanceKm || 0.1)}
              </p>
            </div>
          </div>
        </section>
        {props.children}
      </div>

      <ReplaceSheet
        index={replacing}
        stops={plan.stops}
        onClose={() => setReplacing(null)}
        onPick={(i, p, why) => replaceStop(i, p, why)}
        opts={{ kids, transport: fam.transport, weekday, forecast, dateISO }}
      />

      <StickyCTA
        href={multiRouteUrl(places)}
        onClick={go}
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

function ReplaceSheet({
  index,
  stops,
  onClose,
  onPick,
  opts,
}: {
  index: number | null;
  stops: PlanStop[];
  onClose: () => void;
  onPick: (index: number, p: Place, why: string) => void;
  opts: Parameters<typeof alternativesFor>[2];
}) {
  const alts: Alternative[] = useMemo(() => (index == null ? [] : alternativesFor(stops, index, opts)), [index, stops, opts]);
  if (index == null) return null;
  const stop = stops[index];
  return (
    <BottomSheet open onClose={onClose} title={`Вместо «${stop.place.title}»`}>
      <p className="-mt-1 text-[14px] text-muted">
        В {stop.start}, на {formatDuration(stop.duration)} — рядом с остальными шагами и открыто в это время.
      </p>
      <div className="mt-4 space-y-2">
        {alts.length === 0 && <p className="rounded-[18px] bg-fill p-4 text-[15px] text-ink-2">Рядом нет подходящей замены на это время. Попробуйте другое время старта.</p>}
        {alts.map((a) => (
          <button key={a.place.id} onClick={() => onPick(index, a.place, a.reason)} className="press flex w-full items-center gap-3 rounded-[20px] bg-surface p-2.5 text-left shadow-card">
            <SmartImage photo={a.place.photos[0]} tint={a.place.tint} emoji={a.place.emoji} sizes="72px" className="h-16 w-16 shrink-0 rounded-[14px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15.5px] font-bold">{a.place.title}</span>
              <span className="block truncate text-[13px] text-muted">{a.place.subtitle}</span>
              <span className="mt-0.5 inline-flex gap-1.5 text-[12.5px] font-semibold">
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-green">{a.reason}</span>
                {a.minutesFromPrev != null && <span className="rounded-full bg-fill px-2 py-0.5 text-ink-2">{a.minutesFromPrev} мин от прошлого шага</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

function leaveAt(start: string, minutes: number) {
  const t = toMinutes(start) - minutes - 5;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor((t % 60) / 5) * 5).padStart(2, "0")}`;
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
    "press flex h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-center text-[12px] font-semibold leading-tight transition-colors",
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
