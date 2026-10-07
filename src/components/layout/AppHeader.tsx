import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

/** Шапка главной: логотип и лёгкий вход в поиск. Выбор «Москва / Москва + область» — в первом блоке главной. */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="КидГоу — на главную" className="press -ml-1 flex h-11 shrink-0 items-center px-1">
        <Logo size={34} className="max-[359px]:!text-[28px]" />
      </Link>
      <Link href="/search" aria-label="Поиск мест" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fill">
        <Search size={22} strokeWidth={2} />
      </Link>
    </header>
  );
}
