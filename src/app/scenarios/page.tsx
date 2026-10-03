import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GROUP_LABEL, SCENARIO_LIBRARY, scenarioHref, type ScenarioGroup } from "@/lib/scenarios";
import { ScenarioGrid } from "@/components/home/QuickScenarioCard";

export const metadata: Metadata = {
  title: "Ситуации: куда пойти с детьми, если…",
  description: "Дождь, мороз, до дневного сна, с бабушкой, день рождения, бесплатно — готовый день под любую ситуацию.",
};

const ORDER: ScenarioGroup[] = ["weather", "time", "party", "mood", "occasion", "effort"];

export default function ScenariosPage() {
  return (
    <main className="pb-28">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <Link href="/" aria-label="На главную" className="press grid h-11 w-11 place-items-center rounded-full bg-surface shadow-card">
          <ArrowLeft size={22} />
        </Link>
      </header>
      <section className="px-4">
        <h1 className="tight text-[31px] font-[850] leading-[1.06]">Что у вас за ситуация?</h1>
        <p className="mt-1.5 text-[16px] text-muted">{SCENARIO_LIBRARY.length} готовых сценариев — выберите, и мы соберём день с учётом погоды и дороги.</p>
      </section>
      {ORDER.map((g) => (
        <section key={g} className="mt-7">
          <h2 className="tight px-4 text-[21px] font-[800]">{GROUP_LABEL[g]}</h2>
          <div className="mt-3">
            <ScenarioGrid
              items={SCENARIO_LIBRARY.filter((s) => s.group === g).map((s) => ({ id: s.id, label: s.label, bg: s.bg, bubble: s.bubble, Glyph: s.Glyph, emoji: s.emoji, href: scenarioHref(s) }))}
            />
          </div>
        </section>
      ))}
    </main>
  );
}
