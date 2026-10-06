import { Star, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

export function RatingBadge({
  rating,
  count,
  tone = "default",
  className,
}: {
  rating: number;
  count?: number;
  tone?: "default" | "pill" | "hit";
  className?: string;
}) {
  if (tone === "pill")
    return (
      <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[16px] font-semibold shadow-card", className)}>
        <Star size={16} className="fill-pink text-pink" />
        {rating.toFixed(1)}
        {count != null && count > 0 && <span className="font-medium text-pink-ink">({formatCount(count)})</span>}
      </span>
    );
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[13px] text-muted", className)}>
      <Star size={16} className={tone === "hit" ? "fill-red text-red" : "fill-star text-star"} />
      <span className="font-medium text-ink-2">{rating.toFixed(1)}</span>
      {count != null && count > 0 && <span>({formatCount(count)})</span>}
    </span>
  );
}

export function DistanceBadge({ km, className }: { km: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] text-muted", className)}>
      <MapPin size={14} strokeWidth={2} /> {km}
    </span>
  );
}

export function AgeBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full bg-purple-50 px-2.5 text-[13px] font-semibold text-purple-ink", className)}>
      {children}
    </span>
  );
}

export function PriceBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full bg-green-50 px-2.5 text-[13px] font-semibold text-green-ink", className)}>
      {children}
    </span>
  );
}

const TAG_TONES = [
  "bg-blue-50 text-blue-ink",
  "bg-blue-50 text-blue-ink",
  "bg-purple-50 text-purple-ink",
  "bg-purple-50 text-purple-ink",
];

/** Чипы-теги на странице места: голубые и сиреневые, как в референсе. */
export function TagChip({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <span className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[15px] font-medium", TAG_TONES[index % 4])}>
      {children}
    </span>
  );
}
