"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Loader2, Check } from "lucide-react";
import type { InterestId } from "@/lib/types";
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
  const [locOpen, setLocOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  const saveChild = () => {
    if (age == null) return;
    s.upsertChild({ id: `c${Date.now()}`, name: name.trim(), age, interests, emoji: "🦁" });
    track("onboarding_child", { age, interests: interests.length });
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
    if (step === 1) saveChild();
    if (step === 2) return finish();
    setStep(step + 1);
  };
  const canNext = step !== 1 || age != null;

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
          <h1 className="tight mt-5 text-[30px] font-[850] leading-[1.08]">Сколько лет ребёнку? 💛</h1>
          <p className="mt-2 text-[16px] text-muted">Покажем только то, что подходит по возрасту. Остальных детей добавите в профиле.</p>
          <AgePicker className="mt-5" value={age} onPick={setAge} />
          {age != null && (
            <div className="animate-fade">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя — если хотите"
                className="mt-5 h-14 w-full rounded-[18px] bg-surface px-4 text-[17px] shadow-card outline-none focus:ring-2 focus:ring-pink/40"
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
          <p className="mt-2 text-[16px] text-muted">Можно ничего не выбирать — покажем лучшее по всей Москве. Хотите ближе к дому — отметьте свой округ.</p>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Округ Москвы">
            {OKRUGS.map((o) => {
              const on = s.origin.source === "area" && s.origin.label === o.short;
              return (
                <button
                  key={o.id}
                  aria-pressed={on}
                  onClick={() => (on ? s.setOrigin(DEFAULT_ORIGIN) : s.setOrigin(okrugOrigin(o)))}
                  className={cn("press inline-flex h-11 items-center rounded-full px-4 text-[15.5px] font-semibold", on ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
                >
                  {o.short}
                </button>
              );
            })}
          </div>
          <button onClick={gps} disabled={gpsBusy} className="press mt-5 flex w-full items-center gap-3 rounded-[22px] bg-blue-50 p-4 text-left">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-blue">
              {gpsBusy ? <Loader2 size={22} className="animate-spin" /> : <LocateFixed size={22} />}
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold text-blue">Определить, где я</span>
              <span className="text-[13.5px] text-ink-2">и запомнить как «Дом» — минуты от двери</span>
            </span>
            {s.origin.source === "gps" && <Check size={22} className="text-blue" />}
          </button>
          <button onClick={() => setLocOpen(true)} className="press mt-2.5 flex w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-left shadow-card">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-pink-50 text-pink">
              <MapPin size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold">Подмосковье или адрес</span>
              <span className="text-[13.5px] text-muted">Красногорск, Химки, свой посёлок…</span>
            </span>
            {(s.origin.source === "custom" || s.origin.source === "home") && <Check size={22} className="text-pink" />}
          </button>
          <p className="mt-4 rounded-[16px] bg-green-50 px-3.5 py-2.5 text-[15px] font-semibold text-green animate-fade">
            {s.origin.source === "default" ? "Ищем по всей Москве" : `Ищем рядом: ${s.origin.source === "home" ? "Дом" : s.origin.label}`}
          </p>
          {gpsError && <p className="mt-3 text-[14px] text-[#8a4a00]">Геопозиция недоступна — выберите округ, этого достаточно.</p>}
          <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
        </section>
      )}

      </div>

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
