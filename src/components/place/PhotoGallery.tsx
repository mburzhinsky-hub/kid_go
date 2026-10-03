"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share, X } from "lucide-react";
import type { Photo } from "@/lib/types";
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
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar flex h-[340px] snap-x snap-mandatory overflow-x-auto rounded-b-[30px]">
        {photos.map((p, i) => (
          <button key={i} onClick={() => setOpen(i)} className="relative h-full w-full shrink-0 snap-center" aria-label={`Фото ${i + 1}: ${p.alt}`}>
            <SmartImage photo={p} tint={tint} emoji={emoji} sizes="(max-width: 480px) 100vw, 480px" priority={i === 0} quality={75} className="absolute inset-0" />
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-none bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-4 top-[max(14px,env(safe-area-inset-top))] flex items-center justify-between">
        <BackButton onClick={() => (history.length > 1 ? router.back() : router.push("/"))} />
        <div className="flex gap-2.5">
          {favoriteSlug && <FavoriteButton slug={favoriteSlug} variant="overlay" />}
          <ShareButton title={shareTitle} />
        </div>
      </div>
      {rating != null && <RatingBadge rating={rating} count={count} tone="pill" className="absolute bottom-4 left-4" />}
      <span className="absolute bottom-4 right-4 inline-flex h-9 items-center rounded-full bg-black/45 px-3.5 text-[15px] font-semibold text-white">
        {index + 1}/{photos.length}
      </span>
      {open !== null && <Lightbox photos={photos} start={open} tint={tint} emoji={emoji} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function BackButton({ onClick, light }: { onClick?: () => void; light?: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={onClick ?? (() => (history.length > 1 ? router.back() : router.push("/")))}
      aria-label="Назад"
      className={light ? "press grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-card" : "press grid h-11 w-11 place-items-center rounded-full bg-black/35 text-white"}
    >
      <ArrowLeft size={24} strokeWidth={2.2} />
    </button>
  );
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
      <Share size={21} strokeWidth={2.2} />
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
      <div className="grid grid-cols-[1.45fr_1fr_1fr_1fr] gap-2">
        {thumbs.map((p, i) => (
          <button key={i} onClick={() => setOpen(i + 1)} className="press relative h-[84px] overflow-hidden rounded-[14px]" aria-label={`Открыть фото: ${p.alt}`}>
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
        <button onClick={onClose} aria-label="Закрыть" className="press grid h-10 w-10 place-items-center rounded-full bg-white/15">
          <X size={22} />
        </button>
      </div>
      <div ref={ref} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto">
        {photos.map((p, k) => (
          <div key={k} className="relative h-full w-full shrink-0 snap-center">
            <SmartImage photo={p} tint={tint} emoji={emoji} sizes="480px" className="absolute inset-x-0 top-1/2 aspect-[4/3] -translate-y-1/2" imgClassName="object-contain" />
          </div>
        ))}
      </div>
      <p className="px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 text-center text-[14px] text-white/80">{photos[i]?.alt}</p>
    </div>
  );
}
