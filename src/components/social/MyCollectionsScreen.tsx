"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Eye, Heart, Share2, MousePointerClick, Smartphone, Map as MapIcon, Pencil, Trash2, ChevronDown, Lock, Link2, Globe, FileEdit, ExternalLink } from "lucide-react";
import type { Collection, ResolvedCollection } from "@/lib/social/types";
import { useSocial } from "@/lib/social/store";
import { useEvents } from "@/lib/social/events";
import { statsOf, byCollection, placeInterest, totalsOf, attributedWants } from "@/lib/social/stats";
import { myAuthor, deleteCollection, useMyCollections } from "@/lib/social/repo";
import { getAnonId } from "@/lib/social/identity";
import { placesOf, coverOf, placesWord } from "@/lib/social/catalog";
import { getPlaceSync } from "@/lib/data/repository";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { SmartImage } from "@/components/ui/SmartImage";
import { plural, quote } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CollectionCover } from "./CollectionCover";
import { useCollectionShare } from "./CollectionCard";

const STATUS = {
  DRAFT: { label: "Черновик", cls: "bg-fill text-ink-2", Icon: FileEdit },
  PUBLIC: { label: "Публичная", cls: "bg-green-50 text-green-ink", Icon: Globe },
  UNLISTED: { label: "По ссылке", cls: "bg-blue-50 text-blue-ink", Icon: Link2 },
  PRIVATE: { label: "Приватная", cls: "bg-fill text-ink-2", Icon: Lock },
} as const;

const statusOf = (c: Collection) => STATUS[c.status === "DRAFT" ? "DRAFT" : c.visibility];

/**
 * «Мои подборки»: список и аналитика автора. Не перегружаем: главное число — сколько людей захотели сходить благодаря подборкам;
 * подробности по каждой подборке раскрываются по нажатию.
 */
export function MyCollectionsScreen() {
  const hydrated = useSocial((s) => s.hydrated);
  const me = useSocial((s) => s.me);
  const [del, setDel] = useState<Collection | null>(null);
  const toast = useToast((s) => s.show);
  const events = useEvents();
  const mine = useMyCollections();

  const ids = mine.map((c) => c.id);
  const total = useMemo(() => totalsOf(events, ids), [events, ids]);
  const interest = useMemo(() => {
    const set = new Set(ids);
    return placeInterest(events, (e) => !!e.collection_id && set.has(e.collection_id)).filter((x) => x.want > 0 || x.opens > 0).slice(0, 6);
  }, [events, ids]);
  const maxWant = Math.max(1, ...interest.map((i) => i.want));
  const serverStats = !!process.env.NEXT_PUBLIC_EVENTS_URL;

  return (
    <main className="pb-24">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <BackButton fallback="/profile" />
        <div className="min-w-0 flex-1">
          <h1 className="tight text-[24px] font-[850] leading-tight">Мои подборки</h1>
          <p className="text-[14px] text-muted">{me ? `${me.name} · @${me.username}` : "Собирайте места и делитесь с друзьями"}</p>
        </div>
        <Link href="/collections/new/?from=my_collections" className="press inline-flex h-11 items-center gap-1.5 rounded-full bg-pink px-4 text-[15px] font-bold text-white shadow-pink">
          <Plus size={20} /> Создать
        </Link>
      </header>

      {!hydrated ? (
        <div className="space-y-3 px-4 pt-3">
          <div className="h-32 rounded-[24px] skeleton" />
          <div className="h-40 rounded-[24px] skeleton" />
        </div>
      ) : mine.length === 0 ? (
        <EmptyState
          art="plan"
          title="Соберите первую подборку"
          text="Например, «10 мест для дождливого дня». Друзья откроют её по ссылке без регистрации и смогут отметить, куда хотят сходить."
          action={{ href: "/collections/new/?from=my_collections", label: "Создать подборку" }}
        />
      ) : (
        <>
          <section className="mx-4 mt-3 overflow-hidden rounded-[28px] p-5" style={{ background: "linear-gradient(135deg,#FFE9F3,#F4EAFF)" }}>
            <p className="text-[14px] font-semibold text-ink-2">Благодаря вашим подборкам захотели сходить</p>
            <p className="tight mt-1 text-[52px] font-[900] leading-none text-pink-ink">{total.wantToGo}</p>
            <p className="mt-0.5 text-[14px] text-ink-2">{plural(total.wantToGo, "раз добавили место в «Хочу сюда»", "раза добавили место в «Хочу сюда»", "раз добавили места в «Хочу сюда»")}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini icon={<Eye size={16} />} value={total.views} label="просмотров" />
              <Mini icon={<Heart size={16} />} value={total.saves} label="сохранили" />
              <Mini icon={<Share2 size={16} />} value={total.shares} label="поделились" />
            </div>
          </section>

          <section className="mt-6 space-y-3 px-4">
            {mine.map((c) => (
              <CollectionRow key={c.id} c={c} onDelete={() => setDel(c)} events={events} />
            ))}
          </section>

          {interest.length > 0 && (
            <section className="mt-8 px-4">
              <h2 className="tight text-[22px] font-[800]">Какие места заинтересовали аудиторию</h2>
              <ol className="mt-3 space-y-2">
                {interest.map((i, n) => {
                  const p = getPlaceSync(i.place_id);
                  if (!p) return null;
                  return (
                    <li key={i.place_id} className="flex items-center gap-3 rounded-[20px] bg-surface p-2.5 shadow-card">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-bold">{n + 1}</span>
                      <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="48px" className="h-12 w-12 shrink-0 rounded-[12px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold leading-tight">{p.title}</p>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fill">
                          <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(6, (i.want / maxWant) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right leading-tight">
                        <p className="text-[16px] font-bold text-pink-ink">{i.want}</p>
                        <p className="text-[12px] text-muted">хотят</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {!serverStats && <p className="mx-4 mt-6 text-center text-[13px] leading-snug text-muted">Пока считаем действия, сделанные на этом устройстве. Когда подключится сервер, здесь появятся все посетители.</p>}
        </>
      )}

      <BottomSheet open={!!del} onClose={() => setDel(null)} title="Удалить подборку?">
        <p className="-mt-1 text-[15px] text-muted">{quote(del?.title ?? "")} исчезнет из вашего списка. Ссылки, которые вы уже отправили друзьям, продолжат открываться.</p>
        <div className="mt-4 flex gap-2 pb-2">
          <button onClick={() => setDel(null)} className="press h-12 flex-1 rounded-full bg-fill text-[16px] font-semibold">
            Отмена
          </button>
          <button
            onClick={() => {
              if (del) deleteCollection(del.id);
              setDel(null);
              toast("Подборка удалена");
            }}
            className="press h-12 flex-1 rounded-full bg-red-ink text-[16px] font-semibold text-white"
          >
            Удалить
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}

function Mini({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-[16px] bg-white/70 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[12px] text-ink-2">
        {icon} {label}
      </p>
      <p className="tight mt-0.5 text-[20px] font-[850] leading-none">{value}</p>
    </div>
  );
}

function CollectionRow({ c, onDelete, events }: { c: Collection; onDelete: () => void; events: ReturnType<typeof useEvents> }) {
  const me = useSocial((s) => s.me);
  const share = useCollectionShare();
  const [open, setOpen] = useState(false);
  const { placed } = useMemo(() => placesOf(c), [c]);
  const art = useMemo(() => coverOf(c, placed), [c, placed]);
  const st = useMemo(() => statsOf(events, byCollection(c.id)), [events, c.id]);
  const extra = useMemo(() => attributedWants(events, c.id), [events, c.id]);
  const status = statusOf(c);
  const resolved: ResolvedCollection | undefined = me ? { collection: c, author: myAuthor(me), source: "local" } : undefined;
  const canShare = !!resolved && c.status === "PUBLISHED" && c.visibility !== "PRIVATE";
  const interest = useMemo(() => placeInterest(events, byCollection(c.id)).filter((x) => x.want > 0).slice(0, 3), [events, c.id]);

  return (
    <article className="overflow-hidden rounded-[24px] bg-surface shadow-card">
      <div className="flex gap-3 p-3">
        <Link href={`/c/?id=${encodeURIComponent(c.id)}`} className="shrink-0">
          <CollectionCover art={art} sizes="80px" className="h-[84px] w-[84px] rounded-[16px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/c/?id=${encodeURIComponent(c.id)}`}>
            <h2 className="line-clamp-2 text-[17px] font-[800] leading-[1.15]">{c.title}</h2>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-semibold", status.cls)}>
              <status.Icon size={14} /> {status.label}
            </span>
            <span className="text-[13px] text-muted">{placesWord(placed.length)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-line">
        <Cell icon={<Eye size={14} />} value={st.views} label="просмотры" />
        <Cell icon={<Heart size={14} />} value={st.saves} label="сохранили" />
        <Cell icon={<Share2 size={14} />} value={st.shares} label="поделились" />
        <Cell icon={<Heart size={14} className="fill-pink text-pink" />} value={st.wantToGo} label="хотят" strong />
      </div>

      {open && (
        <div className="animate-rise px-3 pb-1 pt-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Detail icon={<MousePointerClick size={16} />} value={st.placeOpens} label="открыли места" />
            <Detail icon={<MapIcon size={16} />} value={st.maps} label="на карте" />
            <Detail icon={<Smartphone size={16} />} value={st.appClicks} label="в приложение" />
          </div>
          {extra > 0 && <p className="mt-2 text-[13px] text-muted">Ещё {extra} захотели сходить на других экранах после перехода по вашей ссылке.</p>}
          {interest.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-semibold text-ink-2">Больше всего хотят</p>
              <ul className="mt-1.5 space-y-1">
                {interest.map((i) => (
                  <li key={i.place_id} className="flex items-center justify-between text-[14px]">
                    <span className="truncate pr-2">{getPlaceSync(i.place_id)?.title ?? i.place_id}</span>
                    <b className="text-pink-ink">{i.want}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 p-3">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press hit relative inline-flex h-10 items-center gap-1 rounded-full bg-fill px-3 text-[14px] font-semibold">
          Подробнее <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        </button>
        <div className="ml-auto flex gap-1.5">
          {canShare && (
            <button onClick={() => resolved && share(resolved)} aria-label="Поделиться" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-pink-50 text-pink-ink">
              <Share2 size={16} />
            </button>
          )}
          <Link href={`/c/?id=${encodeURIComponent(c.id)}`} aria-label="Открыть" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-fill">
            <ExternalLink size={16} />
          </Link>
          <Link href={`/collections/edit/?id=${encodeURIComponent(c.id)}`} aria-label="Редактировать" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-fill">
            <Pencil size={16} />
          </Link>
          <button onClick={onDelete} aria-label="Удалить" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-fill text-muted">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Cell({ icon, value, label, strong }: { icon: React.ReactNode; value: number; label: string; strong?: boolean }) {
  return (
    <div className={cn("bg-surface px-1 py-2 text-center", strong && "bg-pink-50")}>
      <p className={cn("tight text-[20px] font-[850] leading-none", strong && "text-pink-ink")}>{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[12px] text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </p>
    </div>
  );
}

function Detail({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-[12px] bg-fill-2 px-2 py-2.5">
      <p className="flex items-center justify-center gap-1 text-ink-2">{icon}</p>
      <p className="tight mt-0.5 text-[18px] font-[850] leading-none">{value}</p>
      <p className="mt-1 text-[12px] leading-tight text-muted">{label}</p>
    </div>
  );
}
