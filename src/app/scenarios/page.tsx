import type { Metadata } from "next";
import { BackButton } from "@/components/ui/BackButton";
import { GROUP_LABEL, SCENARIO_LIBRARY, scenarioHref, type ScenarioGroup } from "@/lib/scenarios";
import { ScenarioGrid } from "@/components/home/QuickScenarioCard";
import { LiveScenarios } from "@/components/home/HomeLive";
import { GeoScope } from "@/components/location/GeoScope";
import { plural } from "@/lib/format";

export const metadata: Metadata = {
  title: "Ситуации: куда пойти с детьми, если…",
  description: "Дождь, мороз, до дневного сна, с бабушкой, день рождения, бесплатно, выезд за город — готовый день под любую ситуацию.",
};

const ORDER: ScenarioGroup[] = ["weather", "time", "trip", "party", "mood", "occasion", "effort"];

export default function ScenariosPage() {
  return (
    <main className="pb-28">
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback="/" />
        <GeoScope where="scenarios" />
      </header>
      <section className="px-4">
        <h1 className="tight text-[30px] font-[850] leading-[1.06]">Что у вас за ситуация?</h1>
        <p className="mt-1.5 text-[16px] text-muted">{SCENARIO_LIBRARY.length} {plural(SCENARIO_LIBRARY.length, "готовая ситуация", "готовые ситуации", "готовых ситуаций")} — выберите, и мы соберём день с учётом погоды и дороги.</p>
      </section>

      <section className="mt-6" aria-labelledby="live-title">
        <h2 id="live-title" className="tight px-4 text-[22px] font-[800]">Подходит сегодня</h2>
        <div className="mt-3">
          <LiveScenarios />
        </div>
      </section>

      <nav aria-label="Группы ситуаций" className="no-scrollbar sticky top-0 z-20 mt-6 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-2">
        {ORDER.map((g) => (
          <a key={g} href={`#g-${g}`} className="press hit relative inline-flex h-9 shrink-0 items-center rounded-full bg-surface px-3.5 text-[14px] font-semibold shadow-card">
            {GROUP_LABEL[g]}
          </a>
        ))}
      </nav>

      {ORDER.map((g) => (
        <section key={g} id={`g-${g}`} className="mt-5 scroll-mt-14">
          <h2 className="tight px-4 text-[22px] font-[800]">{GROUP_LABEL[g]}</h2>
          {g === "trip" && <p className="mt-1 px-4 text-[14px] leading-snug text-muted">Поездки из Москвы на полдня и на день. Дорога считается от центра и показана в карточке.</p>}
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
