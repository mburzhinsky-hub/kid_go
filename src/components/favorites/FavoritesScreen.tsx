"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Plus, Smartphone, Trash2 } from "lucide-react";
import { useFamily } from "@/lib/store";
import { getPlaceSync, allAdventures } from "@/lib/data/repository";
import { useResolveDynamic } from "@/lib/nearby";
import { adventureCardData } from "@/lib/cards";
import { PlaceRow } from "@/components/cards/PlaceCard";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabBackButton } from "@/components/ui/BackButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { haversineKm, pt } from "@/lib/geo";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useSocial } from "@/lib/social/store";
import { useCollectionLookup, usePublicCollections, useSavedCollections } from "@/lib/social/repo";
import { IntentSourceProvider } from "@/lib/social/intent-source";
import { useSocialUi } from "@/lib/social/ui-store";
import { CollectionCard, collectionHref } from "@/components/social/CollectionCard";
import { FeedbackRow, InviteFriends } from "@/components/social/WantButton";

type Tab = "want" | "collections" | "plans" | "visited";

export function FavoritesScreen({ initialTab = "want" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const s = useFamily();
  const savedCollections = useSavedCollections();
  const socialReady = useSocial((x) => x.hydrated);
  const lookup = useCollectionLookup();
  const example = usePublicCollections({ limit: 1 })[0];
  const tabsRef = useRef<HTMLDivElement>(null);
  useResolveDynamic([...s.wantPlaces, ...s.visitedPlaces, ...s.day]); // места рядом (OSM), которых нет в кэше
  const want = s.wantPlaces.map(getPlaceSync).filter(Boolean) as Place[];
  const visited = s.visitedPlaces.map(getPlaceSync).filter(Boolean) as Place[];
  const dayPlaces = s.day.map(getPlaceSync).filter(Boolean) as Place[];

  /** «Собрать день из хотелок»: берём первое место и добавляем ближайшие к нему хотелки. */
  const wishDay = useMemo(() => {
    if (want.length < 2) return null;
    const [first, ...rest] = want.filter((p) => p.category !== "shop");
    if (!first) return null;
    const near = rest.map((p) => ({ p, km: haversineKm(pt(first), pt(p)) })).filter((x) => x.km < 6).sort((a, b) => a.km - b.km);
    const steps = [first, ...near.slice(0, 2).map((x) => x.p)];
    return steps.length >= 2 ? `/day?${new URLSearchParams({ steps: steps.map((p) => p.slug).join(","), title: "День из хотелок", emoji: "❤️" })}` : null;
  }, [want]);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "want", label: "Хочу сходить", count: want.length },
    { id: "collections", label: "Подборки", count: savedCollections.length },
    { id: "plans", label: "Приключения", count: s.savedPlans.length },
    { id: "visited", label: "Уже были", count: visited.length },
  ];

  // активная вкладка всегда в зоне видимости, даже если пришли сразу на «Уже были»
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);
  const hasAnything = want.length + visited.length + savedCollections.length > 0;

  return (
    <main className="pb-28">
      <header className="px-4 pb-2 pt-[max(18px,env(safe-area-inset-top))]">
        <TabBackButton className="mb-2" />
        <h1 className="tight text-[30px] font-[850] leading-tight">Наши хотелки ❤️</h1>
        <p className="mt-0.5 text-[16px] text-muted">Всё, куда хочется — в одном месте</p>
      </header>

      {s.hydrated && dayPlaces.length > 0 && (
        <Link href="/day" className="press mx-4 mt-2 flex items-center gap-3 rounded-[24px] bg-ink p-3 text-white">
          <div className="flex -space-x-3">
            {dayPlaces.slice(0, 3).map((p) => (
              <SmartImage key={p.id} photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="44px" className="h-11 w-11 rounded-full ring-[3px] ring-ink" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold leading-tight">Наш день · {dayPlaces.length} {dayPlaces.length === 1 ? "место" : dayPlaces.length < 5 ? "места" : "мест"}</p>
            <p className="truncate text-[13px] text-white/70">{dayPlaces.map((p) => p.title).join(" → ")}</p>
          </div>
          <ArrowRight size={20} />
        </Link>
      )}

      <div className="sticky top-0 z-20 bg-bg/95 px-4 pb-2 pt-3">
        <div ref={tabsRef} className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-fill p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn("press hit relative h-10 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold transition-all", tab === t.id ? "bg-white text-ink shadow-card" : "text-muted")}
            >
              {t.label}
              {s.hydrated && socialReady && t.count > 0 && <span className={cn("ml-1", tab === t.id ? "text-pink-ink" : "")}>{t.count}</span>}
            </button>
          ))}
          <span aria-hidden className="w-1 shrink-0" />
        </div>
      </div>

      {!s.hydrated ? (
        <div className="space-y-2.5 px-4 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[112px] rounded-[20px] skeleton" />
          ))}
        </div>
      ) : (
        <div key={tab} className="px-4 pt-2 animate-rise">
          {tab === "want" &&
            (want.length ? (
              <>
                {wishDay && (
                  <Link href={wishDay} className="press mb-3 flex items-center gap-3 rounded-[20px] p-3.5" style={{ background: "linear-gradient(120deg,#FFE9F3,#F4EAFF)" }}>
                    <span className="text-[28px]">🪄</span>
                    <span className="flex-1">
                      <span className="block text-[16px] font-bold">Собрать день из хотелок</span>
                      <span className="block text-[13px] text-ink-2">Соединим близкие места в маршрут</span>
                    </span>
                    <ArrowRight size={20} className="text-pink-ink" />
                  </Link>
                )}
                <div className="space-y-2.5">
                  {want.map((p) => {
                    const it = s.intents[p.slug];
                    const col = lookup(it?.collection_id);
                    return (
                      <IntentSourceProvider key={p.id} value={{ source_type: "PLACE", creator_id: it?.creator_id, collection_id: it?.collection_id }}>
                        <PlaceRow
                          place={p}
                          aside={
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                s.markVisited(p.slug);
                              }}
                              aria-label="Уже были"
                              className="press hit relative grid h-9 w-9 place-items-center rounded-full bg-green-50 text-green-ink"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          }
                          footer={
                            <div className="flex items-center gap-2">
                              {col ? (
                                <Link href={collectionHref(col)} className="press min-w-0 flex-1 truncate rounded-full bg-purple-50 px-3 py-2 text-[13px] font-semibold text-purple-ink">
                                  Из подборки «{col.collection.title}»
                                </Link>
                              ) : it?.collection_id ? (
                                <span className="min-w-0 flex-1 truncate rounded-full bg-purple-50 px-3 py-2 text-[13px] font-semibold text-purple-ink">Из подборки</span>
                              ) : (
                                <span className="flex-1" />
                              )}
                              <InviteFriends place={p} always short className="shrink-0" />
                            </div>
                          }
                        />
                      </IntentSourceProvider>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState art="heart" title="Пока пусто" text="Нажимайте «Хочу сюда» на карточках мест — они появятся здесь." action={{ href: "/", label: "Смотреть места" }} />
            ))}

          {tab === "collections" && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Link href="/collections/" className="press flex h-12 items-center justify-center rounded-full bg-fill text-[15px] font-semibold">
                  Мои подборки
                </Link>
                <Link href="/collections/new/?from=favorites" className="press inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-pink text-[15px] font-bold text-white shadow-pink">
                  <Plus size={20} strokeWidth={2.5} /> Создать
                </Link>
              </div>
              {!socialReady ? (
                <div className="h-[260px] rounded-[24px] skeleton" />
              ) : savedCollections.length ? (
                <div className="space-y-4">
                  {savedCollections.map((r) => (
                    <CollectionCard key={r.collection.id} data={r} variant="full" />
                  ))}
                </div>
              ) : (
                <EmptyState
                  art="plan"
                  title="Сохранённых подборок нет"
                  text="Нажмите ♡ на подборке другого родителя — она останется здесь. Или соберите свою и отправьте друзьям."
                  action={example ? { href: collectionHref(example), label: "Посмотреть пример" } : { href: "/collections/new/", label: "Создать подборку" }}
                />
              )}
            </>
          )}

          {tab === "plans" &&
            (s.savedPlans.length ? (
              <div className="space-y-4">
                {s.savedPlans.map((sp) => {
                  const a = allAdventures.find((x) => x.slug === sp.key);
                  if (a) return <AdventureCard key={sp.key} data={adventureCardData(a)} variant="full" />;
                  const places = (sp.steps ?? []).map(getPlaceSync).filter(Boolean) as Place[];
                  return (
                    <div key={sp.key} className="flex items-center gap-3 rounded-[24px] bg-surface p-3 shadow-card">
                      <Link
                        href={sp.key === "our-day" ? "/day" : `/day?${new URLSearchParams({ steps: places.map((p) => p.slug).join(","), title: sp.title, emoji: sp.emoji })}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-pink-50 text-[28px]">{sp.emoji}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[16px] font-bold">{sp.title}</span>
                          <span className="block truncate text-[13px] text-muted">{places.map((p) => p.title).join(" → ")}</span>
                        </span>
                      </Link>
                      <button onClick={() => s.toggleSavedPlan(sp)} aria-label="Удалить" className="press hit relative grid h-9 w-9 place-items-center rounded-full bg-fill text-muted">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                art="plan"
                title="Сохранённых приключений нет"
                text="Сохраняйте готовые дни сердечком — и возвращайтесь к ним в выходные."
                action={{ href: "/adventures", label: "Выбрать приключение" }}
              />
            ))}

          {tab === "visited" &&
            (visited.length ? (
              <div className="space-y-2.5">
                {visited.map((p) => (
                  <PlaceRow key={p.id} place={p} aside={<span className="rounded-full bg-green-50 px-2 py-1 text-[12px] font-bold text-green-ink">были ✓</span>} footer={<FeedbackRow slug={p.slug} compact />} />
                ))}
                <p className="pt-2 text-center text-[13px] text-muted">Учитываем это в рекомендациях — чтобы предлагать новое</p>
              </div>
            ) : (
              <EmptyState art="map" title="Отмечайте, где уже были" text="Так мы будем предлагать только новое и интересное." />
            ))}
        </div>
      )}

      {s.hydrated && socialReady && hasAnything && (
        <button onClick={() => useSocialUi.getState().openTransfer()} className="press mx-4 mt-6 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[20px] bg-fill-2 p-3.5 text-left ring-1 ring-line">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-blue-ink shadow-card">
            <Smartphone size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Перенести на другое устройство</span>
            <span className="block text-[13px] leading-snug text-muted">Например, из браузера в приложение на «Домой»</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-muted" />
        </button>
      )}
    </main>
  );
}
