"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Share2, UserPlus, Check, ArrowRight } from "lucide-react";
import type { CreatorProfile, ResolvedCollection } from "@/lib/social/types";
import { authorOf, placesOf, coverOf } from "@/lib/social/catalog";
import { plural } from "@/lib/format";
import { usePublicCollections, useFollowing, toggleFollow, useCreatorStatus } from "@/lib/social/repo";
import { registerTouch } from "@/lib/social/attribution";
import { trackEvent } from "@/lib/social/events";
import { creatorUrl } from "@/lib/social/share";
import { useSocialUi } from "@/lib/social/ui-store";
import { useSocial } from "@/lib/social/store";
import { IntentSourceProvider } from "@/lib/social/intent-source";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { CreatorAvatar, CreatorBadge } from "./Avatar";
import { CollectionCard } from "./CollectionCard";
import { cn } from "@/lib/cn";

/** Публичная страница автора: аватар, имя, ник, о себе, статистика и подборки сильными фото-карточками. */
export function CreatorScreen({ creator }: { creator: CreatorProfile }) {
  const author = useMemo(() => authorOf(creator), [creator]);
  const collections = usePublicCollections({ creatorId: creator.user_id });
  const status = useCreatorStatus(creator.user_id, creator.status);
  const featured = useSocial((s) => s.adminCreators[creator.user_id]?.featured ?? creator.featured);
  const following = useFollowing(creator.user_id);
  const openShare = useSocialUi((s) => s.openShare);
  const toast = useToast((s) => s.show);

  useEffect(() => {
    registerTouch({ creator_id: creator.user_id });
    trackEvent("creator_profile_view", { creator_id: creator.user_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator.user_id]);

  const placeCount = useMemo(() => new Set(collections.flatMap((r) => placesOf(r.collection).placed.map((x) => x.place.slug))).size, [collections]);
  const first = collections[0];

  const share = () => {
    const art = first ? coverOf(first.collection, placesOf(first.collection).placed) : undefined;
    openShare({
      kind: "creator",
      heading: "Поделиться страницей автора",
      text: `${creator.display_name} — подборки мест для детей`,
      buildUrl: (utm) => creatorUrl(creator.username, utm),
      preview: { tile: art ? (art.kind === "photo" ? art.tile : art.tiles[0]) : undefined, title: creator.display_name, subtitle: `@${creator.username}` },
      ids: { creator_id: creator.user_id },
    });
  };

  if (status !== "APPROVED") {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <EmptyState art="error" title="Страница автора недоступна" text="Автор скрыт или ещё не прошёл проверку." action={{ href: "/", label: "На главную" }} />
      </main>
    );
  }

  return (
    <IntentSourceProvider value={{ source_type: "CREATOR", source_id: creator.user_id, creator_id: creator.user_id }}>
      <main className="pb-16">
        <header className="flex items-center justify-between px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
          <BackButton fallback="/" />
          <button onClick={share} aria-label="Поделиться страницей автора" className="press grid h-11 w-11 place-items-center rounded-full bg-surface shadow-card">
            <Share2 size={20} strokeWidth={2} />
          </button>
        </header>

        <section className="px-4 pt-3">
          <div className="rounded-[28px] bg-surface p-5 text-center shadow-card">
            <CreatorAvatar author={author} size={96} ring className="mx-auto" />
            <h1 className="tight mt-3 text-[30px] font-[850] leading-[1.08]">{creator.display_name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-[15px] text-muted">
              <span className="whitespace-nowrap">@{creator.username}</span>
              <CreatorBadge label="Автор подборок" className={cn("whitespace-nowrap", featured && "bg-pink-50 text-pink-ink")} />
            </p>
            {creator.bio && <p className="mt-3 text-[16px] leading-snug text-ink-2">{creator.bio}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat value={collections.length} label={plural(collections.length, "подборка", "подборки", "подборок")} bg="#FFE4F1" />
              <Stat value={placeCount} label={plural(placeCount, "место", "места", "мест")} bg="#E2EEFF" />
            </div>
            <button
              onClick={() => {
                toggleFollow(author);
                toast(following ? "Вы отписались" : `Вы подписаны: ${creator.display_name}`);
              }}
              aria-pressed={following}
              className={cn("press mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold", following ? "bg-fill text-ink" : "bg-pink text-white shadow-pink")}
            >
              {following ? <Check size={20} /> : <UserPlus size={20} />} {following ? "Вы подписаны" : "Подписаться"}
            </button>
          </div>
        </section>

        {collections.length === 0 ? (
          <EmptyState art="plan" title="Пока нет публичных подборок" text="Автор ещё готовит первую. Загляните позже." />
        ) : (
          <>
            {first && (
              <section className="mt-7 px-4">
                <h2 className="tight text-[24px] font-[800]">Избранное</h2>
                <div className="mt-3">
                  <CollectionCard data={first} variant="full" priority />
                </div>
              </section>
            )}
            {collections.length > 1 && (
              <section className="mt-8 px-4">
                <h2 className="tight text-[24px] font-[800]">Все подборки</h2>
                <div className="mt-3 space-y-4">
                  {collections.slice(1).map((r: ResolvedCollection) => (
                    <CollectionCard key={r.collection.id} data={r} variant="full" />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mx-4 mt-9 overflow-hidden rounded-[28px] p-5" style={{ background: "linear-gradient(135deg,#FFE9F3,#F4EAFF)" }}>
          <p className="text-[34px] leading-none">💌</p>
          <h2 className="tight mt-2 text-[24px] font-[850] leading-tight">Есть любимые места?</h2>
          <p className="mt-1 text-[16px] leading-snug text-ink-2">Соберите свою подборку и отправьте друзьям.</p>
          <Link
            href="/collections/new/?from=creator_cta"
            className="press mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink"
          >
            Создать свою подборку <ArrowRight size={20} />
          </Link>
        </section>
      </main>
    </IntentSourceProvider>
  );
}

function Stat({ value, label, bg }: { value: number; label: string; bg: string }) {
  return (
    <div className="rounded-[20px] px-3 py-3" style={{ background: bg }}>
      <p className="tight text-[24px] font-[850] leading-none">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-ink-2">{label}</p>
    </div>
  );
}
