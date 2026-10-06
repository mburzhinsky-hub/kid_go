import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

export function SearchBar({ placeholder = "Куда пойдём сегодня?" }: { placeholder?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4">
      <Link
        href="/search"
        className="press flex h-12 flex-1 items-center gap-2.5 rounded-full bg-fill px-4 text-[17px] text-muted"
      >
        <Search size={24} strokeWidth={2} className="text-ink-2" />
        {placeholder}
      </Link>
      <Link
        href="/search?filters=1"
        aria-label="Фильтры"
        className="press grid h-12 w-12 place-items-center rounded-full bg-fill"
      >
        <SlidersHorizontal size={20} strokeWidth={2} />
      </Link>
    </div>
  );
}
