import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function SectionHeader({
  title,
  href,
  action = "Все",
  className,
  subtitle,
}: {
  title: React.ReactNode;
  href?: string;
  action?: string;
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4", className)}>
      <div className="min-w-0">
        <h2 className="tight text-[24px] font-[800] leading-[1.15]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="press -mr-2 -mt-2 flex h-11 shrink-0 items-center gap-1 px-2 text-[16px] font-medium text-blue-ink">
          {action} <ArrowRight size={20} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
