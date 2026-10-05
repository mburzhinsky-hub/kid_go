"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, Plus, Minus, Check, Wand2 } from "lucide-react";
import type { BudgetId, DurationId, MoodId, TransportId, Child } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { goBack } from "@/lib/nav";
import { MOODS, DURATIONS, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { parseQuery } from "@/lib/recommend/nlu";
import { plural } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { PlannerLoader } from "./PlannerLoader";
import { AgePicker } from "@/components/ui/AgePicker";
import { LocationChip } from "@/components/location/LocationChip";

const STEPS = ["Кто идёт?", "Сколько времени?", "Какое настроение?", "Бюджет", "Как добираемся?"];
const KID_EMOJI = ["🦁", "🦄", "🐻", "🐰", "🦊", "🐼"];

export { encodeKids } from "./PlannerResults";
import { encodeKids } from "./PlannerResults";

export function PlannerWizard() {
  const router = useRouter();
  const family = useFamily();
  const [step, setStep] = useState(0);
  const [going, setGoing] = useState<string[]>([]);
  const [duration, setDuration] = useState<DurationId | null>(null);
  const [mood, setMood] = useState<MoodId | null>(null);
  const [budget, setBudget] = useState<BudgetId | null>(null);
  const [transport, setTransport] = useState<TransportId | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  // по умолчанию идут все дети из профиля (один раз после загрузки профиля)
  const inited = useRef(false);
  useEffect(() => {
    if (family.hydrated && !inited.current) {
      inited.current = true;
      setGoing(family.children.map((c) => c.id));
      setBudget((b) => b ?? family.budget);
      setTransport((t) => t ?? family.transport);
    }
  }, [family.hydrated, family.children, family.budget, family.transport]);

  const allKids = family.children;
  const kids = allKids.filter((k) => going.includes(k.id));
  const parsed = useMemo(() => (text.trim().length > 3 ? parseQuery(text) : null), [text]);

  const canNext = [kids.length > 0, !!duration, !!mood, !!budget, !!transport][step];

  const finish = (override?: Record<string, string>) => {
    const params = new URLSearchParams({
      kids: encodeKids(kids.length ? kids : family.children),
      duration: duration ?? "mid",
      mood: mood ?? "surprise",
      budget: budget ?? "any",
      transport: transport ?? "transit",
      ...override,
    });
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

  return (
    <main className="flex min-h-dvh flex-col pb-32">
      <header className="sticky top-0 z-20 bg-bg/95 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : goBack(router, "/"))}
            aria-label={step > 0 ? "Назад" : "Закрыть"}
            className="press grid h-11 w-11 place-items-center rounded-full bg-surface shadow-card"
          >
            {step > 0 ? <ArrowLeft size={22} /> : <X size={22} />}
          </button>
          <span className="text-[14px] font-semibold text-muted">
            Шаг {step + 1} из {STEPS.length}
          </span>
          <span className="w-11" />
        </div>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9e7e2]">
              <span className={cn("block h-full rounded-full bg-pink transition-all duration-500", i <= step ? "w-full" : "w-0")} />
            </span>
          ))}
        </div>
      </header>

      <div className="px-4">
        {step === 0 && (
          <>
            <h1 className="tight mt-3 text-[30px] font-[850] leading-[1.05]">Придумаем ваш&nbsp;день&nbsp;✨</h1>
            <p className="mt-2 text-[16px] text-muted">5 коротких вопросов — и у вас готовый маршрут с временем и бюджетом.</p>

            <div className="mt-5 rounded-[22px] bg-surface p-3 shadow-card">
              <label htmlFor="nl" className="flex items-center gap-1.5 px-1 text-[13.5px] font-semibold text-purple">
                <Wand2 size={15} /> Или просто опишите словами
              </label>
              <div className="mt-2 flex items-end gap-2">
                <textarea
                  id="nl"
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Например: недалеко, побегать и потом поесть"
                  className="min-h-[52px] flex-1 resize-none rounded-[16px] bg-fill px-3.5 py-3 text-[15.5px] leading-snug outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-purple/40"
                />
                <button
                  onClick={fromText}
                  disabled={!parsed}
                  className="press h-[52px] shrink-0 rounded-[16px] bg-purple px-4 text-[15px] font-bold text-white disabled:opacity-30"
                >
                  Готово
                </button>
              </div>
              {parsed && parsed.chips.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 px-1 animate-fade">
                  <span className="text-[12.5px] text-muted">Поняли так:</span>
                  {parsed.chips.map((c) => (
                    <span key={c} className="rounded-full bg-purple-50 px-2.5 py-1 text-[12.5px] font-semibold text-purple">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h2 className="tight mt-7 text-[22px] font-[800]">{allKids.length ? "Кто идёт?" : "Сколько лет ребёнку?"}</h2>
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
            <div className={cn("mt-3 grid grid-cols-2 gap-2.5", !allKids.length && "hidden")}>
              {allKids.map((k, i) => {
                const on = going.includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => setGoing((g) => (on ? g.filter((x) => x !== k.id) : [...g, k.id]))}
                    aria-pressed={on}
                    className={cn(
                      "press relative flex items-center gap-3 rounded-[22px] p-3 text-left transition-all",
                      on ? "bg-pink-50 ring-2 ring-pink" : "bg-surface shadow-card"
                    )}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[26px] shadow-card">
                      {k.emoji ?? KID_EMOJI[i % KID_EMOJI.length]}
                    </span>
                    <span>
                      <span className="block text-[16px] font-bold leading-tight">{k.name || "Ребёнок"}</span>
                      <span className="text-[13.5px] text-muted">
                        {k.age === 0 ? "до года" : `${k.age} ${plural(k.age, "год", "года", "лет")}`}
                      </span>
                    </span>
                    {on && (
                      <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-pink text-white animate-pop">
                        <Check size={15} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="press flex min-h-[74px] items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-[#dcd9d2] text-[15px] font-semibold text-muted"
                >
                  <Plus size={18} /> Добавить ребёнка
                </button>
              )}
            </div>
            {adding && (
              <AddKid
                onCancel={() => setAdding(false)}
                onAdd={(c) => {
                  setGoing((g) => [...g, c.id]);
                  family.upsertChild(c);
                  setAdding(false);
                }}
              />
            )}
          </>
        )}

        {step === 1 && (
          <StepTiles
            title="Сколько у вас времени?"
            items={DURATIONS.map((d) => ({ id: d.id, label: d.label, hint: d.hint, emoji: d.emoji }))}
            value={duration}
            onChange={(v) => {
              setDuration(v as DurationId);
              setTimeout(() => setStep(2), 220);
            }}
            columns={2}
            colors={["#E2EEFF", "#FFF3D6", "#FFE4F1", "#E4F4DD"]}
          />
        )}
        {step === 2 && (
          <StepTiles
            title="Какое настроение?"
            items={MOODS.map((m) => ({ id: m.id, label: m.label, emoji: m.emoji }))}
            value={mood}
            onChange={(v) => {
              setMood(v as MoodId);
              setTimeout(() => setStep(3), 220);
            }}
            columns={2}
            colors={MOODS.map((m) => m.bg)}
          />
        )}
        {step === 3 && (
          <StepTiles
            title="Какой бюджет на семью?"
            items={BUDGETS.map((b) => ({ id: b.id, label: b.label, emoji: b.emoji }))}
            value={budget}
            onChange={(v) => {
              setBudget(v as BudgetId);
              setTimeout(() => setStep(4), 220);
            }}
            columns={2}
            colors={["#E4F4DD", "#FFF3D6", "#E2EEFF", "#FFE4F1"]}
          />
        )}
        {step === 4 && (
          <>
          <StepTiles
            title="Как будете добираться?"
            items={TRANSPORTS.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji }))}
            value={transport}
            onChange={(v) => setTransport(v as TransportId)}
            columns={1}
            colors={["#E4F4DD", "#E2EEFF", "#EEE5FE"]}
          />
          <div className="mt-5 flex items-center justify-between gap-3 rounded-[22px] bg-surface p-3.5 shadow-card">
            <span className="text-[15px] font-semibold leading-tight">
              Где ищем?
              <span className="block text-[13px] font-medium text-muted">вся Москва, округ или точка — по желанию</span>
            </span>
            <LocationChip />
          </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6">
        <button
          disabled={!canNext}
          onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
          className="press h-[58px] w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink transition-opacity disabled:opacity-40 disabled:shadow-none"
        >
          {step < STEPS.length - 1 ? "Дальше" : "Придумать день ✨"}
        </button>
      </div>
    </main>
  );
}

function StepTiles({
  title,
  items,
  value,
  onChange,
  columns,
  colors,
}: {
  title: string;
  items: { id: string; label: string; hint?: string; emoji: string }[];
  value: string | null;
  onChange: (id: string) => void;
  columns: 1 | 2;
  colors: string[];
}) {
  return (
    <section className="animate-rise">
      <h1 className="tight mt-3 text-[30px] font-[850] leading-[1.08]">{title}</h1>
      <div className={cn("mt-6 grid gap-2.5", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {items.map((it, i) => {
          const on = value === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              aria-pressed={on}
              className={cn(
                "press relative flex rounded-[24px] p-4 text-left transition-all",
                columns === 2 ? "min-h-[128px] flex-col justify-between" : "items-center gap-4",
                on ? "ring-[3px] ring-pink" : ""
              )}
              style={{ background: colors[i % colors.length] }}
            >
              <span className={cn("grid place-items-center rounded-full bg-white/80", columns === 2 ? "h-14 w-14 text-[30px]" : "h-12 w-12 text-[26px]")}>
                {it.emoji}
              </span>
              <span>
                <span className="block text-[17px] font-bold leading-tight">{it.label}</span>
                {it.hint && <span className="mt-0.5 block text-[13px] text-ink-2/70">{it.hint}</span>}
              </span>
              {on && (
                <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-pink text-white animate-pop">
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AddKid({ onAdd, onCancel }: { onAdd: (c: Child) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState(5);
  return (
    <div className="mt-3 rounded-[22px] bg-surface p-4 shadow-card animate-rise">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя (необязательно)"
        className="h-12 w-full rounded-[14px] bg-fill px-3.5 text-[16px] outline-none focus:ring-2 focus:ring-pink/40"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[15px] font-semibold">Возраст</span>
        <div className="flex items-center gap-3">
          <button aria-label="Меньше" onClick={() => setAge((a) => Math.max(0, a - 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-fill">
            <Minus size={18} />
          </button>
          <span className="w-16 text-center text-[17px] font-bold">
            {age} {plural(age, "год", "года", "лет")}
          </span>
          <button aria-label="Больше" onClick={() => setAge((a) => Math.min(14, a + 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-fill">
            <Plus size={18} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="press h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold">
          Отмена
        </button>
        <button
          onClick={() => onAdd({ id: `c${Date.now()}`, name: name.trim(), age, interests: [], emoji: KID_EMOJI[Math.floor(Math.random() * KID_EMOJI.length)] })}
          className="press h-11 flex-1 rounded-full bg-pink text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}
