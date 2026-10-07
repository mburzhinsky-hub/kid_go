"use client";

import { useMemo, useState } from "react";
import { AdventureCard, type AdventureCardData } from "@/components/cards/AdventureCard";
import { FilterChip } from "@/components/ui/FilterChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFamily } from "@/lib/store";
import { areaNote, fitOfAreas } from "@/lib/area-fit";
import { useAreaOrder } from "@/components/cards/AreaAdventureCards";

export interface AdventureItem {
  card: AdventureCardData;
  indoor: boolean;
  ageMin: number;
  ageMax: number;
  budget: number;
  moods: string[];
}

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "kids", label: "👧 Для наших детей" },
  { id: "rain", label: "☔ Под крышей" },
  { id: "outdoor", label: "🌳 На воздухе" },
  { id: "toddlers", label: "🍼 Для малышей" },
  { id: "cheap", label: "💚 До 2 000 ₽" },
  { id: "energy", label: "⚡ Активно" },
  { id: "learn", label: "🔬 Познавательно" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"] | "area";

export function AdventuresBrowser({ items }: { items: AdventureItem[] }) {
  const [f, setF] = useState<FilterId>("all");
  const kids = useFamily((s) => s.children);
  // выбран округ: сначала приключения в нём, у каждого — подпись, где это
  const ordered = useAreaOrder(items.map((x) => ({ ...x, areas: x.card.areas, tripKm: x.card.tripKm })));
  const okrug = ordered.okrug;
  const list = useMemo(
    () =>
      ordered.list.filter((a) => {
        switch (f) {
          case "area":
            return !!okrug && fitOfAreas(a.card.areas, okrug.id) === 0;
          case "kids":
            return kids.every((k) => k.age >= a.ageMin - 1 && k.age <= a.ageMax + 1);
          case "rain":
            return a.indoor;
          case "outdoor":
            return !a.indoor;
          case "toddlers":
            return a.ageMin <= 2;
          case "cheap":
            return a.budget <= 2000;
          case "energy":
            return a.moods.includes("energy");
          case "learn":
            return a.moods.includes("learn");
          default:
            return true;
        }
      }),
    [ordered.list, f, kids, okrug]
  );
  return (
    <>
      <div className="no-scrollbar sticky top-0 z-20 -mt-1 flex gap-2 overflow-x-auto bg-bg/95 px-4 pb-3 pt-2">
        {okrug && (
          <FilterChip active={f === "area"} onClick={() => setF(f === "area" ? "all" : "area")} size="sm">
            📍 В {okrug.short}
          </FilterChip>
        )}
        {FILTERS.map((x) => (
          <FilterChip key={x.id} active={f === x.id} onClick={() => setF(x.id)} size="sm">
            {x.label}
          </FilterChip>
        ))}
      </div>
      <div className="space-y-4 px-4">
        {list.map((a, i) => (
          <AdventureCard key={a.card.href} data={a.card} variant="full" priority={i === 0} note={okrug ? areaNote(a.card.areas, okrug.id) : null} />
        ))}
        {list.length === 0 && (
          <EmptyState
            art="search"
            title={f === "area" && okrug ? `В ${okrug.short} готовых приключений пока нет` : "Таких приключений пока нет"}
            text={f === "area" ? "Снимите фильтр — покажем и ближайшие округа, или соберите день под себя в планировщике: он подберёт места именно там." : "Попробуйте другой фильтр — или соберите день под себя в планировщике."}
            action={{ href: "/planner", label: "Собрать свой день" }}
          />
        )}
      </div>
    </>
  );
}
