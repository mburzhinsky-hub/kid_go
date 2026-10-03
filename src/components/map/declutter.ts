import type { Place } from "@/lib/types";

export interface MarkerLayout {
  hidden: boolean;
  variant: "card" | "dot";
  extra: number;
}

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const CARD = { w: 118, h: 132 };
const DOT = { w: 58, h: 60 };

const overlap = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const box = (x: number, y: number, s: { w: number; h: number }): Box => ({ l: x - s.w / 2, r: x + s.w / 2, t: y - s.h, b: y });

/**
 * Жадная раскладка маркеров без наложений: важные места (выбранное, хиты, рейтинг)
 * получают карточку с фото, остальные — кружок; если места нет — маркер прячется,
 * а ближайший видимый показывает «+N».
 */
export function declutter(
  items: { place: Place; x: number; y: number }[],
  opts: { selected?: string | null; cardsAllowed: (p: Place) => boolean }
): Record<string, MarkerLayout> {
  const prio = (p: Place) => (p.slug === opts.selected ? 1e6 : 0) + (p.is_hit ? 1000 : 0) + p.rating * 100 + Math.log10(p.review_count + 1);
  const sorted = [...items].sort((a, b) => prio(b.place) - prio(a.place));
  const kept: { slug: string; box: Box }[] = [];
  const res: Record<string, MarkerLayout> = {};
  for (const it of sorted) {
    const tries: ("card" | "dot")[] = it.place.slug === opts.selected || opts.cardsAllowed(it.place) ? ["card", "dot"] : ["dot"];
    let placed = false;
    for (const v of tries) {
      const bx = box(it.x, it.y, v === "card" ? CARD : DOT);
      if (!kept.some((k) => overlap(k.box, bx))) {
        kept.push({ slug: it.place.slug, box: bx });
        res[it.place.slug] = { hidden: false, variant: v, extra: 0 };
        placed = true;
        break;
      }
    }
    if (!placed) {
      const dot = box(it.x, it.y, DOT);
      const host = kept.find((k) => overlap(k.box, dot));
      if (host) res[host.slug].extra += 1;
      res[it.place.slug] = { hidden: true, variant: "dot", extra: 0 };
    }
  }
  return res;
}
