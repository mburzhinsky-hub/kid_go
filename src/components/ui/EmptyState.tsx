import Link from "next/link";
import { cn } from "@/lib/cn";

type Art = "search" | "heart" | "map" | "rain" | "offline" | "day" | "plan" | "error";

/** Пустые состояния — с иллюстрацией, а не «нет данных». */
export function EmptyState({
  art,
  title,
  text,
  action,
  secondary,
  className,
  page,
}: {
  art: Art;
  title: string;
  text?: string;
  action?: { href: string; label: string };
  secondary?: React.ReactNode;
  className?: string;
  /** Экран целиком состоит из этого состояния — заголовок станет h1 (для читалок экрана и поиска). */
  page?: boolean;
}) {
  const Title = page ? "h1" : "h3";
  return (
    <div className={cn("flex flex-col items-center px-6 py-8 text-center", className)}>
      <Illustration art={art} />
      <Title className="tight mt-4 text-[21px] font-[800] leading-tight">{title}</Title>
      {text && <p className="mt-1.5 max-w-[300px] text-[15px] leading-snug text-muted">{text}</p>}
      {action && (
        <Link href={action.href} className="press mt-5 inline-flex h-12 items-center rounded-full bg-pink px-6 text-[16px] font-semibold text-white shadow-pink">
          {action.label}
        </Link>
      )}
      {secondary}
    </div>
  );
}

export function Illustration({ art }: { art: Art }) {
  const emoji = { search: "🔭", heart: "💌", map: "🗺️", rain: "☔", offline: "📡", day: "🎒", plan: "🧩", error: "🙈" }[art];
  const bg = { search: "#E2EEFF", heart: "#FFE4F1", map: "#E4F4DD", rain: "#E2EEFF", offline: "#FFF3D6", day: "#FFF3D6", plan: "#EEE5FE", error: "#FFE3E8" }[art];
  return (
    <div className="relative h-[132px] w-[160px]">
      <div className="absolute inset-x-3 bottom-0 top-3 rounded-[48%_52%_46%_54%/55%_48%_52%_45%]" style={{ background: bg }} />
      <span className="absolute left-2 top-4 h-4 w-4 rounded-full bg-yellow" />
      <span className="absolute right-3 top-1 h-3 w-3 rounded-full bg-pink" />
      <span className="absolute bottom-3 right-0 h-5 w-5 rotate-12 rounded-[6px] bg-purple/70" />
      <span className="absolute inset-0 grid place-items-center text-[64px] animate-bob">{emoji}</span>
    </div>
  );
}
