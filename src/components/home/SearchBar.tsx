import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

export function SearchBar({ placeholder = "Куда пойдём сегодня?" }: { placeholder?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4">
      <Link
        href="/search"
        className="press flex h-[50px] flex-1 items-center gap-2.5 rounded-full bg-fill px-4 text-[16.5px] text-muted"
      >
        <Search size={22} strokeWidth={2.1} className="text-ink-2" />
        {placeholder}
      </Link>
      <Link
        href="/search?filters=1"
        aria-label="Фильтры"
        className="press grid h-[50px] w-[50px] place-items-center rounded-full bg-fill"
      >
        <SlidersHorizontal size={21} strokeWidth={2.1} />
      </Link>
    </div>
  );
}
