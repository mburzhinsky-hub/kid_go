import Link from "next/link";
import { LocationChip } from "@/components/location/LocationChip";
import { Logo } from "@/components/ui/Logo";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="КидГоу — на главную" className="press -ml-1 flex h-11 shrink-0 items-center px-1">
        <Logo size={34} className="max-[359px]:!text-[28px]" />
      </Link>
      <LocationChip className="min-w-0 max-[359px]:max-w-[52vw]" />
    </header>
  );
}
