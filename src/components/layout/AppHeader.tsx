import Link from "next/link";
import { Bell } from "lucide-react";
import { LocationChip } from "@/components/location/LocationChip";
import { Logo } from "@/components/ui/Logo";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="КидГоу — на главную" className="press -ml-0.5 shrink-0">
        <Logo size={34} className="max-[359px]:!text-[28px]" />
      </Link>
      <div className="flex min-w-0 items-center gap-1 min-[360px]:gap-2">
        <LocationChip className="min-w-0 max-[359px]:max-w-[36vw]" />
        <Link href="/favorites" aria-label="Уведомления: 2 новых" className="press relative grid h-10 w-9 shrink-0 place-items-center min-[360px]:w-10">
          <Bell size={25} strokeWidth={1.9} />
          <span className="absolute right-[7px] top-[6px] h-2.5 w-2.5 rounded-full bg-red ring-2 ring-bg" />
        </Link>
      </div>
    </header>
  );
}
