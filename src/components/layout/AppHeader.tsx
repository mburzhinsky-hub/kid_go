import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="КидГоу — на главную" className="press -ml-0.5">
        <Logo size={34} />
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/profile#city"
          className="press flex h-10 items-center gap-1 rounded-full bg-fill pl-4 pr-3 text-[15px] font-semibold"
        >
          Москва <ChevronDown size={17} strokeWidth={2.4} className="text-ink-2" />
        </Link>
        <Link href="/favorites" aria-label="Уведомления: 2 новых" className="press relative grid h-10 w-10 place-items-center">
          <Bell size={25} strokeWidth={1.9} />
          <span className="absolute right-[7px] top-[6px] h-2.5 w-2.5 rounded-full bg-red ring-2 ring-bg" />
        </Link>
      </div>
    </header>
  );
}
