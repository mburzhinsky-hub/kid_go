"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Plus, Minus, Check, Wand2, Pencil, ChevronDown, SlidersHorizontal, MapPin } from "lucide-react";
import type { BudgetId, DurationId, MoodId, TransportId, Child } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { goBack } from "@/lib/nav";
import { MOODS, DURATIONS, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { parseQuery } from "@/lib/recommend/nlu";
import { anchorDuration } from "@/lib/recommend/build-input";
import { getPlaceSync } from "@/lib/data/repository";
import { locationMode } from "@/lib/location";
import { plural } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { PlannerLoader } from "./PlannerLoader";
import { AgePicker } from "@/components/ui/AgePicker";
import { GeoScope } from "@/components/location/GeoScope";
import { FilterChip } from "@/components/ui/FilterChip";

const KID_EMOJI = ["🦁", "🦄", "🐻", "🐰", "🦊", "🐼"];
const TIME_EMOJI: Record<DurationId, string> = { short: "⏱", mid: "☀️", half: "🌤", day: "🗓" };
const ROADS: { v: number | null; label: string }[] = [
  { v: null, label: "Не важно" },
  { v: 30, label: "до 30 мин" },
  { v: 45, label: "до 45 мин" },
  { v: 60, label: "до часа" },
  { v: 90, label: "до 1,5 часа" },
];
type Wx = "any" | "indoor" | "outdoor";

export { encodeKids } from "./PlannerResults";
import { encodeKids } from "./PlannerResults";

/**
 * Короткий планировщик: «Что будем делать сегодня?» — один экран на 10–30 секунд.
 * Обязательное — только дети, время и настроение (уже выбраны разумные значения),
 * остальное спрятано в «Уточнить подбор».
 */
export function PlannerWizard({ anchor }: { anchor?: string }) {
  const router = useRouter();
  const family = useFamily();
  const anchorPlace = anchor ? getPlaceSync(anchor) : undefined;
  const [going, setGoing] = useState<string[]>([]);
  const [duration, setDuration] = useState<DurationId>(anchorPlace ? anchorDuration(anchorPlace) : "mid");
  const [mood, setMood] = useState<MoodId>("surprise");
  const [budget, setBudget] = useState<BudgetId | null>(null);
  const [transport, setTransport] = useState<TransportId | null>(null);
  const [travel, setTravel] = useState<number | null>(null);
  const [wx, setWx] = useState<Wx>("any");
  const [food, setFood] = useState(false);
  const [more, setMore] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);

  // по умолчанию идут все дети из профиля (один раз после загрузки профиля)
  const inited = useRef(false);
  useEffect(() => {
    if (family.hydrated && !inited.current) {
      inited.current = true;
      setGoing(family.children.map((c) => c.id));
    }
  }, [family.hydrated, family.children]);

  const allKids = family.children;
  const kids = allKids.filter((k) => going.includes(k.id));
  const parsed = useMemo(() => (text.trim().length > 3 ? parseQuery(text) : null), [text]);
  const anyMode = locationMode(family.origin) === "any";
  const region = anyMode && family.geoScope === "moscow-region";
  const budgetV = budget ?? family.budget;
  const transportV = transport ?? family.transport;
  const detailsCount = [budget && budget !== family.budget, transport && transport !== family.transport, travel, wx !== "any", food].filter(Boolean).length;

  const finish = (override?: Record<string, string>) => {
    const params = new URLSearchParams({
      kids: encodeKids(kids.length ? kids : family.children),
      duration,
      mood,
      budget: budgetV,
      transport: transportV,
    });
    if (travel) params.set("travel", String(travel));
    if (wx !== "any") params.set("weather", wx === "indoor" ? "rain" : "sun");
    if (food) params.set("food", "1");
    if (anchorPlace) params.set("anchor", anchorPlace.slug);
    for (const [k, v] of Object.entries(override ?? {})) params.set(k, v);
    track("planner_submit", Object.fromEntries(params));
    setLoading(`/planner/results?${params}`);
  };

  const fromText = () => {
    if (!parsed) return;
    const o: Record<string, string> = { q: text };
    if (parsed.duration) o.duration = parsed.duration;
    if (parsed.mood) o.mood = parsed.mood;
    if (parsed.budget) o.budget = parsed.budget;
    if (parsed.transport) o.transport = parsed.transport;
    if (parsed.foodAfter) o.food = "1";
    if (parsed.maxDistanceKm) o.near = "1";
    if (parsed.indoor) o.weather = "rain";
    finish(o);
  };

  if (loading) return <PlannerLoader kids={kids} onDone={() => router.replace(loading)} />;

  const editingKid = editing && editing !== "new" ? allKids.find((k) => k.id === editing) : undefined;

  return (
    <main className="flex min-h-dvh flex-col pb-32">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-bg px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <button onClick={() => goBack(router, "/")} aria-label="Закрыть" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-card">
          <X size={24} />
        </button>
        <GeoScope where="planner" />
      </header>

      <div className="px-4">
        <h1 className="tight mt-2 text-[30px] font-[850] leading-[1.05]">Что будем делать сегодня?</h1>
        <p className="mt-2 text-[16px] text-muted">Три коротких вопроса — и готовые варианты дня.</p>

        {anchorPlace && (
          <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-purple-50 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[20px]">{anchorPlace.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-purple-ink">День вокруг места</span>
              <span className="block truncate text-[16px] font-bold">{anchorPlace.title}</span>
            </span>
            <Link href="/planner" replace aria-label="Убрать место" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-white">
              <X size={18} />
            </Link>
          </div>
        )}

        {/* 1. Кто идёт */}
        <h2 className="tight mt-7 text-[20px] font-[800]">{allKids.length ? "Кто идёт?" : "Сколько лет ребёнку?"}</h2>
        {family.hydrated && !allKids.length && (
          <AgePicker
            className="mt-3"
            onPick={(age) => {
              const c = { id: `c${Date.now()}`, name: "", age, interests: [], emoji: KID_EMOJI[0] };
              family.upsertChild(c);
              setGoing((g) => [...g, c.id]);
            }}
          />
        )}
        {allKids.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {allKids.map((k, i) => {
              const on = going.includes(k.id);
              return (
                <div key={k.id} className={cn("flex items-center rounded-full pl-1 pr-1 transition-all", on ? "bg-pink-50 ring-2 ring-inset ring-pink" : "bg-surface shadow-card")}>
                  <button
                    onClick={() => setGoing((g) => (on ? g.filter((x) => x !== k.id) : [...g, k.id]))}
                    aria-pressed={on}
                    className="press hit relative flex h-11 items-center gap-2 rounded-full pl-1.5 pr-2.5 text-left"
                  >
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[18px] shadow-card">
                      {k.emoji ?? KID_EMOJI[i % KID_EMOJI.length]}
                      {on && (
                        <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-pink-ink text-white ring-2 ring-white">
                          <Check size={10} strokeWidth={3.5} />
                        </span>
                      )}
                    </span>
                    <span className="text-[16px] font-bold leading-tight">
                      {k.name ? `${k.name}, ` : ""}
                      {k.age === 0 ? "до года" : k.age}
                    </span>
                  </button>
                  <button onClick={() => setEditing(editing === k.id ? null : k.id)} aria-label={`Изменить: ${k.name || "ребёнок"}, ${k.age}`} className="press hit relative grid h-9 w-9 place-items-center rounded-full text-ink-2">
                    <Pencil size={16} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => setEditing(editing === "new" ? null : "new")} className="press hit relative flex h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-[#dcd9d2] px-3.5 text-[15px] font-semibold text-muted">
              <Plus size={18} /> Ребёнок
            </button>
          </div>
        )}
        {editing && (
          <KidForm
            key={editing}
            initial={editingKid}
            onCancel={() => setEditing(null)}
            onSave={(c) => {
              family.upsertChild(c);
              if (!editingKid) setGoing((g) => [...g, c.id]);
              setEditing(null);
            }}
            onRemove={
              editingKid
                ? () => {
                    family.removeChild(editingKid.id);
                    setGoing((g) => g.filter((x) => x !== editingKid.id));
                    setEditing(null);
                  }
                : undefined
            }
          />
        )}

        {/* 2. Сколько времени */}
        <h2 className="tight mt-7 text-[20px] font-[800]">Сколько у вас времени?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Сколько времени">
          {DURATIONS.map((d, i) => {
            const on = duration === d.id;
            return (
              <button
                key={d.id}
                role="radio"
                aria-checked={on}
                onClick={() => setDuration(d.id)}
                className={cn("press relative flex min-h-[56px] items-center gap-2.5 rounded-[18px] px-3.5 text-left transition-colors", on ? "ring-[3px] ring-inset ring-pink" : "")}
                style={{ background: ["#E2EEFF", "#FFF3D6", "#FFE4F1", "#E4F4DD"][i] }}
              >
                <span className="text-[22px]">{TIME_EMOJI[d.id]}</span>
                <span className="text-[16px] font-bold leading-tight">{d.label}</span>
              </button>
            );
          })}
        </div>
        {region && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug text-purple-ink">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {duration === "short" || duration === "mid"
              ? "На это время — в основном город: дорога за город съела бы день."
              : duration === "half"
                ? "На полдня можно выехать недалеко за МКАД: Красногорск, Одинцово, Химки."
                : "На почти весь день — поездка за город: Звенигород, Истра, Подольск и дальше."}
          </p>
        )}

        {/* 3. Что хочется */}
        <h2 className="tight mt-7 text-[20px] font-[800]">Что хочется?</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Что хочется">
          {MOODS.map((m) => {
            const on = mood === m.id;
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={on}
                onClick={() => setMood(m.id)}
                className={cn("press hit relative inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold transition-colors", on ? "ring-[3px] ring-inset ring-pink" : "")}
                style={{ background: m.bg }}
              >
                <span className="text-[17px]">{m.emoji}</span> {m.label}
              </button>
            );
          })}
        </div>

        {/* Необязательное */}
        <button
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="press mt-7 flex h-12 w-full items-center justify-between rounded-[18px] bg-surface px-4 text-[16px] font-semibold shadow-card"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={18} /> Уточнить подбор
            {detailsCount > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pink px-1.5 text-[13px] text-white">{detailsCount}</span>}
          </span>
          <ChevronDown size={20} className={cn("transition-transform", more && "rotate-180")} />
        </button>
        {more && (
          <div className="mt-3 space-y-5 rounded-[24px] bg-surface p-4 shadow-card animate-rise">
            <Group label="Бюджет на семью">
              {BUDGETS.map((b) => (
                <FilterChip key={b.id} active={budgetV === b.id} onClick={() => setBudget(b.id)}>
                  {b.emoji} {b.label}
                </FilterChip>
              ))}
            </Group>
            <Group label="Как добираетесь">
              {TRANSPORTS.map((t) => (
                <FilterChip key={t.id} active={transportV === t.id} onClick={() => setTransport(t.id)}>
                  {t.emoji} {t.label}
                </FilterChip>
              ))}
            </Group>
            {(region || !anyMode) && (
              <Group label="Дорога в одну сторону">
                {ROADS.map((r) => (
                  <FilterChip key={r.label} active={travel === r.v} onClick={() => setTravel(r.v)}>
                    {r.label}
                  </FilterChip>
                ))}
              </Group>
            )}
            <Group label="Где лучше">
              {(
                [
                  ["any", "Без разницы"],
                  ["indoor", "Под крышей"],
                  ["outdoor", "На улице"],
                ] as [Wx, string][]
              ).map(([id, label]) => (
                <FilterChip key={id} active={wx === id} onClick={() => setWx(id)}>
                  {label}
                </FilterChip>
              ))}
            </Group>
            <Group label="Еда">
              <FilterChip active={food} onClick={() => setFood((v) => !v)}>
                🍽 Хотим поесть в плане
              </FilterChip>
            </Group>
          </div>
        )}

        <div className="mt-3 rounded-[24px] bg-surface shadow-card">
          <button onClick={() => setWordsOpen((v) => !v)} aria-expanded={wordsOpen} className="press flex h-12 w-full items-center justify-between rounded-[24px] px-4 text-[16px] font-semibold text-purple-ink">
            <span className="flex items-center gap-2">
              <Wand2 size={18} /> Или опишите словами
            </span>
            <ChevronDown size={20} className={cn("transition-transform", wordsOpen && "rotate-180")} />
          </button>
          {wordsOpen && (
            <div className="px-3 pb-3 animate-rise">
              <div className="flex items-end gap-2">
                <textarea
                  id="nl"
                  aria-label="Опишите словами"
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Например: недалеко, побегать и потом поесть"
                  className="min-h-12 flex-1 resize-none rounded-[16px] bg-fill px-3.5 py-3 text-[16px] leading-snug outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-purple/40"
                />
                <button onClick={fromText} disabled={!parsed} className="press h-12 shrink-0 rounded-[16px] bg-purple-ink px-4 text-[15px] font-bold text-white disabled:opacity-30">
                  Готово
                </button>
              </div>
              {parsed && parsed.chips.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 px-1 animate-fade">
                  <span className="text-[13px] text-muted">Поняли так:</span>
                  {parsed.chips.map((c) => (
                    <span key={c} className="rounded-full bg-purple-50 px-2.5 py-1 text-[13px] font-semibold text-purple-ink">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6">
        <button
          disabled={!kids.length}
          onClick={() => finish()}
          className="press h-14 w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink transition-opacity disabled:opacity-40 disabled:shadow-none"
        >
          {kids.length ? "Показать варианты дня" : "Укажите возраст ребёнка"}
        </button>
      </div>
    </main>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[14px] font-bold text-ink-2">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function KidForm({ initial, onSave, onCancel, onRemove }: { initial?: Child; onSave: (c: Child) => void; onCancel: () => void; onRemove?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(initial?.age ?? 5);
  return (
    <div className="mt-3 rounded-[24px] bg-surface p-4 shadow-card animate-rise">
      <input
        autoFocus={!initial}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя (необязательно)"
        aria-label="Имя ребёнка"
        className="h-12 w-full rounded-[12px] bg-fill px-3.5 text-[16px] outline-none focus:ring-2 focus:ring-pink/40"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[15px] font-semibold">Возраст</span>
        <div className="flex items-center gap-3">
          <button aria-label="Меньше" onClick={() => setAge((a) => Math.max(0, a - 1))} className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-fill">
            <Minus size={20} />
          </button>
          <span className="w-16 text-center text-[17px] font-bold" aria-live="polite">
            {age === 0 ? "до года" : `${age} ${plural(age, "год", "года", "лет")}`}
          </span>
          <button aria-label="Больше" onClick={() => setAge((a) => Math.min(14, a + 1))} className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-fill">
            <Plus size={20} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {onRemove ? (
          <button onClick={onRemove} className="press h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold text-red-ink">
            Убрать
          </button>
        ) : (
          <button onClick={onCancel} className="press h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold">
            Отмена
          </button>
        )}
        <button
          onClick={() =>
            onSave({
              ...(initial ?? { interests: [] }),
              id: initial?.id ?? `c${Date.now()}`,
              name: name.trim(),
              age,
              // возраст поправили руками — дата рождения больше не нужна
              birthDate: initial && initial.age === age ? initial.birthDate : undefined,
              emoji: initial?.emoji ?? KID_EMOJI[Math.floor(Math.random() * KID_EMOJI.length)],
            })
          }
          className="press h-11 flex-1 rounded-full bg-pink text-[15px] font-semibold text-white"
        >
          {initial ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}
