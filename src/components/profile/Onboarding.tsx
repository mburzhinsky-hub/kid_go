"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { InterestId } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { INTERESTS } from "@/lib/catalog";
import { InterestChip } from "./ProfileScreen";
import { Logo } from "@/components/ui/Logo";
import { plural } from "@/lib/format";
import { cn } from "@/lib/cn";

const SLIDES = [
  { emoji: ["🎈", "🦖", "🍦"], bg: "linear-gradient(160deg,#FFE9F3,#FFF5D6)", title: "Куда пойти с детьми — решим за вас", text: "Парки, музеи, игровые и кафе — только проверенные места с отзывами родителей." },
  { emoji: ["⚡", "☔", "🌳"], bg: "linear-gradient(160deg,#E2EEFF,#F4EAFF)", title: "Выберите настроение — мы соберём день", text: "Маршрут из нескольких мест: время, дорога, бюджет и что делать, если дождь." },
];

export function Onboarding() {
  const router = useRouter();
  const s = useFamily();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState(5);
  const [interests, setInterests] = useState<InterestId[]>([]);

  const finish = () => {
    if (name.trim()) {
      // заменяем демо-детей на настоящего ребёнка
      for (const c of s.children) if (c.id === "c1" || c.id === "c2") s.removeChild(c.id);
      s.upsertChild({ id: `c${Date.now()}`, name: name.trim(), age, interests, emoji: "🦁" });
    }
    s.completeOnboarding();
    router.push("/");
  };

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Logo size={28} />
        <button onClick={finish} className="press text-[15px] font-semibold text-muted">
          Пропустить
        </button>
      </div>

      {step < SLIDES.length ? (
        <section key={step} className="flex flex-1 flex-col animate-rise">
          <div className="relative mt-8 grid aspect-square w-full place-items-center rounded-[40px]" style={{ background: SLIDES[step].bg }}>
            <span className="text-[120px] animate-bob">{SLIDES[step].emoji[0]}</span>
            <span className="absolute left-8 top-10 text-[52px] animate-bob" style={{ animationDelay: ".4s" }}>
              {SLIDES[step].emoji[1]}
            </span>
            <span className="absolute bottom-10 right-8 text-[60px] animate-bob" style={{ animationDelay: ".8s" }}>
              {SLIDES[step].emoji[2]}
            </span>
          </div>
          <h1 className="tight mt-8 text-[30px] font-[850] leading-[1.08]">{SLIDES[step].title}</h1>
          <p className="mt-3 text-[17px] leading-snug text-muted">{SLIDES[step].text}</p>
        </section>
      ) : (
        <section className="flex-1 animate-rise">
          <h1 className="tight mt-8 text-[30px] font-[850] leading-[1.08]">Расскажите о ребёнке 💛</h1>
          <p className="mt-2 text-[16px] text-muted">Подберём места по возрасту и интересам. Остальных детей добавите в профиле.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            className="mt-6 h-14 w-full rounded-[18px] bg-surface px-4 text-[17px] shadow-card outline-none focus:ring-2 focus:ring-pink/40"
          />
          <div className="mt-3 flex items-center justify-between rounded-[18px] bg-surface p-3 shadow-card">
            <span className="pl-1 text-[16px] font-semibold">Возраст</span>
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
        </section>
      )}

      <div className="mt-6 flex items-center gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-pink" : "w-2 bg-[#e3e0da]")} />
          ))}
        </div>
        <button
          onClick={() => (step < SLIDES.length ? setStep(step + 1) : finish())}
          className="press ml-auto h-14 flex-1 rounded-full bg-pink text-[17px] font-bold text-white shadow-pink"
        >
          {step < SLIDES.length ? "Дальше" : "Поехали! 🚀"}
        </button>
      </div>
    </main>
  );
}
