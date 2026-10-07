"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import type { BudgetId, Child, DurationId, InterestId, MoodId, Plan, PlannerInput, ScenarioConstraints, TransportId } from "@/lib/types";
import { useFamily, familySignals } from "@/lib/store";
import { generatePlans } from "@/lib/recommend/engine";
import { buildPlannerInput, type BuildArgs, type ResultsQuery } from "@/lib/recommend/build-input";
import { altQuery, areaAlternatives, type AreaAlt } from "@/lib/recommend/area";
import { useForecast } from "@/lib/use-context";
import { useNearbyExtras } from "@/lib/nearby";
import { DEFAULT_ORIGIN, isSuburban, locationMode, okrugById, type Origin } from "@/lib/location";
import { daySummary, moscowDateISO, weekdayOf, type Forecast } from "@/lib/forecast";
import { plural } from "@/lib/format";
import { MOODS, DURATIONS, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { scenarioById } from "@/lib/scenarios";
import { planCardData } from "@/lib/cards";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { GeoScope } from "@/components/location/GeoScope";
import { getPlaceSync } from "@/lib/data/repository";
import { LocationSheet } from "@/components/location/LocationSheet";
import { AgePicker } from "@/components/ui/AgePicker";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export type { ResultsQuery };

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
    .filter((k) => Number.isFinite(k.age) && k.age >= 0 && k.age <= 17);
}

/** Ссылка на «Наш день» по плану: шаги и время, без имён детей. */
export function planHref(plan: Plan, kidNames: string[] = [], transport?: TransportId) {
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
  // как едем: день открывается с той же дорогой, по которой он посчитан (а не с транспортом из профиля)
  if (transport) q.set("transport", transport);
  return `/day?${q}`;
}

const DAY_WORD_ACC = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function PlannerResults({ query }: { query: ResultsQuery }) {
  const router = useRouter();
  const [locOpen, setLocOpen] = useState(false);
  const fam = useFamily();
  const { forecast, loading } = useForecast();
  const nearby = useNearbyExtras();
  const scenario = scenarioById(query.s);
  const narrow = !!(scenario?.constraints?.onlyCategories?.length || scenario?.constraints?.onlyTypes?.length || scenario?.constraints?.onlyExperiences?.length);
  const urlKids = decodeKids(query.kids);
  const kids = urlKids ?? fam.children;
  const offset = Math.max(0, Math.min(60, Math.trunc(Number(query.offset ?? 0)) || 0));
  const dayOffset = Math.max(0, Math.min(6, Math.trunc(Number(query.day ?? 0)) || 0));
  // «уже показывали» берём на момент открытия, иначе выдача поедет сама от себя
  const seenRef = useRef<string[] | null>(null);
  if (fam.hydrated && seenRef.current === null) seenRef.current = fam.seen;

  const args = useMemo<BuildArgs | null>(() => {
    if (!fam.hydrated || !forecast) return null;
    return {
      query,
      kids,
      origin: fam.origin,
      prefs: { budget: fam.budget, transport: fam.transport, maxTravelMin: fam.maxTravelMin, geoScope: fam.geoScope },
      forecast,
      extraPlaces: nearby.places,
      family: { ...familySignals(fam), seen: seenRef.current ?? [] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fam.hydrated, forecast, JSON.stringify(query), JSON.stringify(kids), fam.origin, fam.budget, fam.transport, fam.maxTravelMin, fam.geoScope, fam.wantPlaces, fam.visitedPlaces, fam.loved, fam.disliked, nearby.places]);
  const input = useMemo<PlannerInput | null>(() => (args ? buildPlannerInput(args) : null), [args]);

  const result = useMemo(() => (input ? generatePlans(input, 3, offset) : null), [input, offset]);
  // «в округе мало или нет»: что предложить вместо пустоты — другой округ и другие ситуации, которые здесь работают
  const alt = useMemo<AreaAlt | null>(
    () => (args && input && result && offset === 0 && result.area?.scope === "strict" && result.plans.length < 3 ? areaAlternatives(args, input) : null),
    [args, input, result, offset]
  );

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
  const anchorPlace = query.anchor ? getPlaceSync(query.anchor) : undefined;
  const dayWord = realDay === 0 ? "сегодня" : realDay === 1 ? "завтра" : `в ${dayAcc}`;
  const sum = daySummary(forecast!, dateISO);
  const t = (n: number) => `${n > 0 ? "+" : ""}${n}°`;
  const wxLine = sum.allWet ? `${t(sum.weather.temp)}, дождь весь день` : sum.rainFrom ? `${t(sum.weather.temp)}, с ${sum.rainFrom} дождь` : `${t(sum.weather.temp)}, ${sum.weather.label}`;
  const label = <T extends { id: string; label: string }>(arr: readonly T[], id: string) => arr.find((x) => x.id === id)?.label;
  const kidNames = fam.children.map((k) => k.name).filter(Boolean);
  const here = result.area ? okrugById(result.area.id) : undefined;
  const areaEmpty = !!here && result.area?.scope === "strict" && result.plans.length === 0;
  const pickOrigin = (o: Origin) => {
    track("area_switch", { from: here?.id ?? "", to: o.label });
    fam.setOrigin(o);
    router.replace(withQuery({ offset: undefined, wide: undefined }));
  };

  return (
    <main className="pb-16">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback="/" />
        <div className="flex min-w-0 items-center gap-2">
          <GeoScope where="results" />
          <Link href={query.anchor ? `/planner?anchor=${encodeURIComponent(query.anchor)}` : "/planner"} aria-label="Изменить условия" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-card">
            <SlidersHorizontal size={20} />
          </Link>
        </div>
      </header>

      <section className="px-4 pt-3">
        {scenario && (
          <div className="mb-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-purple-50 px-3 text-[14px] font-bold text-purple-ink">
              {scenario.emoji ?? "✨"} {scenario.label}
            </span>
            {scenario.hint && <span className="ml-2 text-[14px] font-medium text-muted">{scenario.hint}</span>}
          </div>
        )}
        <h1 className="tight text-[30px] font-[850] leading-[1.06]">
          {result.plans.length ? (
            anchorPlace ? <>День вокруг «{anchorPlace.title}»</> : <>Мы придумали вам {dayAcc} 💛</>
          ) : areaEmpty && here ? (
            <>{cap(here.prep)} под это ничего нет</>
          ) : (
            <>Хм, ничего не нашлось</>
          )}
        </h1>
        <p className="mt-1.5 text-[16px] leading-snug text-muted">
          {result.plans.length
            ? `Старт ${dayWord} около ${result.startLabel}. Погода ${wxLine} — учли прогноз и дорогу.`
            : areaEmpty && here
              ? `${scenario ? `Для «${scenario.label}»` : "Под такие условия"} ${here.prep} не нашлось ни одного подходящего места: смотрели возраст детей, выбранные условия, погоду и дорогу. Вот что можно сделать.`
              : "Под такие условия мы не смогли собрать день без компромиссов."}
        </p>
        {realDay !== dayOffset && result.plans.length > 0 && (
          <p className="mt-2 rounded-[12px] bg-yellow-50 px-3 py-2 text-[14px] text-yellow-ink">Сегодня уже поздно для такого дня — собрали на завтра.</p>
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
          <Chip>📍 {input.locationMode === "any" ? (input.geoScope === "moscow-region" ? "Москва + область" : "Москва") : fam.origin.source === "home" ? "Дом" : result.area?.scope === "wide" ? `${fam.origin.label} + соседние` : fam.origin.label}</Chip>
          {input.constraints?.maxTravelMin && <Chip>до {input.constraints.maxTravelMin} мин в пути</Chip>}
        </div>
        {!kids.length && (
          <div className="mt-4 rounded-[24px] bg-surface p-3.5 shadow-card">
            <p className="text-[15px] font-bold">Сколько лет ребёнку? Подберём точнее</p>
            <AgePicker className="mt-2.5" onPick={(age) => fam.upsertChild({ id: `c${Date.now()}`, name: "", age, interests: [], emoji: "🦁" })} />
          </div>
        )}
        {input.locationMode === "any" && input.geoScope === "moscow" && (
          <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-green-50 px-3 py-2.5 text-[14px] leading-snug text-green-ink">
            <span className="flex-1"><strong>Есть ещё Подмосковье.</strong> Можно добавить Красногорск, Одинцово, Истру, Химки и другие направления.</span>
            <button onClick={() => fam.setPrefs({ geoScope: "moscow-region" })} className="press hit relative h-10 shrink-0 rounded-full bg-white px-4 text-[14px] font-semibold">
              + Область
            </button>
          </div>
        )}
        {input.locationMode === "any" && input.geoScope === "moscow-region" && (
          <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-purple-50 px-3 py-2.5 text-[14px] leading-snug text-purple-ink">
            <span className="flex-1">
              {anchorPlace
                ? "Ищем по Москве и Подмосковью."
                : input.duration === "short" || input.duration === "mid"
                  ? "Ищем по Москве и Подмосковью. На 2–4 часа в основном город — за город едем на полдня и дольше."
                  : "Ищем по Москве и Подмосковью: в днях есть выезды за город, дорога от Москвы указана в карточке."}
            </span>
            <button onClick={() => fam.setPrefs({ geoScope: "moscow" })} className="press shrink-0 rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold">
              Только Москва
            </button>
          </div>
        )}
        {input.locationMode === "any" && (!!scenario?.constraints?.maxTravelMin || query.near === "1" || !!query.travel) && (
          <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-blue-50 px-3 py-2.5 text-[14px] leading-snug text-blue-ink">
            <span className="flex-1">Эта ситуация про «рядом», а место не выбрано — ищем по всей Москве. Выберите округ или точку, и подберём недалеко от вас.</span>
            <button onClick={() => setLocOpen(true)} className="press shrink-0 rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold">
              Выбрать
            </button>
          </div>
        )}
        {here && result.area?.scope === "wide" && (
          <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-blue-50 px-3 py-2.5 text-[14px] leading-snug text-blue-ink">
            <span className="flex-1">Ищем {here.prep} и в ближайших округах — места из {here.short} идут первыми.</span>
            <Link href={withQuery({ wide: undefined, offset: undefined })} replace className="press shrink-0 rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold">
              Только {here.short}
            </Link>
          </div>
        )}
        {here && result.area?.scope === "strict" && result.area.loose && result.plans.length > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-yellow-50 px-3 py-2.5 text-[14px] leading-snug text-yellow-ink">
            <span className="flex-1">Показываем всё, что есть {here.prep}: по теме {scenario ? `«${scenario.label}»` : "ситуации"} здесь почти ничего нет.</span>
            <Link href={withQuery({ loose: undefined, offset: undefined })} replace className="press shrink-0 rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold">
              Только по теме
            </Link>
          </div>
        )}
        {result.relaxed && (
          <p className="mt-3 rounded-[12px] bg-yellow-50 px-3 py-2 text-[14px] leading-snug text-yellow-ink">
            📍 Рядом с вами подходящих мест немного, поэтому мы расширили поиск до {result.relaxed.to} мин в пути
            {result.relaxed.nearest ? ` (ближайшее подходящее — в ${result.relaxed.nearest} мин)` : ""}. Если хочется ближе — смените место поиска или условия.
          </p>
        )}
        {!result.relaxed && nearby.status === "error" && locationMode(fam.origin) !== "any" && (isSuburban(fam.origin) || input?.locationMode === "area") && (
          <p className="mt-3 rounded-[12px] bg-fill-2 px-3 py-2 text-[13px] leading-snug text-muted">
            Не удалось подгрузить дополнительные места {result.area ? `в ${okrugById(result.area.id)?.short ?? "округе"}` : "рядом с вами"} (нет связи с картой). Показываем то, что есть в нашем каталоге.
          </p>
        )}
        {result.partialAge && (
          <p className="mt-3 rounded-[12px] bg-blue-50 px-3 py-2 text-[14px] leading-snug text-blue-ink">
            Мест, интересных сразу всем вашим детям, рядом мало — часть шагов подойдёт кому-то одному. Это отмечено в карточках.
          </p>
        )}
      </section>

      {result.plans.length > 0 ? (
        <div className="mt-5 space-y-4 px-4">
          {result.plans.map((p, i) => (
            <div key={p.key} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">
                {["Вариант мечты", "Запасной план", "Неожиданная идея"][(i + offset) % 3] ?? "Вариант"}
              </p>
              <AdventureCard data={planCardData(p, planHref(p, kidNames, input.transport))} variant="full" priority={i === 0} />
            </div>
          ))}
          <Link
            href={withQuery({ offset: String(offset + 3) })}
            className="press flex h-14 items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold shadow-card"
          >
            <RefreshCw size={20} /> Показать другие варианты
          </Link>
          {alt && here && (
            <AreaGap alt={alt} mode="few" offType={result.area?.offType ?? 0} scenarioLabel={scenario?.label} kidNames={kidNames} query={query} withQuery={withQuery} onPick={pickOrigin} transport={input?.transport} />
          )}
        </div>
      ) : (
        <div className="px-4">
          {areaEmpty && alt && here ? (
            <AreaGap alt={alt} mode="none" offType={result.area?.offType ?? 0} scenarioLabel={scenario?.label} kidNames={kidNames} query={query} withQuery={withQuery} onPick={pickOrigin} transport={input?.transport} />
          ) : (
            <EmptyState
              art="plan"
              title={offset > 0 ? "Варианты закончились" : "Давайте чуть ослабим условия"}
              text={
                offset > 0
                  ? "Мы показали всё, что подходит. Вернуться к лучшим?"
                  : narrow
                    ? `Под «${scenario?.label}» сейчас ничего не подошло — возможно, сезон ещё не открыт или нет мест для вашего возраста и бюджета. Вот что можно сделать:`
                    : "Вот что поможет найти отличный день:"
              }
              action={offset > 0 ? { href: withQuery({ offset: undefined }), label: "К лучшим вариантам" } : undefined}
            />
          )}
          {areaEmpty && <p className="mb-2 mt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Или ослабить условия</p>}
          <div className="space-y-2">
            {result.suggestions.map((s) =>
              s.patch.anywhere ? (
                <button
                  key={s.label}
                  onClick={() => fam.setOrigin(DEFAULT_ORIGIN)}
                  className="press flex w-full items-center justify-between rounded-[20px] bg-surface px-4 py-4 text-left text-[16px] font-semibold shadow-card"
                >
                  {s.label} <span className="text-pink-ink">→</span>
                </button>
              ) : (
              <Link
                key={s.label}
                href={withQuery({ ...(Object.fromEntries(Object.entries(s.patch).map(([k, v]) => [k, String(v)])) as Record<string, string>), offset: undefined })}
                className="press flex items-center justify-between rounded-[20px] bg-surface px-4 py-4 text-[16px] font-semibold shadow-card"
              >
                {s.label} <span className="text-pink-ink">→</span>
              </Link>
              )
            )}
            <Link href="/scenarios" className="press flex items-center justify-between rounded-[20px] bg-pink-50 px-4 py-4 text-[16px] font-semibold text-pink-ink">
              Выбрать другую ситуацию <span>→</span>
            </Link>
          </div>
        </div>
      )}
      <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
    </main>
  );
}

/**
 * «В округе подходящего нет / мало»: честно говорим об этом и даём два выхода —
 * то же самое в ближайшем округе и другие ситуации, которые в этом округе реально работают.
 */
function AreaGap({
  alt,
  mode,
  offType,
  scenarioLabel,
  kidNames,
  query,
  withQuery,
  onPick,
  transport,
}: {
  alt: AreaAlt;
  mode: "none" | "few";
  /** Сколько мест в округе подходят по условиям, но не «по теме» ситуации. */
  offType: number;
  scenarioLabel?: string;
  kidNames: string[];
  query: ResultsQuery;
  withQuery: (patch: Record<string, string | undefined>) => string;
  onPick: (o: Origin) => void;
  transport?: TransportId;
}) {
  const { here, others, scenarios } = alt;
  const hrefFor = (id: string) => `/planner/results?${new URLSearchParams(altQuery(query, id))}`;
  const nothing = !others.length && !scenarios.length;
  return (
    <section className={cn("space-y-6", mode === "none" ? "mt-5" : "mt-2 rounded-[24px] bg-surface p-4 shadow-card")} aria-label={`Что делать, если ${here.prep} мало мест`}>
      {mode === "few" && (
        <div>
          <h2 className="tight text-[20px] font-[800] leading-tight">{cap(here.prep)} это всё, что подошло</h2>
          <p className="mt-1 text-[14px] leading-snug text-muted">
            {scenarioLabel ? `Для «${scenarioLabel}»` : "Под ваши условия"} {here.prep} больше вариантов нет. Можно заглянуть в другой округ или выбрать другую ситуацию.
          </p>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {mode === "none" && <h2 className="tight text-[22px] font-[800] leading-tight">То же самое — в другом округе</h2>}
          {mode === "none" && <p className="mt-1 text-[14px] leading-snug text-muted">Ближайшее подходящее — {others[0].label}, это ≈ {others[0].minutes} мин от {here.short}.</p>}
          <div className={cn("space-y-5", mode === "none" ? "mt-3" : "mt-0")}>
            {others.map((o, oi) => (
              <div key={o.key}>
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <p className="min-w-0 text-[13px] font-bold uppercase tracking-wide text-muted">
                    {o.label} · ≈ {o.minutes} мин от {here.short}
                  </p>
                  <button onClick={() => onPick(o.origin)} className="press hit relative h-9 shrink-0 rounded-full bg-ink px-3.5 text-[14px] font-semibold text-white">
                    Искать в {o.label}
                  </button>
                </div>
                {mode === "none" &&
                  o.plans.slice(0, oi === 0 ? 2 : 1).map((p) => (
                    <div key={p.key} className="mb-3">
                      <AdventureCard data={planCardData(p, planHref(p, kidNames, transport), `от ${here.short}`)} variant="full" />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenarios.length > 0 && (
        <div>
          <h2 className="tight text-[20px] font-[800] leading-tight">Что подойдёт {here.prep}</h2>
          <p className="mt-1 text-[14px] leading-snug text-muted">Для этих ситуаций {here.prep} места есть — например, прогулка вместо музея.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {scenarios.map(({ def, plans }) => (
              <Link key={def.id} href={hrefFor(def.id)} className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-pink-50 px-3.5 py-2 text-[15px] font-semibold text-pink-ink">
                <span aria-hidden>{def.emoji ?? "✨"}</span>
                {def.label}
                <span className="text-[12px] font-semibold opacity-70">{plans} {plural(plans, "вариант", "варианта", "вариантов")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {nothing && <p className="text-[14px] leading-snug text-muted">{cap(here.prep)} каталог пока небогат. Можно искать по всей Москве или добавить ближайшие округа.</p>}

      {offType > 0 && (
        <Link href={withQuery({ loose: "1", offset: undefined })} className="press flex min-h-12 items-center justify-center rounded-full bg-fill-2 px-4 py-2 text-center text-[15px] font-semibold">
          Показать, что есть {here.prep} (не совсем по теме)
        </Link>
      )}
      <Link href={withQuery({ wide: "1", offset: undefined })} className="press flex h-12 items-center justify-center rounded-full bg-fill-2 text-[15px] font-semibold">
        Показать и ближайшие округа
      </Link>
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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
            className={cn("press flex h-12 shrink-0 items-center gap-2 rounded-[16px] px-3 text-[15px] font-bold", on ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
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
    <span className={tone ? "inline-flex h-8 shrink-0 items-center rounded-full bg-purple-50 px-3 text-[13px] font-semibold text-purple-ink" : "inline-flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-[13px] font-semibold shadow-card"}>
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
