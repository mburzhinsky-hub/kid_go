"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Pencil, MapPin, Sparkles, CalendarDays, Database } from "lucide-react";
import type { Adventure, CategoryId, KidEvent, Place } from "@/lib/types";
import { CATEGORIES, categoryDef } from "@/lib/catalog";
import { SmartImage } from "@/components/ui/SmartImage";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatAgeRange, formatPrice } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { CreatorsPanel, CollectionsPanel, IntentsPanel } from "./SocialAdmin";

type Tab = "places" | "adventures" | "events" | "creators" | "collections" | "intents";

/**
 * Минимальный кабинет контента. Сейчас редактирует локальную копию данных;
 * в проде формы шлют PATCH в /api/admin/* (Next route handlers → Prisma), доступ — по роли editor.
 */
export function AdminScreen({ places: initial, adventures, events }: { places: Place[]; adventures: Adventure[]; events: KidEvent[] }) {
  const [tab, setTab] = useState<Tab>("places");
  const [places, setPlaces] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const [edit, setEdit] = useState<Place | null>(null);
  const toast = useToast((s) => s.show);
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const list = places.filter((p) => (cat === "all" || p.category === cat) && `${p.title} ${p.address}`.toLowerCase().includes(q.toLowerCase()));
  const issues = places.filter((p) => p.photos.length < 3 || p.reviews.length === 0 || !p.metro);

  return (
    <main className="min-h-dvh pb-16">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback="/profile" />
        <div>
          <h1 className="tight text-[24px] font-[850] leading-tight">Кабинет контента</h1>
          <p className="text-[13px] text-muted">Демо · изменения сохраняются локально</p>
        </div>
      </header>

      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        <Kpi icon={<MapPin size={17} />} value={places.length} label="мест" bg="#E4F4DD" />
        <Kpi icon={<Sparkles size={17} />} value={adventures.length} label="приключений" bg="#FFE4F1" />
        <Kpi icon={<CalendarDays size={17} />} value={events.length} label="событий" bg="#E2EEFF" />
      </div>
      {issues.length > 0 && (
        <p className="mx-4 mt-2 rounded-[14px] bg-yellow-50 px-3 py-2 text-[13px] text-[#7a5600]">
          ⚠️ У {issues.length} мест не хватает данных (фото, метро или отзывы)
        </p>
      )}

      <div className="sticky top-0 z-20 mt-3 bg-bg/95 px-4 pb-2 pt-2">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-fill p-1">
          {(
            [
              ["places", "Места"],
              ["adventures", "Приключения"],
              ["events", "События"],
              ["creators", "Авторы"],
              ["collections", "Подборки"],
              ["intents", "Намерения"],
            ] as [Tab, string][]
          ).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold", tab === id ? "bg-white shadow-card" : "text-muted")}>
              {l}
            </button>
          ))}
        </div>
        {tab === "places" && (
          <>
            <div className="mt-2 flex gap-2">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-3.5 shadow-card">
                <Search size={18} className="text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или адрес" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
              </label>
              <button
                onClick={() => toast("В проде: форма создания → POST /api/admin/places")}
                className="press inline-flex h-11 items-center gap-1 rounded-full bg-pink px-4 text-[14.5px] font-semibold text-white"
              >
                <Plus size={17} /> Место
              </button>
            </div>
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id as CategoryId | "all")}
                  className={cn("press h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold", cat === c.id ? "bg-ink text-white" : "bg-surface shadow-card")}
                >
                  {c.short}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 px-4 pt-1">
        {tab === "places" &&
          list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-[18px] bg-surface p-2.5 shadow-card">
              <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="56px" className="h-14 w-14 shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{p.title}</p>
                <p className="truncate text-[12.5px] text-muted">
                  <span style={{ color: categoryDef(p.category).fg }}>{categoryDef(p.category).name}</span> · {formatAgeRange(p.age_min, p.age_max)} ·{" "}
                  {p.price_min ? `от ${formatPrice(p.price_min)}` : "бесплатно"} · {p.review_count > 0 ? `★ ${p.rating}` : "без отзывов"}
                </p>
              </div>
              <button onClick={() => setEdit(p)} aria-label={`Редактировать ${p.title}`} className="press grid h-9 w-9 place-items-center rounded-full bg-fill">
                <Pencil size={16} />
              </button>
            </div>
          ))}
        {tab === "adventures" &&
          adventures.map((a) => (
            <Link key={a.id} href={`/adventures/${a.slug}`} className="press flex items-center gap-3 rounded-[18px] bg-surface p-3 shadow-card">
              <span className="grid h-12 w-12 place-items-center rounded-[14px] text-[24px]" style={{ background: a.tint }}>
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{a.title}</p>
                <p className="truncate text-[12.5px] text-muted">{a.steps.map((s) => byId.get(s.place_id)?.title).join(" → ")}</p>
              </div>
              <span className="text-[13px] font-bold text-green">{a.recommend_percent}%</span>
            </Link>
          ))}
        {tab === "creators" && <CreatorsPanel />}
        {tab === "collections" && <CollectionsPanel />}
        {tab === "intents" && <IntentsPanel />}
        {tab === "events" &&
          events.map((e) => (
            <div key={e.id} className="rounded-[18px] bg-surface p-3 shadow-card">
              <p className="text-[15px] font-semibold">{e.title}</p>
              <p className="text-[12.5px] text-muted">
                {byId.get(e.place_id)?.title} · {e.start_at.slice(0, 10)} {e.start_at.slice(11, 16)}–{e.end_at.slice(11, 16)} · {e.price ? formatPrice(e.price) : "бесплатно"}
              </p>
            </div>
          ))}
      </div>

      <div className="mx-4 mt-6 flex items-start gap-2 rounded-[18px] bg-fill p-3 text-[13px] text-ink-2">
        <Database size={16} className="mt-0.5 shrink-0" />
        <span>
          Данные отдаёт mocked data layer (<code>src/lib/data/repository.ts</code>). Публичный API: <code>/api/places</code>, <code>/api/adventures</code>,{" "}
          <code>/api/plan</code>. Схема БД — <code>prisma/schema.prisma</code>.
        </span>
      </div>

      {edit && (
        <PlaceEditor
          place={edit}
          onClose={() => setEdit(null)}
          onSave={(p) => {
            setPlaces((xs) => xs.map((x) => (x.id === p.id ? p : x)));
            setEdit(null);
            toast("Сохранено (локально) ✅");
          }}
        />
      )}
    </main>
  );
}

function Kpi({ icon, value, label, bg }: { icon: React.ReactNode; value: number; label: string; bg: string }) {
  return (
    <div className="rounded-[18px] p-3" style={{ background: bg }}>
      {icon}
      <p className="tight mt-1 text-[24px] font-[850] leading-none">{value}</p>
      <p className="text-[12px] text-ink-2">{label}</p>
    </div>
  );
}

function PlaceEditor({ place, onClose, onSave }: { place: Place; onClose: () => void; onSave: (p: Place) => void }) {
  const [d, setD] = useState(place);
  const field = (label: string, el: React.ReactNode) => (
    <label className="block text-[13px] font-semibold text-muted">
      {label}
      <div className="mt-1">{el}</div>
    </label>
  );
  const input = "h-11 w-full rounded-[12px] bg-fill px-3 text-[15px] text-ink outline-none focus:ring-2 focus:ring-pink/40";
  const FLAGS: [keyof Place, string][] = [
    ["indoor", "В помещении"],
    ["outdoor", "На улице"],
    ["stroller_friendly", "С коляской"],
    ["parking", "Парковка"],
    ["kids_menu", "Детское меню"],
    ["baby_room", "Пеленальная"],
    ["booking_required", "Нужна запись"],
    ["is_hit", "Хит"],
  ];
  return (
    <BottomSheet open onClose={onClose} title="Редактирование">
      <div className="space-y-3 pb-2">
        {field("Название", <input className={input} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />)}
        {field("Подзаголовок", <input className={input} value={d.subtitle} onChange={(e) => setD({ ...d, subtitle: e.target.value })} />)}
        {field(
          "Категория",
          <select className={input} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as CategoryId })}>
            {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-2 gap-2">
          {field("Цена от, ₽", <input type="number" className={input} value={d.price_min} onChange={(e) => setD({ ...d, price_min: Number(e.target.value) })} />)}
          {field("Цена до, ₽", <input type="number" className={input} value={d.price_max} onChange={(e) => setD({ ...d, price_max: Number(e.target.value) })} />)}
          {field("Возраст от", <input type="number" className={input} value={d.age_min} onChange={(e) => setD({ ...d, age_min: Number(e.target.value) })} />)}
          {field("Возраст до", <input type="number" className={input} value={d.age_max} onChange={(e) => setD({ ...d, age_max: Number(e.target.value) })} />)}
        </div>
        {field("Описание", <textarea rows={4} className={cn(input, "h-auto py-2.5")} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />)}
        <div className="flex flex-wrap gap-1.5">
          {FLAGS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setD({ ...d, [k]: !d[k] })}
              className={cn("press h-9 rounded-full px-3 text-[13.5px] font-semibold", d[k] ? "bg-green-50 text-green" : "bg-fill text-muted")}
            >
              {d[k] ? "✓ " : ""}
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => onSave(d)} className="press mt-2 h-13 h-[52px] w-full rounded-full bg-pink text-[16px] font-bold text-white shadow-pink">
          Сохранить
        </button>
      </div>
    </BottomSheet>
  );
}
