import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { repo } from "@/lib/data/repository";
import { adventureCardData } from "@/lib/cards";
import { AdventuresBrowser } from "@/components/adventure/AdventuresBrowser";

export const metadata: Metadata = {
  title: "Готовые приключения с детьми",
  description: "Маршруты на день: несколько мест рядом, время, бюджет и возраст. Выберите — и поехали.",
  alternates: { canonical: "/adventures" },
};

export default async function AdventuresPage() {
  const adventures = await repo.listAdventures();
  const items = [...adventures]
    .sort((a, b) => b.recommend_percent - a.recommend_percent)
    .map((a) => ({
      card: adventureCardData(a),
      indoor: a.weather_tags.includes("rain"),
      ageMin: a.age_min,
      ageMax: a.age_max,
      budget: a.estimated_budget,
      moods: a.moods,
    }));
  return (
    <main className="pb-28">
      <header className="px-4 pb-3 pt-[max(18px,env(safe-area-inset-top))]">
        <h1 className="tight text-[32px] font-[850] leading-tight">Приключения</h1>
        <p className="mt-0.5 text-[15.5px] text-muted">Готовые дни: места рядом, время и бюджет уже посчитаны</p>
      </header>
      <Link
        href="/planner"
        className="press mx-4 mb-4 flex items-center gap-3 rounded-[22px] p-3.5 text-white shadow-[0_14px_28px_-14px_rgba(139,61,240,0.7)]"
        style={{ background: "linear-gradient(120deg,#FF2E88,#8B3DF0)" }}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white/20">
          <Sparkles size={24} />
        </span>
        <span className="flex-1">
          <span className="block text-[17px] font-bold leading-tight">Собрать свой день</span>
          <span className="block text-[13.5px] text-white/85">Возраст, настроение, бюджет — 5 вопросов</span>
        </span>
        <ArrowRight size={22} />
      </Link>
      <AdventuresBrowser items={items} />
    </main>
  );
}
