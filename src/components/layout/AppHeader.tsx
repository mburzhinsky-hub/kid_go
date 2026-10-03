import Link from "next/link";
import { Bell } from "lucide-react";
import { LocationChip } from "@/components/location/LocationChip";
import { Logo } from "@/components/ui/Logo";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="КидГоу — на главную" className="press -ml-0.5">
        <Logo size={34} />
      </Link>
      <div className="flex items-center gap-2">
        <LocationChip />
        <Link href="/favorites" aria-label="Уведомления: 2 новых" className="press relative grid h-10 w-10 place-items-center">
          <Bell size={25} strokeWidth={1.9} />
          <span className="absolute right-[7px] top-[6px] h-2.5 w-2.5 rounded-full bg-red ring-2 ring-bg" />
        </Link>
      </div>
    </header>
  );
}
