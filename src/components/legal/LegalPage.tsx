import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const CONTACT_EMAIL = "buralle1996@yandex.ru";

/** Простая страница с текстом: заголовок и абзацы. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="px-5 pb-28 pt-[max(18px,env(safe-area-inset-top))]">
      <Link href="/profile/" className="press -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-full pr-3 text-[15px] font-semibold text-ink-2">
        <ChevronLeft size={20} /> Назад
      </Link>
      <h1 className="tight text-[30px] font-[850] leading-tight">{title}</h1>
      <p className="mt-1 text-[13px] text-muted">Редакция: {updated}</p>
      <div className="mt-5 space-y-3 text-[16px] leading-relaxed text-ink-2 [&_h2]:mt-7 [&_h2]:text-[20px] [&_h2]:font-[800] [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </main>
  );
}
