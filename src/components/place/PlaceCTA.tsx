"use client";

import Link from "next/link";
import { useState } from "react";
import { Navigation, CalendarPlus, Heart, CheckCircle2, ChevronRight } from "lucide-react";
import { IconRocket } from "@/components/icons/brand-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFamily } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { routeUrl } from "@/lib/route-url";


/** Sticky CTA «Хочу сюда!» и шит с действиями. */
export function PlaceCTA({ slug, title, lat, lng }: { slug: string; title: string; lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  const { addToDay, toggleWant, markVisited } = useFamily();
  const want = useFamily((s) => s.wantPlaces.includes(slug));
  const visited = useFamily((s) => s.visitedPlaces.includes(slug));
  const toast = useToast((s) => s.show);

  return (
    <>
      <StickyCTA
        onClick={() => {
          setOpen(true);
          track("place_want_click", { slug });
        }}
        icon={<IconRocket width={24} height={24} />}
      >
        Хочу сюда!
      </StickyCTA>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Отличный выбор! 🎉">
        <p className="-mt-1 text-[15px] text-muted">Что делаем с «{title}»?</p>
        <div className="mt-4 space-y-2.5">
          <SheetAction
            href="/day"
            onClick={() => {
              addToDay([slug]);
              toast("Добавили в наш день 💛");
            }}
            icon={<CalendarPlus size={22} />}
            color="#FF2E88"
            title="Собрать день вокруг этого места"
            hint="Добавим кафе и прогулку рядом"
          />
          <SheetAction
            href={routeUrl(lat, lng)}
            external
            icon={<Navigation size={22} />}
            color="#2F7BFF"
            title="Построить маршрут"
            hint="Откроем в Яндекс Картах"
          />
          <SheetAction
            onClick={() => {
              toggleWant(slug);
              toast(want ? "Убрали из хотелок" : "Сохранили в «Хотим сходить» ❤️");
              setOpen(false);
            }}
            icon={<Heart size={22} className={want ? "fill-current" : ""} />}
            color="#FF3B4E"
            title={want ? "Убрать из «Хотим сходить»" : "Сохранить в «Хотим сходить»"}
          />
          <SheetAction
            onClick={() => {
              markVisited(slug);
              toast("Отметили: уже были ✅");
              setOpen(false);
            }}
            icon={<CheckCircle2 size={22} />}
            color="#1FAE47"
            title={visited ? "Вы уже здесь были" : "Мы здесь уже были"}
            hint={visited ? "Сохранено в «Уже были»" : "Поможет точнее советовать"}
          />
        </div>
      </BottomSheet>
    </>
  );
}

export function StickyCTA({
  children,
  onClick,
  href,
  icon,
  secondary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  const cls =
    "press flex h-[58px] flex-1 items-center justify-center gap-2.5 rounded-full bg-pink text-[19px] font-bold text-white shadow-pink";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-5">
      <div className="flex items-center gap-2.5">
        {secondary}
        {href ? (
          <Link href={href} className={cls} onClick={onClick}>
            {icon}
            {children}
          </Link>
        ) : (
          <button className={cls} onClick={onClick}>
            {icon}
            {children}
          </button>
        )}
      </div>
    </div>
  );
}

function SheetAction({
  href,
  external,
  onClick,
  icon,
  color,
  title,
  hint,
}: {
  href?: string;
  external?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  color: string;
  title: string;
  hint?: string;
}) {
  const inner = (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px]" style={{ background: `${color}1a`, color }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[16px] font-semibold leading-tight">{title}</span>
        {hint && <span className="block text-[13.5px] text-muted">{hint}</span>}
      </span>
      <ChevronRight size={20} className="text-muted-2" />
    </>
  );
  const cls = "press flex w-full items-center gap-3 rounded-[20px] bg-fill-2 p-2.5 ring-1 ring-line";
  if (href && external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  return (
    <button className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
