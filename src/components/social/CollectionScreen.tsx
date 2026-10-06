"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Share2, Map as MapIcon, ArrowRight, Umbrella, Sun, X, Smartphone, Lock, PencilLine } from "lucide-react";
import type { ResolvedCollection } from "@/lib/social/types";
import { coverOf, metaLine, placesOf, placesWord, settingLabel, type PlacedItem } from "@/lib/social/catalog";
import { registerTouch } from "@/lib/social/attribution";
import { trackEvent } from "@/lib/social/events";
import { getUserId } from "@/lib/social/identity";
import { useSocial } from "@/lib/social/store";
import { IntentSourceProvider } from "@/lib/social/intent-source";
import { useSocialUi } from "@/lib/social/ui-store";
import { useAppEnv } from "@/lib/social/app";
import { BackButton } from "@/components/ui/BackButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { RatingBadge, AgeBadge, PriceBadge } from "@/components/ui/badges";
import { TravelBadge } from "@/components/ui/TravelBadge";
import { categoryDef } from "@/lib/catalog";
import { formatAgeRange, placePriceShort } from "@/lib/format";
import { placeHref } from "@/lib/place-href";
import { cn } from "@/lib/cn";
import { CollectionCover } from "./CollectionCover";
import { CreatorAvatar } from "./Avatar";
import { WantButton, InviteFriends } from "./WantButton";
import { useCollectionShare, useToggleSave } from "./CollectionCard";

/**
 * Публичная страница подборки. Работает без регистрации и без приложения: человек из Reels/Telegram/WhatsApp
 * за 1–2 секунды видит обложку, автора и первые места, может «Хочу сюда» и сохранить подборку.
 * Порядок как в продукте: автор → обложка → название и описание → метаданные → действия → места → «Создайте свою» → «Открыть в приложении».
 */
export function CollectionScreen({ resolved, preview = false }: { resolved: ResolvedCollection; preview?: boolean }) {
  const adminState = useSocial((s) => s.adminCollections[resolved.collection.id]);
  const me = useSocial((s) => s.me);
  const hydrated = useSocial((s) => s.hydrated);
  const creatorStatus = useSocial((s) => s.adminCreators[resolved.author.id]?.status);
  const c = adminState?.status ? { ...resolved.collection, status: adminState.status } : resolved.collection;
  const r = useMemo<ResolvedCollection>(() => ({ ...resolved, collection: c }), [resolved, c]);
  const own = hydrated && (r.author.id === me?.id || r.author.id === getUserId());

  if (c.status === "HIDDEN" || (creatorStatus === "SUSPENDED" && !own)) return <Gone kind="hidden" />;
  // черновики и закрытые подборки видит только автор
  if ((c.visibility === "PRIVATE" || c.status === "DRAFT") && !own && !preview) return hydrated ? <Gone kind="private" /> : <PageSkeleton />;
  return <CollectionBody r={r} own={own} preview={preview} />;
}

function PageSkeleton() {
  return (
    <main className="px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="h-11 w-44 rounded-full skeleton" />
      <div className="mt-4 aspect-[4/3] rounded-[28px] skeleton" />
      <div className="mt-5 h-9 w-3/4 rounded-xl skeleton" />
    </main>
  );
}

function CollectionBody({ r, own, preview }: { r: ResolvedCollection; own: boolean; preview: boolean }) {
  const { collection: c, author } = r;
  const { placed, missing } = useMemo(() => placesOf(c), [c]);
  const art = useMemo(() => coverOf(c, placed), [c, placed]);
  const share = useCollectionShare();
  const { saved, toggle } = useToggleSave(r);
  const env = useAppEnv();
  const [barClosed, setBarClosed] = useState(false);
  const showBar = !preview && !env.standalone && !barClosed;
  const ids = { creator_id: author.id, collection_id: c.id };

  /* касание автора + просмотр */
  useEffect(() => {
    if (preview) return;
    registerTouch({ creator_id: author.id, collection_id: c.id, own });
    trackEvent("collection_view", { ...ids, places: placed.length, own });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, preview]);

  /* глубина прокрутки: 25 / 50 / 75 / 100 % */
  useEffect(() => {
    if (preview) return;
    const sent = new Set<number>();
    const onScroll = () => {
      const el = document.documentElement;
      const depth = Math.round(((window.scrollY + window.innerHeight) / Math.max(el.scrollHeight, 1)) * 100);
      for (const t of [25, 50, 75, 100]) {
        if (depth >= t - (t === 100 ? 2 : 0) && !sent.has(t)) {
          sent.add(t);
          trackEvent("collection_scroll", { ...ids, depth: t });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, preview]);

  const mapHref = `/map?${new URLSearchParams({ places: placed.map((x) => x.place.slug).join(","), title: c.title, cr: author.id, col: c.id })}`;
  const profileHref = author.hasPage ? `/@${author.username}/` : undefined;
  const canShare = c.visibility !== "PRIVATE" && c.status === "PUBLISHED";
  const setting = settingLabel(placed);

  return (
    <IntentSourceProvider value={{ source_type: "COLLECTION", source_id: c.id, creator_id: author.id, collection_id: c.id }}>
      <main className={cn(showBar ? "pb-[calc(112px+env(safe-area-inset-bottom))]" : "pb-16")}>
        {/* автор */}
        <header className="flex items-center gap-2.5 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
          {!preview && <BackButton fallback={profileHref ?? "/"} />}
          {profileHref ? (
            <Link href={profileHref} className="press flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-3.5 shadow-card">
              <CreatorAvatar author={author} size={36} />
              <span className="min-w-0 leading-tight">
                <span className="block text-[12px] text-muted">Подборка автора</span>
                <span className="block truncate text-[15px] font-semibold">{author.name}</span>
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-3.5 shadow-card">
              <CreatorAvatar author={author} size={36} />
              <span className="min-w-0 leading-tight">
                <span className="block text-[12px] text-muted">Подборка автора</span>
                <span className="block truncate text-[15px] font-semibold">{author.name}</span>
              </span>
            </div>
          )}
          {canShare && (
            <button onClick={() => share(r)} aria-label="Поделиться подборкой" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-card">
              <Share2 size={20} strokeWidth={2} />
            </button>
          )}
        </header>

        {own && c.visibility === "PRIVATE" && (
          <p className="mx-4 mb-3 flex items-center gap-2 rounded-[16px] bg-fill px-3.5 py-2.5 text-[14px] text-ink-2">
            <Lock size={16} /> Приватная подборка — видите только вы
          </p>
        )}

        {/* обложка */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[28px] shadow-card">
            <CollectionCover art={art} sizes="(max-width: 480px) 100vw, 448px" priority className="aspect-[4/3] w-full" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_55%,rgba(0,0,0,0.38)_100%)]" />
          </div>
        </div>

        <section className="px-4 pt-5">
          <h1 className="tight text-balance text-[30px] font-[850] leading-[1.08]">{c.title}</h1>
          {c.description && <p className="mt-2.5 text-[17px] leading-snug text-ink-2">{c.description}</p>}
          <div className="mt-3.5 flex flex-wrap gap-1.5" aria-label={metaLine(c, placed)}>
            <Chip className="bg-pink-50 text-pink-ink">{placesWord(placed.length)}</Chip>
            <Chip className="bg-yellow-50 text-yellow-ink">{c.city}</Chip>
            <Chip className="bg-purple-50 text-purple-ink">{formatAgeRange(c.age_min, c.age_max)}</Chip>
            {setting && (
              <Chip className="bg-blue-50 text-blue-ink">
                {setting === "На воздухе" ? <Sun size={14} strokeWidth={2.5} /> : <Umbrella size={14} strokeWidth={2.5} />} {setting}
              </Chip>
            )}
          </div>

          {/* действия */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                if (!preview) toggle();
              }}
              aria-pressed={saved}
              className={cn("press inline-flex h-12 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold shadow-card", saved ? "bg-pink-50 text-pink-ink" : "bg-surface text-ink")}
            >
              <Heart size={20} strokeWidth={2} className={cn(saved && "animate-pop fill-pink")} /> {saved ? "Сохранено" : "Сохранить"}
            </button>
            <button
              onClick={() => canShare && share(r)}
              disabled={!canShare}
              className="press inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface text-[15px] font-semibold shadow-card disabled:opacity-50"
            >
              <Share2 size={20} strokeWidth={2} /> Поделиться
            </button>
            <Link
              href={mapHref}
              onClick={() => !preview && trackEvent("collection_map_open", ids)}
              aria-disabled={!placed.length}
              className="press inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface text-[15px] font-semibold shadow-card"
            >
              <MapIcon size={20} strokeWidth={2} /> На карте
            </Link>
          </div>
          {own && !preview && (
            <Link href={`/collections/edit/?id=${encodeURIComponent(c.id)}`} className="press hit relative mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[14px] font-semibold">
              <PencilLine size={16} /> Редактировать подборку
            </Link>
          )}
        </section>

        {/* места */}
        <section className="mt-6 space-y-4 px-4">
          {placed.length === 0 ? (
            <EmptyState art="map" title="В подборке пока нет мест" text="Автор ещё добавляет места. Загляните позже или соберите свою подборку." action={{ href: "/collections/new/", label: "Создать свою подборку" }} />
          ) : (
            placed.map((x, i) => <PlaceStop key={x.item.id} x={x} index={i} r={r} preview={preview} />)
          )}
          {missing > 0 && placed.length > 0 && (
            <p className="rounded-[16px] bg-yellow-50 px-3.5 py-2.5 text-[14px] leading-snug text-yellow-ink">
              {missing === 1 ? "Одно место из подборки больше недоступно" : `${missing} места из подборки больше недоступны`} — мы их не показываем.
            </p>
          )}
        </section>

        {/* «Создайте свою» */}
        {!preview && (
          <section className="mx-4 mt-8 overflow-hidden rounded-[28px] p-5" style={{ background: "linear-gradient(135deg,#FFE9F3,#F4EAFF)" }}>
            <p className="text-[34px] leading-none">💌</p>
            <h2 className="tight mt-2 text-[24px] font-[850] leading-tight">Есть любимые места?</h2>
            <p className="mt-1 text-[16px] leading-snug text-ink-2">Соберите свою подборку и отправьте друзьям — это займёт пару минут.</p>
            <Link
              href="/collections/new/?from=collection_cta"
              className="press mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink"
            >
              Создать свою подборку <ArrowRight size={20} />
            </Link>
          </section>
        )}

        {showBar && <OpenInAppBar ids={ids} onClose={() => setBarClosed(true)} />}
      </main>
    </IntentSourceProvider>
  );
}

const Chip = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[14px] font-semibold", className)}>{children}</span>
);

/** Большая карточка места внутри подборки. */
function PlaceStop({ x, index, r, preview }: { x: PlacedItem; index: number; r: ResolvedCollection; preview: boolean }) {
  const { place, item } = x;
  const cat = categoryDef(place.category);
  const ref = useRef<HTMLElement>(null);
  const ids = { creator_id: r.author.id, collection_id: r.collection.id, place_id: place.slug };

  /* «место попало в экран» — один раз */
  useEffect(() => {
    if (preview || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.55) {
          trackEvent("collection_place_view", { ...ids, position: index + 1 });
          io.disconnect();
        }
      },
      { threshold: [0.55] }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.slug, preview]);

  const open = () => !preview && trackEvent("collection_place_open", { ...ids, position: index + 1 });
  const href = placeHref(place);

  return (
    <article ref={ref} className="overflow-hidden rounded-[24px] bg-surface shadow-card">
      <Link href={href} onClick={open} className="relative block">
        <SmartImage photo={place.photos[0]} tint={place.tint} emoji={place.emoji} sizes="(max-width: 480px) 100vw, 448px" priority={index < 2} className="aspect-[16/10] w-full" />
        <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-[16px] font-[850] shadow-card">{index + 1}</span>
        <span className="absolute bottom-3 left-3 inline-flex h-7 items-center gap-1 rounded-full bg-white/95 px-2.5 text-[13px] font-semibold" style={{ color: cat.ink }}>
          <cat.Icon width={13} height={13} /> {cat.name}
        </span>
      </Link>
      <div className="px-4 pb-4 pt-3.5">
        <Link href={href} onClick={open}>
          <h2 className="tight text-[22px] font-[850] leading-[1.12]">{place.title}</h2>
        </Link>
        <p className="mt-0.5 line-clamp-2 text-[15px] text-muted">{place.subtitle}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <RatingBadge rating={place.rating} count={place.review_count} className="text-[14px]" />
          <TravelBadge place={place} className="text-[14px]" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <PriceBadge>{placePriceShort(place)}</PriceBadge>
          <AgeBadge>{formatAgeRange(place.age_min, place.age_max)}</AgeBadge>
          <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold", place.indoor && !place.outdoor ? "bg-blue-50 text-blue-ink" : place.outdoor && !place.indoor ? "bg-orange-50 text-orange-ink" : "bg-yellow-50 text-yellow-ink")}>
            {place.outdoor && !place.indoor ? <Sun size={14} strokeWidth={2.5} /> : <Umbrella size={14} strokeWidth={2.5} />}
            {place.indoor && !place.outdoor ? "в помещении" : place.outdoor && !place.indoor ? "на воздухе" : "и там, и там"}
          </span>
        </div>

        {item.creator_note && (
          <div className="mt-3.5 flex gap-2.5 rounded-[20px] bg-fill-2 p-3 ring-1 ring-line">
            <CreatorAvatar author={r.author} size={30} className="mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-pink-ink">Комментарий автора</p>
              <p className="mt-0.5 text-[15px] leading-snug text-ink-2">{item.creator_note}</p>
            </div>
          </div>
        )}

        <WantButton slug={place.slug} className="mt-3.5 w-full" />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3">
          <Link href={href} onClick={open} className="press inline-flex h-11 items-center gap-1.5 text-[16px] font-semibold text-blue-ink">
            Посмотреть место <ArrowRight size={20} strokeWidth={2} />
          </Link>
          <InviteFriends place={place} />
        </div>
      </div>
    </article>
  );
}

/** Нижняя плашка «Открыть в приложении»: не закрывает контент (у страницы есть нижний отступ) и закрывается крестиком. */
function OpenInAppBar({ ids, onClose }: { ids: { creator_id: string; collection_id: string }; onClose: () => void }) {
  const openInstall = useSocialUi((s) => s.openInstall);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 rounded-[24px] bg-surface p-2.5 pl-3 shadow-float ring-1 ring-line animate-rise">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/icon-192.png`} alt="" width={44} height={44} className="hidden h-10 w-10 shrink-0 rounded-[12px] min-[380px]:block" />
        <button
          onClick={() => {
            trackEvent("collection_app_open_click", ids);
            openInstall(location.href, ids);
          }}
          className="press inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-pink px-3.5 text-[15px] font-bold text-white shadow-pink"
        >
          <Smartphone size={20} className="shrink-0" /> <span className="truncate">Открыть в приложении</span>
        </button>
        <button onClick={onClose} aria-label="Скрыть" className="press hit relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

/** Подборки, которых нет: удалена автором, закрыта, ссылка повреждена. */
export function Gone({ kind }: { kind: "hidden" | "private" | "broken" | "missing" }) {
  const copy = {
    hidden: { art: "error" as const, title: "Подборку убрали", text: "Автор или модерация скрыли эту подборку. Посмотрите, что собрали другие родители." },
    private: { art: "heart" as const, title: "Подборка закрыта автором", text: "Её видит только автор. Попросите прислать открытую ссылку — или соберите свою." },
    broken: { art: "offline" as const, title: "Не получилось открыть ссылку", text: "Похоже, ссылка обрезалась при пересылке. Попросите прислать её ещё раз — или соберите свою подборку." },
    missing: { art: "search" as const, title: "Такой подборки нет", text: "Возможно, ссылка устарела. Давайте найдём что-нибудь классное!" },
  }[kind];
  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-10">
      <div>
        <div className="mb-2 px-1 pt-[max(14px,env(safe-area-inset-top))]">
          <BackButton fallback="/" />
        </div>
        <EmptyState art={copy.art} title={copy.title} text={copy.text} action={{ href: "/", label: "На главную" }} secondary={
          <Link href="/collections/new/" className="press mt-3 inline-flex h-12 items-center rounded-full bg-pink-50 px-5 text-[16px] font-semibold text-pink-ink">
            Создать свою подборку
          </Link>
        } />
      </div>
    </main>
  );
}
