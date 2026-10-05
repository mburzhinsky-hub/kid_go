import Link from "next/link";
import { Clock, Users, Umbrella, Sun, ThumbsUp, ArrowRight } from "lucide-react";
import type { Plan } from "@/lib/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";

export interface AdventureCardData {
  href: string;
  title: string;
  chain: string;
  cover: Plan["cover"];
  tint: string;
  emoji: string;
  age: string;
  duration: string;
  price?: string;
  indoor: boolean;
  recommend?: number;
  thumbs: { src: string; alt: string; tint: string; emoji: string }[];
  why?: string[];
  explanation?: string;
  /** «25 мин от вас» */
  fromHome?: string;
  /** Округа основных мест маршрута (id или "mo") — чтобы сказать, где это относительно выбранного округа. */
  areas?: string[];
}

export type AreaNote = { text: string; tone: "here" | "near" | "far" };

/**
 * Карточка приключения должна «продавать день»: большое фото, эмоциональный
 * заголовок, цепочка мест миниатюрами и сочный CTA «Хочу так».
 */
export function AdventureCard({
  data,
  variant = "carousel",
  priority,
  note,
}: {
  data: AdventureCardData;
  variant?: "carousel" | "full";
  priority?: boolean;
  /** Где это относительно выбранного округа. */
  note?: AreaNote | null;
}) {
  return (
    <Link
      href={data.href}
      className={cn(
        "press group block shrink-0 snap-start overflow-hidden rounded-[24px] bg-surface shadow-card",
        variant === "carousel" ? "w-[302px]" : "w-full"
      )}
    >
      <div className="relative">
        <SmartImage
          photo={data.cover}
          tint={data.tint}
          emoji={data.emoji}
          sizes={variant === "carousel" ? "320px" : "(max-width: 480px) 100vw, 448px"}
          priority={priority}
          className={variant === "carousel" ? "aspect-[16/11] w-full" : "aspect-[16/10] w-full"}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.55)_100%)]" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/95 px-2.5 text-[12.5px] font-semibold text-ink">
            {data.indoor ? <Umbrella size={13} strokeWidth={2.4} className="text-blue" /> : <Sun size={13} strokeWidth={2.4} className="text-orange" />}
            {data.indoor ? "в помещении" : "на воздухе"}
          </span>
        </div>
        <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-[22px] shadow-card">
          {data.emoji}
        </span>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <h3 className="tight text-[24px] font-[850] leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            {data.title}
          </h3>
          {data.recommend && (
            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-yellow px-2.5 text-[12.5px] font-bold text-ink">
              <ThumbsUp size={13} strokeWidth={2.6} /> {data.recommend}%
            </span>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3.5 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-2.5">
            {data.thumbs.slice(0, 4).map((t, i) => (
              <SmartImage
                key={i}
                photo={t}
                tint={t.tint}
                emoji={t.emoji}
                sizes="40px"
                className="h-9 w-9 rounded-full ring-[2.5px] ring-white"
              />
            ))}
          </div>
          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-tight text-ink-2">{data.chain}</p>
        </div>

        {note && (
          <p className={cn("mt-2 text-[13px] font-semibold leading-snug", note.tone === "here" ? "text-green" : note.tone === "near" ? "text-[#9a6b00]" : "text-red")}>{note.text}</p>
        )}
        {data.explanation && <p className="mt-2.5 text-[13.5px] leading-snug text-muted">{data.explanation}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Meta icon={<Users size={13} strokeWidth={2.4} />} className="bg-purple-50 text-purple">
            {data.age}
          </Meta>
          <Meta icon={<Clock size={13} strokeWidth={2.4} />} className="bg-blue-50 text-blue">
            {data.duration}
          </Meta>
          {data.price && <Meta className="bg-green-50 text-green">{data.price}</Meta>}
          {data.why?.slice(0, variant === "full" ? 3 : 1).map((w) => (
            <Meta key={w} className="bg-yellow-50 text-[#9a6b00]">
              {w}
            </Meta>
          ))}
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          {data.recommend ? (
            <span className="text-[13px] font-medium text-muted">
              <b className="font-bold text-ink">{data.recommend}%</b> родителей рекомендуют
            </span>
          ) : (
            <span className="text-[13px] font-medium text-muted">{data.fromHome ?? "Собрано под вашу семью"}</span>
          )}
          <span className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-pink pl-4 pr-3 text-[15px] font-semibold text-white shadow-pink transition-transform group-active:scale-95">
            Хочу так <ArrowRight size={17} strokeWidth={2.4} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Meta({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold", className)}>
      {icon}
      {children}
    </span>
  );
}
