"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Eye, EyeOff, Pencil, Star, Trash2 } from "lucide-react";
import type { CollectionStatus, CreatorStatus, ResolvedCollection } from "@/lib/social/types";
import { useSocial } from "@/lib/social/store";
import { useEvents } from "@/lib/social/events";
import { statsOf, byCollection, placeInterest } from "@/lib/social/stats";
import { deleteCollection, useAllCollections, useKnownCreators } from "@/lib/social/repo";
import { collectionPath } from "@/lib/social/share";
import { placesOf, coverOf, placesWord } from "@/lib/social/catalog";
import { getPlaceSync } from "@/lib/data/repository";
import { CollectionCover } from "@/components/social/CollectionCover";
import { CreatorAvatar } from "@/components/social/Avatar";
import { collectionHref } from "@/components/social/CollectionCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const CREATOR_STATUS: Record<CreatorStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Одобрен", cls: "bg-green-50 text-green" },
  PENDING: { label: "На проверке", cls: "bg-yellow-50 text-[#9a6b00]" },
  SUSPENDED: { label: "Приостановлен", cls: "bg-red-50 text-red" },
};

const SOURCE_LABEL: Record<string, string> = {
  COLLECTION: "Подборки",
  PLACE: "Страница места",
  MAP: "Карта",
  ADVENTURE: "Приключения",
  HOME: "Главная",
  SEARCH: "Поиск",
  CREATOR: "Страница автора",
};

const LocalNote = () => <p className="mt-4 text-center text-[12.5px] leading-snug text-muted">Считаем действия, сделанные на этом устройстве. С серверной аналитикой (NEXT_PUBLIC_EVENTS_URL) здесь будут все посетители.</p>;

/** Авторы: одобрить, приостановить, рекомендовать, создать подборку от их имени. */
export function CreatorsPanel() {
  const creators = useKnownCreators();
  const setAdminCreator = useSocial((s) => s.setAdminCreator);
  const events = useEvents();
  const toast = useToast((s) => s.show);

  const wantsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.event_name !== "place_want_to_go") continue;
      const id = e.creator_id ?? (e.properties.attributed_creator_id as string | undefined);
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [events]);

  return (
    <div className="space-y-2.5">
      {creators.map((c) => {
        const st = CREATOR_STATUS[c.status];
        return (
          <div key={c.author.id} className="rounded-[20px] bg-surface p-3.5 shadow-card">
            <div className="flex items-center gap-3">
              <CreatorAvatar author={c.author} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold leading-tight">{c.author.name}</p>
                <p className="truncate text-[13px] text-muted">
                  @{c.author.username} · {c.collections} {c.collections === 1 ? "подборка" : c.collections < 5 && c.collections > 0 ? "подборки" : "подборок"} · {wantsBy.get(c.author.id) ?? 0} «хочу сюда»
                </p>
              </div>
              <span className={cn("inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold", st.cls)}>{st.label}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status !== "APPROVED" ? (
                <Act onClick={() => (setAdminCreator(c.author.id, { status: "APPROVED" }), toast("Автор одобрен"))} tone="green">
                  Одобрить
                </Act>
              ) : (
                <Act onClick={() => (setAdminCreator(c.author.id, { status: "SUSPENDED", featured: false }), toast("Автор приостановлен: подборки скрыты"))}>Приостановить</Act>
              )}
              <Act
                onClick={() => (setAdminCreator(c.author.id, { featured: !c.featured }), toast(c.featured ? "Убрали из рекомендованных" : "Автор в рекомендованных"))}
                tone={c.featured ? "pink" : undefined}
                disabled={c.status !== "APPROVED"}
              >
                <Star size={14} className={cn(c.featured && "fill-pink")} /> {c.featured ? "Рекомендован" : "Рекомендовать"}
              </Act>
              <Link href={`/collections/new/?as=${encodeURIComponent(c.author.username)}&from=admin`} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13.5px] font-semibold">
                <Pencil size={14} /> Подборка от имени
              </Link>
              {c.origin === "seed" && (
                <Link href={`/@${c.author.username}/`} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13.5px] font-semibold">
                  <ExternalLink size={14} /> Страница
                </Link>
              )}
            </div>
          </div>
        );
      })}
      <LocalNote />
    </div>
  );
}

/** Подборки: скрыть/показать, рекомендовать, удалить созданные здесь, посмотреть цифры. */
export function CollectionsPanel() {
  const all = useAllCollections();
  const events = useEvents();
  const adminCollections = useSocial((s) => s.adminCollections);
  const setAdminCollection = useSocial((s) => s.setAdminCollection);
  const toast = useToast((s) => s.show);
  const [del, setDel] = useState<ResolvedCollection | null>(null);

  return (
    <div className="space-y-2.5">
      {all.map((r) => {
        const c = r.collection;
        const { placed } = placesOf(c);
        const art = coverOf(c, placed);
        const st = statsOf(events, byCollection(c.id));
        const hidden = c.status === "HIDDEN";
        const featured = !!adminCollections[c.id]?.featured;
        const visLabel = c.status === "DRAFT" ? "Черновик" : hidden ? "Скрыта" : c.visibility === "PUBLIC" ? "Публичная" : c.visibility === "UNLISTED" ? "По ссылке" : "Приватная";
        return (
          <div key={c.id} className={cn("rounded-[20px] bg-surface p-3 shadow-card", hidden && "opacity-70")}>
            <div className="flex items-center gap-3">
              <CollectionCover art={art} sizes="64px" className="h-16 w-16 shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{c.title}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  {r.author.name} · {placesWord(placed.length)} · {visLabel}
                </p>
                <p className="text-[12.5px] text-ink-2">
                  👁 {st.views} · ❤️ {st.saves} · ↗ {st.shares} · хотят {st.wantToGo}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Act onClick={() => (setAdminCollection(c.id, { status: hidden ? "PUBLISHED" : ("HIDDEN" as CollectionStatus) }), toast(hidden ? "Подборка снова видна" : "Подборка скрыта"))}>
                {hidden ? <Eye size={14} /> : <EyeOff size={14} />} {hidden ? "Показать" : "Скрыть"}
              </Act>
              <Act
                onClick={() => (setAdminCollection(c.id, { featured: !featured }), toast(featured ? "Убрали из рекомендованных" : "Подборка поднята на главной"))}
                tone={featured ? "pink" : undefined}
                disabled={hidden || c.visibility !== "PUBLIC" || c.status !== "PUBLISHED"}
              >
                <Star size={14} className={cn(featured && "fill-pink")} /> {featured ? "Рекомендована" : "Рекомендовать"}
              </Act>
              <Link href={collectionHref(r)} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13.5px] font-semibold">
                <ExternalLink size={14} /> Открыть
              </Link>
              {r.source === "local" && (
                <>
                  <Link href={`/collections/edit/?id=${encodeURIComponent(c.id)}`} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13.5px] font-semibold">
                    <Pencil size={14} /> Править
                  </Link>
                  <Act onClick={() => setDel(r)} tone="red">
                    <Trash2 size={14} /> Удалить
                  </Act>
                </>
              )}
            </div>
            {r.source === "seed" && <p className="mt-2 text-[12px] text-muted">Из демо-каталога: правится в коде, скрывается здесь. Адрес: {collectionPath(r)}</p>}
          </div>
        );
      })}
      <LocalNote />
      <BottomSheet open={!!del} onClose={() => setDel(null)} title="Удалить подборку?">
        <p className="-mt-1 text-[15px] text-muted">«{del?.collection.title}» исчезнет из каталога. Отправленные ссылки с копией подборки продолжат открываться.</p>
        <div className="mt-4 flex gap-2 pb-2">
          <button onClick={() => setDel(null)} className="press h-12 flex-1 rounded-full bg-fill text-[15.5px] font-semibold">
            Отмена
          </button>
          <button
            onClick={() => {
              if (del) deleteCollection(del.collection.id);
              setDel(null);
              toast("Подборка удалена");
            }}
            className="press h-12 flex-1 rounded-full bg-red text-[15.5px] font-bold text-white"
          >
            Удалить
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

/** Аналитика намерений: откуда приходит «Хочу сюда», какие места и авторы приводят людей, воронка подборки. */
export function IntentsPanel() {
  const events = useEvents();
  const creators = useKnownCreators();

  const d = useMemo(() => {
    const wants = events.filter((e) => e.event_name === "place_want_to_go");
    const removes = events.filter((e) => e.event_name === "place_want_to_go_remove").length;
    const visited = events.filter((e) => e.event_name === "place_visited").length;
    const bySource = new Map<string, number>();
    for (const e of wants) {
      const k = String(e.properties.source_type ?? "PLACE");
      bySource.set(k, (bySource.get(k) ?? 0) + 1);
    }
    const viaCreators = wants.filter((e) => e.creator_id || e.properties.attributed_creator_id).length;
    const fromCollections = wants.filter((e) => e.collection_id).length;
    const funnel = {
      views: events.filter((e) => e.event_name === "collection_view").length,
      wants: fromCollections,
      saves: events.filter((e) => e.event_name === "collection_save").length,
      app: events.filter((e) => e.event_name === "collection_app_open_click" || e.event_name === "collection_app_install_click").length,
    };
    return { wants: wants.length, removes, visited, bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]), viaCreators, funnel, top: placeInterest(events, () => true).filter((i) => i.want > 0).slice(0, 8) };
  }, [events]);

  const perCreator = useMemo(
    () =>
      creators
        .map((c) => ({
          c,
          n: events.filter((e) => e.event_name === "place_want_to_go" && (e.creator_id === c.author.id || e.properties.attributed_creator_id === c.author.id)).length,
        }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n),
    [creators, events]
  );

  const maxSrc = Math.max(1, ...d.bySource.map(([, n]) => n));
  const maxTop = Math.max(1, ...d.top.map((i) => i.want));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={d.wants} label="«Хочу сюда»" bg="#FFE4F1" />
        <Stat value={d.visited} label="«Были»" bg="#E4F4DD" />
        <Stat value={d.viaCreators} label="через авторов" bg="#EEE5FE" />
      </div>
      {d.removes > 0 && <p className="-mt-3 text-[12.5px] text-muted">{d.removes} раз убрали из хотелок.</p>}

      <section>
        <h3 className="text-[16px] font-bold">Откуда приходит намерение</h3>
        {d.bySource.length ? (
          <ul className="mt-2 space-y-2">
            {d.bySource.map(([k, n]) => (
              <li key={k} className="rounded-[16px] bg-surface p-3 shadow-card">
                <div className="flex justify-between text-[14px] font-semibold">
                  <span>{SOURCE_LABEL[k] ?? k}</span>
                  <span className="text-pink">{n}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fill">
                  <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(6, (n / maxSrc) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-[16px] bg-fill p-3 text-[14px] text-muted">Пока нет «Хочу сюда» на этом устройстве.</p>
        )}
      </section>

      <section>
        <h3 className="text-[16px] font-bold">Воронка подборок</h3>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Step n={d.funnel.views} label="открыли" />
          <Step n={d.funnel.wants} label="хочу сюда" />
          <Step n={d.funnel.saves} label="сохранили" />
          <Step n={d.funnel.app} label="в приложение" />
        </div>
      </section>

      {perCreator.length > 0 && (
        <section>
          <h3 className="text-[16px] font-bold">Авторы, которые приводят людей</h3>
          <ul className="mt-2 space-y-2">
            {perCreator.map(({ c, n }) => (
              <li key={c.author.id} className="flex items-center gap-3 rounded-[16px] bg-surface p-2.5 shadow-card">
                <CreatorAvatar author={c.author} size={36} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{c.author.name}</span>
                <span className="text-[15px] font-bold text-pink">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.top.length > 0 && (
        <section>
          <h3 className="text-[16px] font-bold">Места, которые хотят чаще всего</h3>
          <ol className="mt-2 space-y-2">
            {d.top.map((i, n) => {
              const p = getPlaceSync(i.place_id);
              return (
                <li key={i.place_id} className="flex items-center gap-3 rounded-[16px] bg-surface p-2.5 shadow-card">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-bold">{n + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{p?.title ?? i.place_id}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                      <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(6, (i.want / maxTop) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-pink">{i.want}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <LocalNote />
    </div>
  );
}

function Act({ children, onClick, tone, disabled }: { children: React.ReactNode; onClick: () => void; tone?: "green" | "pink" | "red"; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold disabled:opacity-40",
        tone === "green" ? "bg-green-50 text-green" : tone === "pink" ? "bg-pink-50 text-pink" : tone === "red" ? "bg-red-50 text-red" : "bg-fill"
      )}
    >
      {children}
    </button>
  );
}

function Stat({ value, label, bg }: { value: number; label: string; bg: string }) {
  return (
    <div className="rounded-[18px] p-3" style={{ background: bg }}>
      <p className="tight text-[26px] font-[850] leading-none">{value}</p>
      <p className="mt-1 text-[12px] leading-tight text-ink-2">{label}</p>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-[16px] bg-surface p-2.5 shadow-card">
      <p className="text-[20px] font-[850] leading-none">{n}</p>
      <p className="mt-1 text-[11.5px] leading-tight text-muted">{label}</p>
    </div>
  );
}
