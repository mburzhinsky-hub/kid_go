"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Loader2, Check, Plus, X, Globe2 } from "lucide-react";
import type { Child, InterestId } from "@/lib/types";
import { plural } from "@/lib/format";
import { useFamily } from "@/lib/store";
import { INTERESTS } from "@/lib/catalog";
import { InterestChip } from "./ProfileScreen";
import { Logo } from "@/components/ui/Logo";
import { AgePicker } from "@/components/ui/AgePicker";
import { LocationSheet } from "@/components/location/LocationSheet";
import { requestGpsOrigin } from "@/lib/use-context";
import { DEFAULT_ORIGIN, OKRUGS, okrugOrigin } from "@/lib/location";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

const KID_EMOJI = ["🦁", "🦄", "🐻", "🐰", "🦊", "🐼"];

/**
 * Знакомство: 1) что это, 2) возраст ребёнка (имя — по желанию), 3) откуда выезжаете.
 * «Пропустить» никогда не подставляет чужих детей — подборки просто будут без учёта возраста.
 */
export function Onboarding() {
  const router = useRouter();
  const s = useFamily();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [interests, setInterests] = useState<InterestId[]>([]);
  /** Дети, уже добавленные на этом шаге (можно добавить несколько). */
  const [added, setAdded] = useState<Child[]>([]);
  const [locOpen, setLocOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  /** Сохраняет ребёнка из формы и очищает форму — для «Добавить ещё ребёнка» и для «Дальше». */
  const saveChild = () => {
    if (age == null) return;
    const c: Child = { id: `c${Date.now()}`, name: name.trim(), age, interests, emoji: KID_EMOJI[added.length % KID_EMOJI.length] };
    s.upsertChild(c);
    setAdded((a) => [...a, c]);
    track("onboarding_child", { age, interests: interests.length, n: added.length + 1 });
    setAge(null);
    setName("");
    setInterests([]);
  };
  const removeAdded = (id: string) => {
    s.removeChild(id);
    setAdded((a) => a.filter((c) => c.id !== id));
  };
  const finish = () => {
    s.completeOnboarding();
    router.push("/");
  };
  const gps = async () => {
    setGpsBusy(true);
    setGpsError(false);
    try {
      const o = await requestGpsOrigin();
      s.setOrigin(o);
      s.setHome({ ...o, label: "Дом" });
    } catch {
      setGpsError(true);
    } finally {
      setGpsBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && age != null) saveChild();
    if (step === 2) return finish();
    setStep(step + 1);
  };
  const canNext = step !== 1 || age != null || added.length > 0;

  return (
    // высота ровно в экран: шаг прокручивается внутри, а кнопка «Дальше» всегда видна — не надо отдалять страницу
    <main className="flex h-dvh flex-col px-5 pt-[max(14px,env(safe-area-inset-top))]">
      <div className="flex shrink-0 items-center justify-between">
        <Logo size={28} />
        <button onClick={finish} className="press text-[15px] font-semibold text-muted">
          Пропустить
        </button>
      </div>

      <div className="no-scrollbar -mx-5 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
      {step === 0 && (
        <section className="flex flex-1 flex-col animate-rise">
          <div className="relative mt-5 grid aspect-square max-h-[38dvh] w-full place-items-center rounded-[40px]" style={{ background: "linear-gradient(160deg,#FFE9F3,#FFF5D6)" }}>
            <span className="text-[104px] animate-bob [@media(max-height:700px)]:text-[84px]">🎈</span>
            <span className="absolute left-8 top-10 text-[52px] animate-bob" style={{ animationDelay: ".4s" }}>
              ⛅
            </span>
            <span className="absolute bottom-10 right-8 text-[60px] animate-bob" style={{ animationDelay: ".8s" }}>
              🦖
            </span>
          </div>
          <h1 className="tight mt-6 text-[30px] font-[850] leading-[1.08]">Куда пойти с детьми — решим за вас</h1>
          <p className="mt-3 text-[17px] leading-snug text-muted">
            Готовый день из нескольких мест рядом: время, дорога, бюджет. Прогулку поставим в сухое окно, а если дождь — найдём, где под крышей.
          </p>
        </section>
      )}

      {step === 1 && (
        <section className="flex-1 animate-rise">
          <h1 className="tight mt-5 text-[30px] font-[850] leading-[1.08]">{added.length ? "Кто ещё идёт? 💛" : "Сколько лет ребёнку? 💛"}</h1>
          <p className="mt-2 text-[16px] text-muted">
            {added.length
              ? "Добавьте ещё одного ребёнка или нажмите «Дальше» — день подберём так, чтобы было интересно всем."
              : "Покажем только то, что подходит по возрасту. Если детей несколько — добавьте каждого, подберём день для всех."}
          </p>
          {added.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Добавленные дети">
              {added.map((c) => (
                <li key={c.id} className="flex h-11 items-center gap-2 rounded-full bg-pink-50 pl-3 pr-1.5 text-[16px] font-bold ring-2 ring-inset ring-pink">
                  <span className="text-[18px]">{c.emoji}</span>
                  {c.name ? `${c.name}, ` : ""}
                  {c.age === 0 ? "до года" : `${c.age} ${plural(c.age, "год", "года", "лет")}`}
                  <button onClick={() => removeAdded(c.id)} aria-label={`Убрать: ${c.name || "ребёнок"}, ${c.age}`} className="press hit relative grid h-8 w-8 place-items-center rounded-full text-ink-2">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AgePicker className="mt-5" value={age} onPick={setAge} />
          {age != null && (
            <div className="animate-fade">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя — если хотите"
                className="mt-5 h-14 w-full rounded-[20px] bg-surface px-4 text-[17px] shadow-card outline-none focus:ring-2 focus:ring-pink/40"
              />
              <p className="mt-5 text-[15px] font-semibold">Что нравится?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <InterestChip
                    key={i.id}
                    id={i.id}
                    active={interests.includes(i.id)}
                    onClick={() => setInterests((x) => (x.includes(i.id) ? x.filter((y) => y !== i.id) : [...x, i.id]))}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="flex-1 animate-rise">
          <h1 className="tight mt-5 text-[30px] font-[850] leading-[1.08]">Где ищем? 📍</h1>
          <p className="mt-2 text-[16px] text-muted">Выберите, куда готовы выезжать. Хотите точнее — укажите свой округ или адрес: посчитаем дорогу от вас.</p>

          <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Охват поиска">
            {(
              [
                { id: "moscow", title: "Москва", note: "Лучшие идеи в городе", Icon: Globe2 },
                { id: "moscow-region", title: "Москва + область", note: "Ещё поездки за город: усадьбы, парки, музеи", Icon: MapPin },
              ] as const
            ).map((o) => {
              const on = s.origin.source === "default" && s.geoScope === o.id;
              const region = o.id === "moscow-region";
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    track("geo_scope_set", { scope: o.id, where: "onboarding" });
                    s.setPrefs({ geoScope: o.id });
                    s.setOrigin(DEFAULT_ORIGIN);
                  }}
                  className={cn("press rounded-[20px] p-3.5 text-left", on ? (region ? "bg-purple-ink text-white" : "bg-ink text-white") : region ? "bg-purple-50 text-ink shadow-card" : "bg-surface shadow-card")}
                >
                  <span className={cn("grid h-10 w-10 place-items-center rounded-full", on ? "bg-white/15" : region ? "bg-white text-purple-ink" : "bg-fill")}>
                    <o.Icon size={20} />
                  </span>
                  <span className="mt-2 block text-[16px] font-bold">{o.title}</span>
                  <span className={cn("mt-0.5 block text-[13px] leading-snug", on ? "text-white/80" : "text-muted")}>{o.note}</span>
                  {on && <Check size={20} className="mt-2" />}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-[14px] font-bold text-ink-2">Или ближе к дому — по желанию</p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Округ Москвы">
            {OKRUGS.map((o) => {
              const on = s.origin.source === "area" && s.origin.label === o.short;
              return (
                <button
                  key={o.id}
                  aria-pressed={on}
                  onClick={() => (on ? s.setOrigin(DEFAULT_ORIGIN) : s.setOrigin(okrugOrigin(o)))}
                  className={cn("press inline-flex h-11 items-center rounded-full px-4 text-[16px] font-semibold", on ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
                >
                  {o.short}
                </button>
              );
            })}
          </div>
          <button onClick={gps} disabled={gpsBusy} className="press mt-5 flex w-full items-center gap-3 rounded-[24px] bg-blue-50 p-4 text-left">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-blue-ink">
              {gpsBusy ? <Loader2 size={24} className="animate-spin" /> : <LocateFixed size={24} />}
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold text-blue-ink">Определить, где я</span>
              <span className="text-[14px] text-ink-2">и запомнить как «Дом» — минуты от двери</span>
            </span>
            {s.origin.source === "gps" && <Check size={24} className="text-blue-ink" />}
          </button>
          <button onClick={() => setLocOpen(true)} className="press mt-2.5 flex w-full items-center gap-3 rounded-[24px] bg-surface p-4 text-left shadow-card">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-pink-50 text-pink-ink">
              <MapPin size={24} />
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold">Подмосковье или адрес</span>
              <span className="text-[14px] text-muted">Красногорск, Химки, свой посёлок…</span>
            </span>
            {(s.origin.source === "custom" || s.origin.source === "home") && <Check size={24} className="text-pink-ink" />}
          </button>
          <p className="mt-4 rounded-[16px] bg-green-50 px-3.5 py-2.5 text-[15px] font-semibold text-green-ink animate-fade">
            {s.origin.source === "default"
              ? s.geoScope === "moscow-region"
                ? "Ищем в Москве и области"
                : "Ищем по всей Москве"
              : `Ищем рядом: ${s.origin.source === "home" ? "Дом" : s.origin.label} — дорогу считаем от этой точки`}
          </p>
          {gpsError && <p className="mt-3 text-[14px] text-orange-ink">Геопозиция недоступна — выберите «Москва» или свой округ, этого достаточно.</p>}
          <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
        </section>
      )}

      </div>

      {/* ещё один ребёнок: всегда на виду над «Дальше» — сохраняем текущего и открываем чистую форму */}
      {step === 1 && age != null && (
        <button onClick={saveChild} className="press mt-1 flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-fill text-[16px] font-semibold text-ink">
          <Plus size={20} /> Добавить ещё ребёнка
        </button>
      )}

      <div className="relative flex shrink-0 items-center gap-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-5 h-5 bg-gradient-to-t from-bg to-transparent" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-pink" : "w-2 bg-[#e3e0da]")} />
          ))}
        </div>
        <button
          onClick={next}
          disabled={!canNext}
          className="press ml-auto h-14 flex-1 rounded-full bg-pink text-[17px] font-bold text-white shadow-pink disabled:opacity-40 disabled:shadow-none"
        >
          {step === 0 ? "Начнём" : step === 1 ? "Дальше" : "Поехали! 🚀"}
        </button>
      </div>
    </main>
  );
}
