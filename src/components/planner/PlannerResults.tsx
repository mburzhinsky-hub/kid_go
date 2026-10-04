"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { BudgetId, Child, DurationId, InterestId, MoodId, Plan, PlannerInput, ScenarioConstraints, TransportId } from "@/lib/types";
import { useFamily, familySignals } from "@/lib/store";
import { generatePlans } from "@/lib/recommend/engine";
import { useForecast } from "@/lib/use-context";
import { useNearbyExtras } from "@/lib/nearby";
import { isSuburban } from "@/lib/location";
import { daySummary, moscowDateISO, weekdayOf, type Forecast } from "@/lib/forecast";
import { plural } from "@/lib/format";
import { MOODS, DURATIONS, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { scenarioById } from "@/lib/scenarios";
import { planCardData } from "@/lib/cards";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LocationChip } from "@/components/location/LocationChip";
import { AgePicker } from "@/components/ui/AgePicker";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export type ResultsQuery = Record<string, string | undefined>;

/** В ссылке — только возраст и интересы, без имён детей. */
export function encodeKids(kids: Pick<Child, "age" | "interests">[]) {
  return kids.map((k) => `${k.age}:${k.interests.join(".")}`).join(",");
}

export function decodeKids(raw?: string): Pick<Child, "name" | "age" | "interests">[] | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.split(":"))
    .filter((p) => p.length >= 1 && p[0] !== "")
    .map((p) => {
      // старый формат «имя:возраст:интересы» — имя отбрасываем
      const [a, i] = p.length >= 3 ? [p[1], p[2]] : [p[0], p[1]];
      return { name: "", age: Number(a), interests: (i ? i.split(".").filter(Boolean) : []) as InterestId[] };
    })
    .filter((k) => Number.isFinite(k.age));
}

/** Ссылка на «Наш день» по плану: шаги и время, без имён детей. */
export function planHref(plan: Plan, kidNames: string[] = []) {
  const chips = plan.why.filter((w) => !kidNames.some((n) => n && w.includes(n)));
  const q = new URLSearchParams({
    steps: plan.stops.map((s) => s.place.slug).join(","),
    title: plan.title,
    emoji: plan.emoji,
    start: plan.stops[0]?.start ?? "12:00",
    d: plan.stops.map((s) => s.duration).join(","),
    why: kidNames.reduce((t, n) => (n ? t.split(n).join("ребёнок") : t), plan.explanation),
    chips: chips.join("|"),
  });
  if (plan.dayOffset) q.set("day", String(plan.dayOffset));
  return `/day?${q}`;
}

const DAY_WORD_ACC = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function PlannerResults({ query }: { query: ResultsQuery }) {
  const router = useRouter();
  const fam = useFamily();
  const { forecast, loading } = useForecast();
  const nearby = useNearbyExtras();
  const scenario = scenarioById(query.s);
  const urlKids = decodeKids(query.kids);
  const kids = urlKids ?? fam.children;
  const offset = Number(query.offset ?? 0);
  const dayOffset = Math.max(0, Math.min(6, Number(query.day ?? 0)));
  // «уже показывали» берём на момент открытия, иначе выдача поедет сама от себя
  const seenRef = useRef<string[] | null>(null);
  if (fam.hydrated && seenRef.current === null) seenRef.current = fam.seen;

  const input = useMemo<PlannerInput | null>(() => {
    if (!fam.hydrated || !forecast) return null;
    const now = new Date();
    const constraints: ScenarioConstraints = { ...(scenario?.constraints ?? {}) };
    if (query.weather === "rain") constraints.indoorOnly = true;
    if (query.weather === "sun") constraints.outdoorPreferred = true;
    const travel = Number(query.travel) || undefined;
    constraints.maxTravelMin = travel ?? Math.min(constraints.maxTravelMin ?? 999, Math.max(fam.maxTravelMin, 20));
    if (constraints.maxTravelMin >= 999) delete constraints.maxTravelMin;
    const dateISO = moscowDateISO(dayOffset);
    const ages = kids.map((k) => k.age).join(".");
    return {
      children: kids,
      duration: (query.duration ?? scenario?.duration ?? "mid") as DurationId,
      mood: (query.mood ?? scenario?.mood ?? "surprise") as MoodId,
      budget: (query.budget ?? scenario?.budget ?? fam.budget) as BudgetId,
      transport: (query.transport ?? fam.transport) as TransportId,
      location: fam.origin,
      extraPlaces: nearby.places.length ? nearby.places : undefined,
      weather: daySummary(forecast, dateISO).weather,
      forecast,
      dayOffset,
      now,
      foodAfter: query.food === "1" || !!scenario?.food,
      maxDistanceKm: query.near === "1" ? 5 : undefined,
      family: { ...familySignals(fam), seen: seenRef.current ?? [] },
      constraints,
      seed: `${dateISO}:${ages}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fam.hydrated, forecast, JSON.stringify(query), JSON.stringify(kids), fam.origin, fam.budget, fam.transport, fam.maxTravelMin, fam.wantPlaces, fam.visitedPlaces, fam.loved, fam.disliked, nearby.places]);

  const result = useMemo(() => (input ? generatePlans(input, 3, offset) : null), [input, offset]);

  const markSeen = fam.markSeen;
  const shownKey = result?.plans.map((p) => p.key).join("|");
  useEffect(() => {
    if (!result || !shownKey) return;
    markSeen(result.plans.map((p) => p.stops[0].place.slug));
    track("plan_generated", { scenario: query.s ?? "", count: result.plans.length, day: result.dayOffset, forecast: forecast?.source ?? "" });
    if (!result.plans.length) track("empty_result", { q: JSON.stringify(query) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  if (!fam.hydrated || loading || nearby.settling || !result || !input) return <ResultsSkeleton />;

  const withQuery = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null) as [string, string][]);
    for (const [k, v] of Object.entries(patch)) (v == null ? q.delete(k) : q.set(k, v));
    return `/planner/results?${q}`;
  };

  const realDay = result.dayOffset;
  const dateISO = moscowDateISO(realDay);
  const dayAcc = DAY_WORD_ACC[weekdayOf(dateISO)];
  const dayWord = realDay === 0 ? "сегодня" : realDay === 1 ? "завтра" : `в ${dayAcc}`;
  const sum = daySummary(forecast!, dateISO);
  const t = (n: number) => `${n > 0 ? "+" : ""}${n}°`;
  const wxLine = sum.allWet ? `${t(sum.weather.temp)}, дождь весь день` : sum.rainFrom ? `${t(sum.weather.temp)}, с ${sum.rainFrom} дождь` : `${t(sum.weather.temp)}, ${sum.weather.label}`;
  const label = <T extends { id: string; label: string }>(arr: readonly T[], id: string) => arr.find((x) => x.id === id)?.label;
  const kidNames = fam.children.map((k) => k.name).filter(Boolean);

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
        <button onClick={() => router.push("/")} aria-label="На главную" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-card">
          <ArrowLeft size={22} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <LocationChip tone="card" className="h-11" />
          <Link href="/planner" aria-label="Изменить условия" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-card">
            <SlidersHorizontal size={19} />
          </Link>
        </div>
      </header>

      <section className="px-4 pt-3">
        {scenario && (
          <div className="mb-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-purple-50 px-3 text-[13.5px] font-bold text-purple">
              {scenario.emoji ?? "✨"} {scenario.label}
            </span>
            {scenario.hint && <span className="ml-2 text-[13.5px] font-medium text-muted">{scenario.hint}</span>}
          </div>
        )}
        <h1 className="tight text-[31px] font-[850] leading-[1.06]">
          {result.plans.length ? (
            <>Мы придумали вам {dayAcc} 💛</>
          ) : (
            <>Хм, ничего не нашлось</>
          )}
        </h1>
        <p className="mt-1.5 text-[15.5px] leading-snug text-muted">
          {result.plans.length
            ? `Старт ${dayWord} около ${result.startLabel}. Погода ${wxLine} — проверили прогноз на каждый шаг, часы работы и дорогу.`
            : "Под такие условия мы не смогли собрать день без компромиссов."}
        </p>
        {realDay !== dayOffset && result.plans.length > 0 && (
          <p className="mt-2 rounded-[14px] bg-yellow-50 px-3 py-2 text-[13.5px] text-[#7a5600]">Сегодня уже поздно для такого дня — собрали на завтра.</p>
        )}

        <DayPicker forecast={forecast!} value={realDay} hrefFor={(d) => withQuery({ day: d ? String(d) : undefined, offset: undefined })} />

        <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
          {query.q && <Chip tone="purple">«{query.q}»</Chip>}
          {kids.map((k, i) => (
            <Chip key={i}>{k.name ? `${k.name}, ` : ""}{k.age === 0 ? "до года" : `${k.age} ${plural(k.age, "год", "года", "лет")}`}</Chip>
          ))}
          <Chip>{label(DURATIONS, input.duration)}</Chip>
          <Chip>
            {MOODS.find((m) => m.id === input.mood)?.emoji} {label(MOODS, input.mood)}
          </Chip>
          <Chip>{label(BUDGETS, input.budget)}</Chip>
          <Chip>{label(TRANSPORTS, input.transport)}</Chip>
          {input.constraints?.maxTravelMin && <Chip>до {input.constraints.maxTravelMin} мин в пути</Chip>}
        </div>
        {!kids.length && (
          <div className="mt-4 rounded-[22px] bg-surface p-3.5 shadow-card">
            <p className="text-[15px] font-bold">Сколько лет ребёнку? Подберём точнее</p>
            <AgePicker className="mt-2.5" onPick={(age) => fam.upsertChild({ id: `c${Date.now()}`, name: "", age, interests: [], emoji: "🦁" })} />
          </div>
        )}
        {result.relaxed && (
          <p className="mt-3 rounded-[14px] bg-yellow-50 px-3 py-2 text-[13.5px] leading-snug text-[#7a5600]">
            📍 Рядом с вами подходящих мест немного, поэтому мы расширили поиск до {result.relaxed.to} мин в пути
            {result.relaxed.nearest ? ` (ближайшее подходящее — в ${result.relaxed.nearest} мин)` : ""}. Если хочется ближе — смените точку выезда или условия.
          </p>
        )}
        {!result.relaxed && nearby.status === "error" && isSuburban(fam.origin) && (
          <p className="mt-3 rounded-[14px] bg-fill-2 px-3 py-2 text-[13px] leading-snug text-muted">
            Не удалось подгрузить места рядом с вами (нет связи с картой). Показываем то, что есть в нашем каталоге.
          </p>
        )}
        {result.partialAge && (
          <p className="mt-3 rounded-[14px] bg-blue-50 px-3 py-2 text-[13.5px] leading-snug text-blue">
            Мест, интересных сразу всем вашим детям, рядом мало — часть шагов подойдёт кому-то одному. Это отмечено в карточках.
          </p>
        )}
      </section>

      {result.plans.length > 0 ? (
        <div className="mt-5 space-y-4 px-4">
          {result.plans.map((p, i) => (
            <div key={p.key} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">
                {["Вариант мечты", "Запасной план", "Неожиданная идея"][(i + offset) % 3] ?? "Вариант"}
              </p>
              <AdventureCard data={planCardData(p, planHref(p, kidNames))} variant="full" priority={i === 0} />
            </div>
          ))}
          <Link
            href={withQuery({ offset: String(offset + 3) })}
            className="press flex h-14 items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold shadow-card"
          >
            <RefreshCw size={18} /> Показать другие варианты
          </Link>
        </div>
      ) : (
        <div className="px-4">
          <EmptyState
            art="plan"
            title={offset > 0 ? "Варианты закончились" : "Давайте чуть ослабим условия"}
            text={offset > 0 ? "Мы показали всё, что подходит. Вернуться к лучшим?" : "Вот что поможет найти отличный день:"}
            action={offset > 0 ? { href: withQuery({ offset: undefined }), label: "К лучшим вариантам" } : undefined}
          />
          <div className="space-y-2">
            {result.suggestions.map((s) => (
              <Link
                key={s.label}
                href={withQuery({ ...(Object.fromEntries(Object.entries(s.patch).map(([k, v]) => [k, String(v)])) as Record<string, string>), offset: undefined })}
                className="press flex items-center justify-between rounded-[20px] bg-surface px-4 py-4 text-[16px] font-semibold shadow-card"
              >
                {s.label} <span className="text-pink">→</span>
              </Link>
            ))}
            <Link href="/scenarios" className="press flex items-center justify-between rounded-[20px] bg-pink-50 px-4 py-4 text-[16px] font-semibold text-pink">
              Выбрать другую ситуацию <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

/** Сегодня / завтра / выходные — с мини-прогнозом на день. */
function DayPicker({ forecast, value, hrefFor }: { forecast: Forecast; value: number; hrefFor: (d: number) => string }) {
  const days = useMemo(() => {
    const out: number[] = [0, 1];
    for (let d = 2; d < 7; d++) {
      const wd = weekdayOf(moscowDateISO(d));
      if (wd >= 5) out.push(d);
    }
    return out.slice(0, 4);
  }, []);
  return (
    <div className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="День">
      {days.map((d) => {
        const iso = moscowDateISO(d);
        const s = daySummary(forecast, iso);
        const icon = s.allWet ? (s.weather.condition === "snow" ? "🌨" : "🌧") : s.rainFrom ? "🌦" : s.window.condition === "sun" ? "☀️" : "⛅";
        const name = d === 0 ? "Сегодня" : d === 1 ? "Завтра" : DAY_SHORT[weekdayOf(iso)];
        const on = d === value;
        return (
          <Link
            key={d}
            href={hrefFor(d)}
            role="tab"
            aria-selected={on}
            replace
            className={cn("press flex h-12 shrink-0 items-center gap-2 rounded-[16px] px-3 text-[14.5px] font-bold", on ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
          >
            <span className="text-[20px] leading-none">{icon}</span>
            <span className="leading-tight">
              {name}
              <span className={cn("block text-[12px] font-semibold", on ? "text-white/75" : "text-muted")}>
                {s.weather.temp > 0 ? "+" : ""}
                {s.weather.temp}°
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "purple" }) {
  return (
    <span className={tone ? "inline-flex h-8 shrink-0 items-center rounded-full bg-purple-50 px-3 text-[13px] font-semibold text-purple" : "inline-flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-[13px] font-semibold shadow-card"}>
      {children}
    </span>
  );
}

export function ResultsSkeleton() {
  return (
    <main className="px-4 pt-20" aria-busy="true">
      <div className="h-9 w-4/5 rounded-xl skeleton" />
      <div className="mt-3 h-5 w-3/5 rounded-lg skeleton" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 w-24 rounded-[16px] skeleton" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="mt-6 overflow-hidden rounded-[24px] bg-surface shadow-card">
          <div className="aspect-[16/10] skeleton" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-2/3 rounded-lg skeleton" />
            <div className="h-4 w-1/2 rounded-lg skeleton" />
          </div>
        </div>
      ))}
    </main>
  );
}
