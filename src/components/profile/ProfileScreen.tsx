"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight, MapPin, Sparkles, Check, Home, Users, Smartphone } from "lucide-react";
import type { Child, InterestId } from "@/lib/types";
import { useFamily, ageFromBirth, childLabel } from "@/lib/store";
import { TRAVEL_LIMITS } from "@/lib/location";
import { LocationSheet } from "@/components/location/LocationSheet";
import { INTERESTS, interestDef, BUDGETS, TRANSPORTS } from "@/lib/catalog";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TabBackButton } from "@/components/ui/BackButton";
import { plural } from "@/lib/format";
import { useSocial } from "@/lib/social/store";
import { useMyCollections } from "@/lib/social/repo";
import { useSocialUi } from "@/lib/social/ui-store";
import { cn } from "@/lib/cn";

const AVATARS = ["🦁", "🦄", "🐻", "🐰", "🦊", "🐼", "🐯", "🐸"];
const AVATAR_BG = ["#FFE4F1", "#EEE5FE", "#E2EEFF", "#E4F4DD", "#FFF3D6", "#FFE3D4"];
const CITIES = [
  { id: "Москва", soon: false },
  { id: "Санкт-Петербург", soon: true },
  { id: "Казань", soon: true },
];

export function ProfileScreen() {
  const s = useFamily();
  const [editing, setEditing] = useState<Child | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const mine = useMyCollections();
  const socialReady = useSocial((x) => x.hydrated);

  return (
    <main className="pb-28">
      <header className="px-4 pb-1 pt-[max(18px,env(safe-area-inset-top))]">
        <TabBackButton className="mb-2" />
        <h1 className="tight text-[32px] font-[850] leading-tight">Наша семья</h1>
        <p className="mt-0.5 text-[15.5px] text-muted">Чем точнее профиль — тем точнее идеи</p>
      </header>

      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <Stat value={s.hydrated ? s.children.length : "–"} label={plural(s.children.length, "ребёнок", "ребёнка", "детей")} bg="#FFE4F1" />
        <Stat value={s.hydrated ? s.wantPlaces.length : "–"} label="хотелок" bg="#EEE5FE" />
        <Stat value={s.hydrated ? s.visitedPlaces.length : "–"} label="уже были" bg="#E4F4DD" />
      </div>

      <Link href="/collections/" className="press mx-4 mt-3 flex items-center gap-3 rounded-[22px] p-3.5" style={{ background: "linear-gradient(120deg,#FFE9F3,#F4EAFF)" }}>
        <span className="text-[30px]">💌</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Мои подборки</span>
          <span className="block text-[13px] leading-snug text-ink-2">
            {socialReady && mine.length ? `${mine.length} ${plural(mine.length, "подборка", "подборки", "подборок")} · посмотреть, как их открывают` : "Соберите любимые места и отправьте друзьям"}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-pink" />
      </Link>

      <section className="mt-7 px-4">
        <h2 className="tight text-[22px] font-[800]">Дети</h2>
        <div className="mt-3 space-y-2.5">
          {s.children.map((c, i) => (
            <ChildProfileCard key={c.id} child={c} index={i} onEdit={() => setEditing(c)} />
          ))}
          <button
            onClick={() => setEditing({ id: `c${Date.now()}`, name: "", age: 4, interests: [], emoji: AVATARS[s.children.length % AVATARS.length] })}
            className="press flex h-16 w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-[#dcd9d2] text-[15.5px] font-semibold text-muted"
          >
            <Plus size={19} /> Добавить ребёнка
          </button>
        </div>
      </section>

      <section className="mt-8 px-4">
        <h2 className="tight text-[22px] font-[800]">Предпочтения</h2>
        <div className="mt-3 space-y-3 rounded-[24px] bg-surface p-4 shadow-card">
          <Segmented
            label="Обычный бюджет на день"
            value={s.budget}
            options={BUDGETS.map((b) => ({ id: b.id, label: b.label }))}
            onChange={(v) => s.setPrefs({ budget: v as typeof s.budget })}
          />
          <Segmented
            label="Как передвигаемся"
            value={s.transport}
            options={TRANSPORTS.map((t) => ({ id: t.id, label: `${t.emoji} ${t.id === "transit" ? "Метро/автобус" : t.label}` }))}
            onChange={(v) => s.setPrefs({ transport: v as typeof s.transport })}
          />
          {s.hydrated && s.origin.source !== "default" ? (
            <Segmented
              label="Готовы ехать до"
              value={String(s.maxTravelMin)}
              options={TRAVEL_LIMITS.map((m) => ({ id: String(m), label: m === 90 ? "1,5 часа" : m === 60 ? "часа" : `${m} мин` }))}
              onChange={(v) => s.setPrefs({ maxTravelMin: Number(v) })}
            />
          ) : (
            <p className="text-[13.5px] leading-snug text-muted">Ищем по всей Москве. Выберите округ или точку — и можно будет ограничить время в пути.</p>
          )}
        </div>
      </section>

      <section className="mt-8 px-4">
        <div className="overflow-hidden rounded-[24px] bg-surface shadow-card">
          <Row
            id="home"
            icon={<Home size={20} className="text-pink" />}
            label="Где ищем"
            value={!s.hydrated || s.origin.source === "default" ? "Вся Москва" : s.origin.source === "home" ? "Дом" : s.origin.label}
            onClick={() => setLocOpen(true)}
          />
          <Row id="city" icon={<MapPin size={20} className="text-red" />} label="Город" value={s.city} onClick={() => setCityOpen(true)} />
          <Row href="/onboarding" icon={<Sparkles size={20} className="text-purple" />} label="Пройти знакомство заново" />
          {s.hydrated && !s.children.length && (
            <Row icon={<Users size={20} className="text-green" />} label="Посмотреть на демо-семье" value="Миша и Аня" onClick={() => s.loadDemoFamily()} />
          )}
          <Row icon={<Smartphone size={20} className="text-blue" />} label="Перенести на другое устройство" onClick={() => useSocialUi.getState().openTransfer()} />
        </div>
        <p className="mt-4 text-center text-[12.5px] text-muted">КидГоу · данные семьи хранятся только на этом устройстве</p>
      </section>

      <ChildEditor child={editing} onClose={() => setEditing(null)} />
      <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
      <BottomSheet open={cityOpen} onClose={() => setCityOpen(false)} title="Ваш город">
        <div className="space-y-2 pb-2">
          {CITIES.map((c) => (
            <button
              key={c.id}
              disabled={c.soon}
              onClick={() => {
                s.setPrefs({ city: c.id });
                setCityOpen(false);
              }}
              className={cn("press flex h-14 w-full items-center justify-between rounded-[18px] px-4 text-[16px] font-semibold", s.city === c.id ? "bg-pink-50 text-pink" : "bg-fill", c.soon && "opacity-50")}
            >
              {c.id}
              {c.soon ? <span className="text-[13px] font-medium text-muted">скоро</span> : s.city === c.id && <Check size={19} />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}

function Stat({ value, label, bg }: { value: number | string; label: string; bg: string }) {
  return (
    <div className="rounded-[20px] px-3 py-3 text-center" style={{ background: bg }}>
      <p className="tight text-[26px] font-[850] leading-none">{value}</p>
      <p className="mt-1 text-[12.5px] font-medium text-ink-2">{label}</p>
    </div>
  );
}

export function ChildProfileCard({ child, index, onEdit }: { child: Child; index: number; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] bg-surface p-3.5 shadow-card">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[30px]" style={{ background: AVATAR_BG[index % AVATAR_BG.length] }}>
        {child.emoji ?? AVATARS[index % AVATARS.length]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold leading-tight">
          {child.name ? <>{child.name}, </> : null}
          <span className={child.name ? "font-semibold text-muted" : ""}>{childLabel(child).replace(/^.*?, /, "")}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {child.interests.length ? (
            child.interests.map((i) => <InterestChip key={i} id={i} small />)
          ) : (
            <span className="text-[13px] text-muted">Интересы не выбраны</span>
          )}
        </div>
      </div>
      <button onClick={onEdit} aria-label={`Изменить ${child.name || "ребёнка"}`} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill">
        <Pencil size={16} />
      </button>
    </div>
  );
}

export function InterestChip({ id, active, onClick, small }: { id: InterestId; active?: boolean; onClick?: () => void; small?: boolean }) {
  const d = interestDef(id);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold transition-all",
        small ? "h-7 px-2.5 text-[12.5px]" : "press h-10 px-3.5 text-[14.5px]",
        onClick && !active && "opacity-80",
        active && "ring-2 ring-offset-1"
      )}
      style={{ background: d.bg, color: d.fg, ["--tw-ring-color" as string]: d.fg }}
    >
      <span>{d.emoji}</span> {d.label}
    </Tag>
  );
}

function ChildEditor({ child, onClose }: { child: Child | null; onClose: () => void }) {
  const s = useFamily();
  const [draft, setDraft] = useState<Child | null>(child);
  const [lastId, setLastId] = useState<string | null>(null);
  if (child && child.id !== lastId) {
    setLastId(child.id);
    setDraft(child);
  }
  if (!child || !draft) return null;
  const isNew = !s.children.some((c) => c.id === child.id);
  const toggle = (i: InterestId) =>
    setDraft({ ...draft, interests: draft.interests.includes(i) ? draft.interests.filter((x) => x !== i) : [...draft.interests, i] });

  return (
    <BottomSheet open onClose={onClose} title={isNew ? "Новый ребёнок" : child.name || "Ребёнок"}>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => setDraft({ ...draft, emoji: a })}
            className={cn("press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fill text-[26px]", draft.emoji === a && "ring-[3px] ring-pink")}
          >
            {a}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[13.5px] font-semibold text-muted">
        Имя
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 h-12 w-full rounded-[14px] bg-fill px-3.5 text-[16px] font-medium text-ink outline-none focus:ring-2 focus:ring-pink/40"
          placeholder="Как зовут? (необязательно)"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-[13.5px] font-semibold text-muted">
          Дата рождения
          <input
            type="date"
            value={draft.birthDate ?? ""}
            onChange={(e) => {
              const bd = e.target.value;
              const age = bd ? ageFromBirth(bd) : draft.age;
              setDraft({ ...draft, birthDate: bd, age });
            }}
            className="mt-1 h-12 w-full rounded-[14px] bg-fill px-3 text-[15px] font-medium text-ink outline-none"
          />
        </label>
        <label className="block text-[13.5px] font-semibold text-muted">
          Или возраст
          <select
            value={draft.age}
            onChange={(e) => setDraft({ ...draft, age: Number(e.target.value), birthDate: undefined })}
            className="mt-1 h-12 w-full rounded-[14px] bg-fill px-3 text-[15px] font-medium text-ink outline-none"
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "до года" : `${i} ${plural(i, "год", "года", "лет")}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-4 text-[13.5px] font-semibold text-muted">Что нравится?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {INTERESTS.map((i) => (
          <InterestChip key={i.id} id={i.id} active={draft.interests.includes(i.id)} onClick={() => toggle(i.id)} />
        ))}
      </div>
      <div className="mt-5 flex gap-2 pb-1">
        {!isNew && (
          <button
            onClick={() => {
              s.removeChild(child.id);
              onClose();
            }}
            aria-label="Удалить"
            className="press grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red"
          >
            <Trash2 size={20} />
          </button>
        )}
        <button
          onClick={() => {
            s.upsertChild({ ...draft, name: draft.name.trim() });
            onClose();
          }}
          className="press h-14 flex-1 rounded-full bg-pink text-[17px] font-bold text-white shadow-pink disabled:opacity-40"
        >
          {isNew ? "Добавить" : "Сохранить"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-ink-2">{label}</p>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={cn("press h-10 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition-colors", value === o.id ? "bg-ink text-white" : "bg-fill")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ icon, label, value, href, onClick, id }: { icon: React.ReactNode; label: string; value?: string; href?: string; onClick?: () => void; id?: string }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-fill-2">{icon}</span>
      <span className="flex-1 text-left text-[16px] font-semibold">{label}</span>
      {value && <span className="text-[14px] text-muted">{value}</span>}
      <ChevronRight size={19} className="text-muted-2" />
    </>
  );
  const cls = "press flex w-full items-center gap-3 border-b border-line px-3.5 py-3 last:border-0";
  return href ? (
    <Link href={href} className={cls} id={id}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls} id={id}>
      {inner}
    </button>
  );
}
