import Link from "next/link";
import type { Scenario } from "@/lib/catalog";

/** Цветная плитка сценария — копия «Подборок» из референса. */
export function QuickScenarioCard({ s }: { s: Scenario }) {
  const { Glyph } = s;
  return (
    <Link
      href={s.href}
      className="press flex h-[76px] min-w-0 items-center gap-2 rounded-[20px] pl-2 pr-2.5 min-[400px]:gap-3 min-[400px]:pl-2.5 min-[400px]:pr-3"
      style={{ background: s.bg }}
    >
      <span
        className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full min-[400px]:h-12 min-[400px]:w-12"
        style={{ background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${s.bubble} 70%)` }}
      >
        {Glyph ? <Glyph className="h-8 w-8 min-[400px]:h-9 min-[400px]:w-9" /> : <span className="text-[24px] leading-none min-[400px]:text-[30px]">{s.emoji}</span>}
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.25] text-ink [hyphens:auto] [overflow-wrap:anywhere] min-[400px]:text-[15px]">{s.label}</span>
    </Link>
  );
}

export function ScenarioGrid({ items }: { items: Scenario[] }) {
  return (
    <div className="grid grid-cols-2 gap-[10px] px-4">
      {items.map((s) => (
        <QuickScenarioCard key={s.id} s={s} />
      ))}
    </div>
  );
}
