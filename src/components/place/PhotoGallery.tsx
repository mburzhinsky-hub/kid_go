"use client";

import { useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";
import { BackButton as SharedBackButton } from "@/components/ui/BackButton";
import type { Photo, PhotoCredit } from "@/lib/types";
import { cn } from "@/lib/cn";
import { SmartImage } from "@/components/ui/SmartImage";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { RatingBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/Toast";

/** Большая фотогалерея-герой: свайп, счётчик «1/10», кнопки поверх фото. */
export function HeroGallery({
  photos,
  tint,
  emoji,
  rating,
  count,
  favoriteSlug,
  shareTitle,
}: {
  photos: Photo[];
  tint: string;
  emoji: string;
  rating?: number;
  count?: number;
  favoriteSlug?: string;
  shareTitle: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar flex h-[340px] [@media(max-height:760px)]:h-[260px] snap-x snap-mandatory overflow-x-auto rounded-b-[30px]">
        {photos.map((p, i) =>
          p.src ? (
            <button key={i} onClick={() => setOpen(i)} className="relative h-full w-full shrink-0 snap-center" aria-label={`Фото ${i + 1}: ${p.alt}`}>
              <SmartImage photo={p} tint={tint} emoji={emoji} sizes="(max-width: 480px) 100vw, 480px" priority={i === 0} quality={75} className="absolute inset-0" />
            </button>
          ) : (
            <div key={i} className="relative h-full w-full shrink-0 snap-center">
              <SmartImage photo={p} tint={tint} emoji={emoji} sizes="(max-width: 480px) 100vw, 480px" className="absolute inset-0" />
            </div>
          ),
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-none bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-4 top-[max(14px,env(safe-area-inset-top))] flex items-center justify-between">
        <BackButton />
        <div className="flex gap-2.5">
          {favoriteSlug && <FavoriteButton slug={favoriteSlug} variant="overlay" />}
          <ShareButton title={shareTitle} />
        </div>
      </div>
      {rating != null && rating > 0 && <RatingBadge rating={rating} count={count && count > 0 ? count : undefined} tone="pill" className="absolute bottom-4 left-4" />}
      {photos.length > 1 && (
        <span className="absolute bottom-4 right-4 inline-flex h-9 items-center rounded-full bg-black/45 px-3.5 text-[15px] font-semibold text-white">
          {index + 1}/{photos.length}
        </span>
      )}
      {open !== null && <Lightbox photos={photos} start={open} tint={tint} emoji={emoji} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function BackButton({ onClick, light }: { onClick?: () => void; light?: boolean }) {
  return <SharedBackButton tone={light ? "light" : "photo"} onClick={onClick} />;
}

export function ShareButton({ title, light }: { title: string; light?: boolean }) {
  const toast = useToast((s) => s.show);
  return (
    <button
      aria-label="Поделиться"
      onClick={async () => {
        const data = { title, url: location.href };
        try {
          if (navigator.share) await navigator.share(data);
          else {
            await navigator.clipboard.writeText(location.href);
            toast("Ссылка скопирована 💌");
          }
        } catch {
          /* пользователь закрыл шит */
        }
      }}
      className={light ? "press grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-card" : "press grid h-11 w-11 place-items-center rounded-full bg-black/35 text-white"}
    >
      <Share size={20} strokeWidth={2} />
    </button>
  );
}

/** Сетка миниатюр под описанием: 4 фото, на последней — «+N». */
export function PhotoGallery({ photos, tint, emoji }: { photos: Photo[]; tint: string; emoji: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const thumbs = photos.slice(1, 5);
  const rest = photos.length - 5;
  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          thumbs.length >= 4 ? "grid-cols-[1.45fr_1fr_1fr_1fr]" : thumbs.length === 3 ? "grid-cols-3" : thumbs.length === 2 ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {thumbs.map((p, i) => (
          <button key={i} onClick={() => setOpen(i + 1)} className={cn("press relative overflow-hidden rounded-[12px]", thumbs.length >= 3 ? "h-[84px]" : "h-[116px]")} aria-label={`Открыть фото: ${p.alt}`}>
            <SmartImage photo={p} tint={tint} emoji={emoji} sizes="140px" className="absolute inset-0" />
            {i === thumbs.length - 1 && rest > 0 && (
              <span className="absolute inset-0 grid place-items-center bg-black/45 text-[22px] font-semibold text-white">+{rest}</span>
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox photos={photos} start={open} tint={tint} emoji={emoji} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ photos, start, tint, emoji, onClose }: { photos: Photo[]; start: number; tint: string; emoji: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const on = () => el && setI(Math.round(el.scrollLeft / el.clientWidth));
    el?.addEventListener("scroll", on, { passive: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", key);
    return () => {
      el?.removeEventListener("scroll", on);
      document.removeEventListener("keydown", key);
    };
  }, [start]);
  return (
    <div className="fixed inset-0 z-[90] mx-auto flex max-w-[480px] flex-col bg-black animate-fade" role="dialog" aria-modal="true" aria-label="Фотографии">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))] text-white">
        <span className="text-[15px] font-semibold">
          {i + 1} / {photos.length}
        </span>
        <button onClick={onClose} aria-label="Закрыть" className="press hit relative grid h-10 w-10 place-items-center rounded-full bg-white/15">
          <X size={24} />
        </button>
      </div>
      <div ref={ref} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto">
        {photos.map((p, k) => (
          <div key={k} className="relative h-full w-full shrink-0 snap-center">
            <SmartImage photo={p} tint={tint} emoji={emoji} sizes="480px" className="absolute inset-x-0 top-1/2 aspect-[4/3] -translate-y-1/2" imgClassName="object-contain" />
          </div>
        ))}
      </div>
      <div className="px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 text-center text-white/80">
        <p className="text-[14px]">{photos[i]?.alt}</p>
        {photos[i]?.credit && <p className="mt-1 text-[12px] text-white/60"><CreditLine credit={photos[i].credit!} /></p>}
      </div>
    </div>
  );
}

const extProps = { target: "_blank", rel: "noopener noreferrer" } as const;

/** «Автор, лицензия»: обе части ссылки (страница снимка и текст лицензии). */
function CreditLine({ credit }: { credit: PhotoCredit }) {
  return (
    <>
      <a href={credit.url} {...extProps} className="underline underline-offset-2">
        {credit.author}
      </a>
      ,{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} {...extProps} className="underline underline-offset-2">
          {credit.license}
        </a>
      ) : (
        <span>{credit.license === "Public domain" ? "общественное достояние" : credit.license}</span>
      )}
    </>
  );
}

/** Авторы снимков под галереей: условие свободных лицензий (CC BY, CC BY-SA). Если снимков нет — ничего не показываем. */
export function PhotoCredits({ photos }: { photos: Photo[] }) {
  const seen = new Set<string>();
  const credits = photos.flatMap((p) => {
    const c = p.credit;
    if (!c) return [];
    const key = `${c.author}|${c.license}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [c];
  });
  if (!credits.length) return null;
  return (
    <p className="mt-3 break-words text-[12px] leading-snug text-muted">
      Фото:{" "}
      {credits.map((c, i) => (
        <span key={i}>
          {i > 0 && "; "}
          <CreditLine credit={c} />
        </span>
      ))}
      . Wikimedia Commons, снимки уменьшены и обрезаны.
    </p>
  );
}
