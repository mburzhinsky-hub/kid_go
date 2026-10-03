import Link from "next/link";
import type { Scenario } from "@/lib/catalog";

/** Цветная плитка сценария — копия «Подборок» из референса. */
export function QuickScenarioCard({ s }: { s: Scenario }) {
  const { Glyph } = s;
  return (
    <Link
      href={s.href}
      className="press flex h-[76px] items-center gap-3 rounded-[20px] pl-2.5 pr-3"
      style={{ background: s.bg }}
    >
      <span
        className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${s.bubble} 70%)` }}
      >
        <Glyph width={40} height={40} />
      </span>
      <span className="text-[15px] font-semibold leading-[1.25] text-ink">{s.label}</span>
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
