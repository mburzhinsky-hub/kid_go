import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export function CategoryScroller({ active = "all", hrefBase = "/search" }: { active?: string; hrefBase?: string }) {
  return (
    <nav aria-label="Категории" className="no-scrollbar snap-x-pad flex snap-x gap-[10px] overflow-x-auto px-4 pb-1">
      {CATEGORIES.map(({ id, label, bg, fg, Icon }) => {
        const isActive = id === active;
        const solid = isActive && id !== "all" ? fg : bg;
        return (
          <Link
            key={id}
            href={id === "all" ? `${hrefBase}` : `${hrefBase}?category=${id}`}
            className="press flex w-[66px] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
          >
            <span
              className={cn("grid h-[62px] w-[62px] place-items-center rounded-[20px]", isActive && "shadow-[0_6px_16px_-6px_rgba(0,0,0,0.25)]")}
              style={{
                background: isActive ? solid : `linear-gradient(160deg, color-mix(in oklab, ${bg} 70%, white) 0%, ${bg} 100%)`,
                color: isActive ? "#fff" : fg,
              }}
            >
              <Icon width={31} height={31} />
            </span>
            <span className="text-[12.5px] font-medium leading-[1.2] text-ink">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
