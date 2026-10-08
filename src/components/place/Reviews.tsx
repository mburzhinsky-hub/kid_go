import { ExternalLink, Star } from "lucide-react";
import type { Place } from "@/lib/types";
import { formatCountNoun } from "@/lib/format";

const AVATAR_BG = ["#FFE3E8", "#E2EEFF", "#E4F4DD", "#FFF3D6", "#EEE5FE"];

export function Reviews({ place }: { place: Place }) {
  if ((!place.rating_source || place.rating <= 0) && place.reviews.length === 0) return null;

  return (
    <div>
      {place.rating > 0 && place.rating_source && (
        <div className="rounded-[24px] bg-surface p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div>
              <p className="tight text-[36px] font-[850] leading-none">{place.rating.toFixed(1)}</p>
              <div className="mt-1 flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < Math.round(place.rating) ? "fill-star text-star" : "fill-line text-line"} />
                ))}
              </div>
            </div>
            <div className="min-w-0">
              {place.review_count > 0 ? <p className="text-[14px] font-semibold">{formatCountNoun(place.review_count, "отзыв", "отзыва", "отзывов")}</p> : <p className="text-[14px] font-semibold">Оценка посетителей</p>}
              <a
                href={place.rating_source}
                target="_blank"
                rel="noreferrer"
                className="hit relative mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-muted underline decoration-line underline-offset-2"
              >
                Читать отзывы <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {place.reviews.length > 0 && (
        <ul className="no-scrollbar snap-x-pad -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {place.reviews.map((r, i) => (
            <li key={i} className="w-[280px] shrink-0 snap-start rounded-[20px] bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-full text-[16px] font-bold" style={{ background: AVATAR_BG[i % 5] }}>
                  {r.author[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">{r.author}</p>
                  <p className="text-[13px] text-muted">
                    {r.kids} · {r.date}
                  </p>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[13px] font-bold">
                  <Star size={14} className="fill-star text-star" /> {r.rating}
                </span>
              </div>
              <p className="mt-2.5 text-[15px] leading-snug text-ink-2">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
