import { SmartImage } from "@/components/ui/SmartImage";
import type { CoverArt } from "@/lib/social/catalog";
import { cn } from "@/lib/cn";

/** Обложка подборки: фото места или автоколлаж 2×2 из первых мест. */
export function CollectionCover({ art, sizes, priority, className }: { art: CoverArt; sizes: string; priority?: boolean; className?: string }) {
  if (art.kind === "photo") return <SmartImage photo={art.tile.photo} tint={art.tile.tint} emoji={art.tile.emoji} sizes={sizes} priority={priority} className={className} />;
  const tiles = art.tiles;
  const cols = tiles.length >= 3;
  return (
    <div className={cn("relative grid gap-[3px] overflow-hidden bg-white", cols ? "grid-cols-2 grid-rows-2" : "grid-cols-2", className)}>
      {tiles.slice(0, cols ? 4 : 2).map((t, i) => (
        <SmartImage key={i} photo={t.photo} tint={t.tint} emoji={t.emoji} sizes={sizes.replace(/(\d+)px/, (_, n) => `${Math.round(Number(n) / 2)}px`)} className={cn("h-full w-full", tiles.length === 3 && i === 0 && "row-span-2")} />
      ))}
    </div>
  );
}
