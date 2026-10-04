import { Star } from "lucide-react";
import type { Place } from "@/lib/types";
import { formatCount } from "@/lib/format";

const AVATAR_BG = ["#FFE3E8", "#E2EEFF", "#E4F4DD", "#FFF3D6", "#EEE5FE"];

export function Reviews({ place }: { place: Place }) {
  if (place.review_count === 0)
    return (
      <p className="rounded-[20px] bg-fill-2 px-4 py-3.5 text-[14.5px] leading-snug text-muted ring-1 ring-line">
        Отзывов пока нет. Были здесь? Отметьте «Были» — это поможет подобрать похожие места.
      </p>
    );
  const dist = [0.78, 0.15, 0.04, 0.02, 0.01];
  return (
    <div>
      <div className="flex items-center gap-4 rounded-[22px] bg-surface p-4 shadow-card">
        <div className="text-center">
          <p className="tight text-[40px] font-[850] leading-none">{place.rating.toFixed(1)}</p>
          <div className="mt-1 flex justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} className={i < Math.round(place.rating) ? "fill-star text-star" : "fill-line text-line"} />
            ))}
          </div>
          <p className="mt-1 text-[12.5px] text-muted">{formatCount(place.review_count)} отзывов</p>
        </div>
        <div className="flex-1 space-y-1">
          {dist.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px] text-muted">
              <span className="w-2">{5 - i}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                <span className="block h-full rounded-full bg-star" style={{ width: `${d * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <ul className="no-scrollbar snap-x-pad -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {place.reviews.map((r, i) => (
          <li key={i} className="w-[280px] shrink-0 snap-start rounded-[20px] bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-full text-[16px] font-bold" style={{ background: AVATAR_BG[i % 5] }}>
                {r.author[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{r.author}</p>
                <p className="text-[12.5px] text-muted">
                  {r.kids} · {r.date}
                </p>
              </div>
              <span className="inline-flex items-center gap-0.5 text-[13px] font-bold">
                <Star size={13} className="fill-star text-star" /> {r.rating}
              </span>
            </div>
            <p className="mt-2.5 text-[14.5px] leading-snug text-ink-2">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
