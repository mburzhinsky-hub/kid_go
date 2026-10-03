"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { BudgetId, Child, DurationId, InterestId, MoodId, Plan, TransportId } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { generatePlans } from "@/lib/recommend/engine";
import { getWeather } from "@/lib/weather";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { weekdayAccusative, plural } from "@/lib/format";
import { MOODS, DURATIONS, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { planCardData } from "@/lib/cards";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { encodeKids } from "./PlannerWizard";

export type ResultsQuery = Record<string, string | undefined>;

function decodeKids(raw?: string): Pick<Child, "name" | "age" | "interests">[] | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.split(":"))
    .filter((p) => p.length >= 2)
    .map(([n, a, i]) => ({ name: decodeURIComponent(n), age: Number(a), interests: (i ? i.split(".") : []) as InterestId[] }));
}

export function planHref(plan: Plan) {
  const q = new URLSearchParams({
    steps: plan.stops.map((s) => s.place.slug).join(","),
    title: plan.title,
    emoji: plan.emoji,
    start: plan.stops[0]?.start ?? "12:00",
    d: plan.stops.map((s) => s.duration).join(","),
    why: plan.explanation,
    chips: plan.why.join("|"),
  });
  return `/day?${q}`;
}

export function PlannerResults({ query }: { query: ResultsQuery }) {
  const router = useRouter();
  const storeKids = useFamily((s) => s.children);
  const hydrated = useFamily((s) => s.hydrated);
  const prefBudget = useFamily((s) => s.budget);
  const prefTransport = useFamily((s) => s.transport);
  const prefs = { budget: prefBudget, transport: prefTransport };
  const urlKids = decodeKids(query.kids);
  const kids = urlKids ?? storeKids;
  const offset = Number(query.offset ?? 0);

  const input = useMemo(() => {
    const now = new Date();
    const weatherOverride = query.weather === "rain" ? "rain" : query.weather === "sun" ? "sun" : undefined;
    return {
      children: kids,
      duration: (query.duration ?? "mid") as DurationId,
      mood: (query.mood ?? "surprise") as MoodId,
      budget: (query.budget ?? (urlKids ? "any" : prefs.budget)) as BudgetId,
      transport: (query.transport ?? prefs.transport) as TransportId,
      location: DEFAULT_LOCATION,
      weather: getWeather(now, weatherOverride),
      now,
      foodAfter: query.food === "1",
      maxDistanceKm: query.near === "1" ? 6 : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), JSON.stringify(kids), prefs.budget, prefs.transport]);

  const result = useMemo(() => generatePlans(input, 3, offset), [input, offset]);

  if (!urlKids && !hydrated) return <ResultsSkeleton />;

  const dayWord = result.tomorrow ? weekdayAccusative(new Date(Date.now() + 86400000)) : weekdayAccusative();
  const label = <T extends { id: string; label: string }>(arr: readonly T[], id: string) => arr.find((x) => x.id === id)?.label;
  const withQuery = (patch: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null) as [string, string][]);
    if (!q.get("kids") && kids.length) q.set("kids", encodeKids(kids));
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    return `/planner/results?${q}`;
  };

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
        <button onClick={() => router.push("/")} aria-label="На главную" className="press grid h-11 w-11 place-items-center rounded-full bg-surface shadow-card">
          <ArrowLeft size={22} />
        </button>
        <Link href="/planner" className="press inline-flex h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[14.5px] font-semibold shadow-card">
          <SlidersHorizontal size={17} /> Изменить
        </Link>
      </header>

      <section className="px-4 pt-3">
        <h1 className="tight text-[31px] font-[850] leading-[1.06]">
          {result.plans.length ? <>Мы придумали вам {dayWord} 💛</> : <>Хм, ничего не нашлось</>}
        </h1>
        <p className="mt-1.5 text-[15.5px] text-muted">
          {result.plans.length
            ? `Старт ${result.tomorrow ? "завтра " : ""}около ${result.startLabel}. Проверили погоду (${input.weather.temp > 0 ? "+" : ""}${input.weather.temp}°, ${input.weather.label}), часы работы и дорогу.`
            : "Под такие условия мы не смогли собрать день без компромиссов."}
        </p>
        <div className="no-scrollbar -mx-4 mt-3.5 flex gap-1.5 overflow-x-auto px-4">
          {query.q && <Chip tone="purple">«{query.q}»</Chip>}
          {kids.map((k) => (
            <Chip key={k.name + k.age}>
              {k.name}, {k.age} {plural(k.age, "год", "года", "лет")}
            </Chip>
          ))}
          <Chip>{label(DURATIONS, input.duration)}</Chip>
          <Chip>{MOODS.find((m) => m.id === input.mood)?.emoji} {label(MOODS, input.mood)}</Chip>
          <Chip>{label(BUDGETS, input.budget)}</Chip>
          <Chip>{label(TRANSPORTS, input.transport)}</Chip>
        </div>
      </section>

      {result.plans.length > 0 ? (
        <div className="mt-5 space-y-4 px-4">
          {result.plans.map((p, i) => (
            <div key={p.key} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">
                {["Вариант мечты", "Запасной план", "Ещё идея"][i] ?? "Вариант"}
              </p>
              <AdventureCard data={planCardData(p, planHref(p))} variant="full" priority={i === 0} />
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
            action={offset > 0 ? { href: withQuery({ offset: "0" }), label: "К лучшим вариантам" } : undefined}
          />
          <div className="space-y-2">
            {result.suggestions.map((s) => (
              <Link
                key={s.label}
                href={withQuery({ ...(s.patch as Record<string, string>), offset: "0" })}
                className="press flex items-center justify-between rounded-[20px] bg-surface px-4 py-4 text-[16px] font-semibold shadow-card"
              >
                {s.label} <span className="text-pink">→</span>
              </Link>
            ))}
            <Link href="/adventures" className="press flex items-center justify-between rounded-[20px] bg-pink-50 px-4 py-4 text-[16px] font-semibold text-pink">
              Посмотреть готовые приключения <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </main>
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
    <main className="px-4 pt-20">
      <div className="h-9 w-4/5 rounded-xl skeleton" />
      <div className="mt-3 h-5 w-3/5 rounded-lg skeleton" />
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
