"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Heart, Share2, ArrowRight, Umbrella, Sun, Users } from "lucide-react";
import type { ResolvedCollection } from "@/lib/social/types";
import { placesOf, coverOf, placesWord, settingLabel, freePlaces } from "@/lib/social/catalog";
import { collectionPath, collectionShareText, collectionUrl } from "@/lib/social/share";
import { saveCollection, unsaveCollection, useIsSaved } from "@/lib/social/repo";
import { useSocialUi } from "@/lib/social/ui-store";
import { useToast } from "@/components/ui/Toast";
import { CollectionCover } from "./CollectionCover";
import { CreatorAvatar, CreatorBadge } from "./Avatar";
import { formatAgeRange } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Ссылка внутри приложения на страницу подборки. */
export const collectionHref = (r: ResolvedCollection) => (r.source === "local" ? `/c/?id=${encodeURIComponent(r.collection.id)}` : collectionPath(r));

export function useCollectionShare() {
  const openShare = useSocialUi((s) => s.openShare);
  return (r: ResolvedCollection) => {
    const { placed } = placesOf(r.collection);
    const art = coverOf(r.collection, placed);
    openShare({
      kind: "collection",
      heading: "Поделиться подборкой",
      text: collectionShareText(r),
      buildUrl: (utm) => collectionUrl(r, utm),
      preview: { tile: art.kind === "photo" ? art.tile : art.tiles[0], title: r.collection.title, subtitle: `Подборка ${r.author.name} · ${placesWord(placed.length)}` },
      ids: { creator_id: r.author.id, collection_id: r.collection.id },
    });
  };
}

export function useToggleSave(r: ResolvedCollection) {
  const saved = useIsSaved(r.collection.id);
  const toast = useToast((s) => s.show);
  return {
    saved,
    toggle: () => {
      if (saved) {
        unsaveCollection(r);
        toast("Убрали из «Подборок»");
      } else {
        saveCollection(r, "card");
        toast("Подборка сохранена ❤️", { label: "Смотреть", href: "/favorites?tab=collections" });
      }
    },
  };
}

/**
 * Карточка подборки в стиле карточки приключения: большое фото, заголовок поверх, под ним — автор и чипы.
 * Сердечко сохраняет подборку в «Избранное → Подборки», рядом — «Поделиться».
 */
export function CollectionCard({ data, variant = "carousel", priority }: { data: ResolvedCollection; variant?: "carousel" | "full"; priority?: boolean }) {
  const { collection: c, author } = data;
  const { placed } = useMemo(() => placesOf(c), [c]);
  const art = useMemo(() => coverOf(c, placed), [c, placed]);
  const { saved, toggle } = useToggleSave(data);
  const share = useCollectionShare();
  const setting = settingLabel(placed);
  const free = freePlaces(placed);

  return (
    <div className={cn("group relative shrink-0 snap-start overflow-hidden rounded-[24px] bg-surface shadow-card", variant === "carousel" ? "w-[302px]" : "w-full")}>
      <Link href={collectionHref(data)} aria-label={c.title} className="press block">
        <div className="relative">
          <CollectionCover art={art} sizes={variant === "carousel" ? "320px" : "(max-width: 480px) 100vw, 448px"} priority={priority} className={variant === "carousel" ? "aspect-[16/11] w-full" : "aspect-[16/10] w-full"} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,0.62)_100%)]" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="inline-flex h-7 items-center rounded-full bg-white/95 px-2.5 text-[13px] font-semibold text-ink">{placesWord(placed.length)}</span>
          </div>
          <h3 className="tight absolute inset-x-3 bottom-3 line-clamp-3 text-[22px] font-[850] leading-[1.08] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">{c.title}</h3>
        </div>
        <div className="px-3.5 pb-3.5 pt-3">
          <div className="flex items-center gap-2.5">
            <CreatorAvatar author={author} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight">{author.name}</p>
              <p className="text-[13px] leading-tight text-muted">Автор подборки</p>
            </div>
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink text-white shadow-pink">
              <ArrowRight size={20} strokeWidth={2.5} />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Meta className="bg-purple-50 text-purple-ink" icon={<Users size={14} strokeWidth={2.5} />}>
              {formatAgeRange(c.age_min, c.age_max)}
            </Meta>
            {setting && (
              <Meta className="bg-blue-50 text-blue-ink" icon={setting === "На воздухе" ? <Sun size={14} strokeWidth={2.5} /> : <Umbrella size={14} strokeWidth={2.5} />}>
                {setting.toLowerCase()}
              </Meta>
            )}
            {free > 0 && free === placed.length && <Meta className="bg-green-50 text-green-ink">бесплатно</Meta>}
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          type="button"
          aria-label="Поделиться подборкой"
          onClick={() => share(data)}
          className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-card"
        >
          <Share2 size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={saved ? "Убрать подборку из сохранённых" : "Сохранить подборку"}
          aria-pressed={saved}
          onClick={toggle}
          className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-card"
        >
          <Heart size={20} strokeWidth={2} className={cn(saved && "animate-pop fill-pink text-pink")} />
        </button>
      </div>
    </div>
  );
}

function Meta({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold", className)}>
      {icon}
      {children}
    </span>
  );
}

export { CreatorBadge };
