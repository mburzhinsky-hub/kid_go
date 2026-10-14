import Link from "next/link";
import { landingHref, publishedLandings, type Landing } from "@/lib/landings";

/** Ссылки на подборки: простые ссылки в разметке, чтобы их находили и люди, и поисковые роботы. */
export function LandingChips({ items, className }: { items?: Landing[]; className?: string }) {
  const list = items ?? publishedLandings();
  if (!list.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 px-4 ${className ?? ""}`}>
      {list.map((l) => (
        <li key={l.slug}>
          <Link href={landingHref(l)} className="press hit relative inline-flex h-10 items-center rounded-full bg-surface px-3.5 text-[14px] font-semibold shadow-card">
            {l.short}
          </Link>
        </li>
      ))}
    </ul>
  );
}
