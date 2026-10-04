"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Sparkles, ArrowRight } from "lucide-react";
import type { CategoryId, Place } from "@/lib/types";
import { allPlaces } from "@/lib/data/repository";
import { useNearbyExtras } from "@/lib/nearby";
import { parseQuery } from "@/lib/recommend/nlu";
import { CATEGORIES } from "@/lib/catalog";
import { locationMode, travelToPlace } from "@/lib/location";
import { useFamily } from "@/lib/store";
import { PlaceRow } from "@/components/cards/PlaceCard";
import { FilterChip } from "@/components/ui/FilterChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { encodeKids } from "@/components/planner/PlannerWizard";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";

const SUGGEST = ["батуты", "динозавры", "бесплатно", "если дождь", "кафе с игровой", "для малышей", "животные", "космос"];
type Sort = "best" | "near" | "cheap";

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

export function SearchScreen({ initialQ = "", initialCategory, initialSort }: { initialQ?: string; initialCategory?: CategoryId; initialSort?: Sort }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState<CategoryId | undefined>(initialCategory);
  const [sort, setSort] = useState<Sort>(initialSort ?? "best");
  const kids = useFamily((s) => s.children);
  const origin = useFamily((s) => s.origin);
  const transport = useFamily((s) => s.transport);
  const { places: extra } = useNearbyExtras();
  const pool = useMemo(() => (extra.length ? [...allPlaces, ...extra] : allPlaces), [extra]);
  const anywhere = locationMode(origin) === "any";
  const mins = (p: Place) => travelToPlace(origin, p, transport).minutes;
  const parsed = useMemo(() => (q.trim().length > 2 ? parseQuery(q) : null), [q]);

  const results = useMemo(() => {
    const words = norm(q)
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.slice(0, Math.max(4, w.length - 2))); // грубый стемминг: «батуты» → «бату»
    const scored = pool
      .filter((p) => !category || p.category === category)
      .map((p) => {
        const hay = norm(`${p.title} ${p.subtitle} ${p.tags.join(" ")} ${p.description}`);
        const textHits = words.filter((w) => hay.includes(w)).length;
        let ok = true;
        let score = p.rating;
        if (parsed) {
          if (parsed.indoor && !p.indoor) ok = false;
          if (parsed.free && p.price_min > 0) ok = false;
          if (parsed.ageMax != null && p.age_min > parsed.ageMax) ok = false;
          if (parsed.outdoor && !p.outdoor) score -= 1;
          if (parsed.activity && p.activity_level === parsed.activity) score += 1.5;
          score += parsed.interests.filter((i) => p.interest_tags.includes(i)).length * 3;
          if (parsed.category === p.category) score += 2;
          if (parsed.maxDistanceKm && !anywhere && mins(p) > 20) ok = false;
          if (parsed.ageMax == null && kids.length && kids.every((k) => k.age < p.age_min || k.age > p.age_max)) score -= 2;
          const structured = parsed.chips.length > 0;
          if (!structured && words.length && textHits === 0) ok = false;
          if (structured && words.length && textHits === 0 && score < p.rating + 1) ok = false;
        }
        score += textHits * 3;
        return { p, score, ok };
      })
      .filter((x) => x.ok);
    const sorted = [...scored].sort((a, b) => {
      if (sort === "near" && !anywhere) return mins(a.p) - mins(b.p);
      if (sort === "cheap") return a.p.price_min - b.p.price_min || b.score - a.score;
      return b.score - a.score;
    });
    return sorted.map((x) => x.p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, sort, parsed, origin, transport, kids, pool, anywhere]);

  const plannerHref = parsed
    ? `/planner/results?${new URLSearchParams({
        q,
        kids: encodeKids(kids),
        duration: parsed.duration ?? "mid",
        mood: parsed.mood ?? "surprise",
        budget: parsed.budget ?? "any",
        transport: parsed.transport ?? "transit",
        ...(parsed.foodAfter ? { food: "1" } : {}),
        ...(parsed.maxDistanceKm && !anywhere ? { near: "1" } : {}),
        ...(parsed.indoor ? { weather: "rain" } : {}),
      })}`
    : "/planner";

  return (
    <main className="pb-28">
      <div className="sticky top-0 z-20 bg-bg/95 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 px-4">
          <button onClick={() => router.back()} aria-label="Назад" className="press grid h-[50px] w-10 shrink-0 place-items-center">
            <ArrowLeft size={24} />
          </button>
          <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-fill px-4">
            <Search size={21} className="shrink-0 text-ink-2" />
            <input
              autoFocus={!initialCategory && !initialQ}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Куда пойдём сегодня?"
              enterKeyHint="search"
              aria-label="Поиск"
              className="min-w-0 flex-1 bg-transparent text-[16.5px] outline-none placeholder:text-muted"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Очистить" className="text-muted">
                <X size={18} />
              </button>
            )}
          </label>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          {CATEGORIES.map((c) => {
            const active = c.id === "all" ? !category : category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id === "all" ? undefined : (c.id as CategoryId))}
                className={cn("press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold transition-colors")}
                style={
                  c.id === "all"
                    ? { background: active ? "#FFC21A" : "#FFF5D6", color: active ? "#fff" : "#B07D00" }
                    : { background: active ? c.fg : c.bg, color: active ? "#fff" : c.fg }
                }
              >
                <c.Icon width={16} height={16} /> {c.short}
              </button>
            );
          })}
        </div>
      </div>

      {parsed && parsed.chips.length > 0 && (
        <div className="mx-4 mt-2 rounded-[22px] p-3.5 animate-rise" style={{ background: "linear-gradient(135deg,#F4EAFF,#FFE9F3)" }}>
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-purple">
            <Sparkles size={15} /> Поняли так:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parsed.chips.map((c) => (
              <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold">
                {c}
              </span>
            ))}
          </div>
          <Link href={plannerHref} className="press mt-3 flex h-11 items-center justify-center gap-1.5 rounded-full bg-pink text-[15px] font-semibold text-white shadow-pink">
            Собрать день по запросу <ArrowRight size={17} />
          </Link>
        </div>
      )}

      {!q && !category && (
        <section className="mt-3 px-4">
          <h2 className="text-[15px] font-semibold text-muted">Часто ищут</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGEST.map((s) => (
              <button key={s} onClick={() => setQ(s)} className="press h-9 rounded-full bg-surface px-3.5 text-[14.5px] font-medium shadow-card">
                {s}
              </button>
            ))}
            <button onClick={() => setQ("недалеко, чтобы дети побегали и потом поесть")} className="press h-9 rounded-full bg-purple-50 px-3.5 text-[14.5px] font-medium text-purple">
              ✨ «недалеко, побегать и поесть»
            </button>
          </div>
        </section>
      )}

      <div className="mt-4 flex items-center justify-between px-4">
        <p className="text-[14px] font-semibold text-muted">
          {results.length ? `${results.length} ${plural(results.length, "место", "места", "мест")}` : ""}
        </p>
        <div className="flex gap-1.5">
          {(
            [
              ["best", "Лучшие"],
              ["near", "Ближе"],
              ["cheap", "Дешевле"],
            ] as [Sort, string][]
          )
            .filter(([id]) => id !== "near" || !anywhere)
            .map(([id, label]) => (
            <FilterChip key={id} size="sm" active={(sort === "near" && anywhere ? "best" : sort) === id} onClick={() => setSort(id)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2.5 px-4">
        {results.map((p: Place) => (
          <PlaceRow key={p.id} place={p} />
        ))}
      </div>
      {results.length === 0 && (
        <EmptyState
          art="search"
          title="Ничего не нашлось"
          text="Попробуйте сказать иначе — например, «бесплатно на улице» или «музей для 6 лет»."
          action={{ href: plannerHref, label: "Пусть подберёт планировщик" }}
        />
      )}
    </main>
  );
}
