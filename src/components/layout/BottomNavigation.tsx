"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Sparkles, Heart, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFamily } from "@/lib/store";

const ITEMS = [
  { href: "/", label: "Главная", Icon: Home, fillable: true },
  { href: "/map", label: "Карта", Icon: Map, fillable: false },
  { href: "/adventures", label: "Приключения", Icon: Sparkles, fillable: true },
  { href: "/favorites", label: "Избранное", Icon: Heart, fillable: true },
  { href: "/profile", label: "Профиль", Icon: UserRound, fillable: true },
];

const TAB_ROUTES = ["/", "/map", "/adventures", "/favorites", "/profile", "/search"];

export function BottomNavigation() {
  const pathname = usePathname();
  const wantCount = useFamily((s) => (s.hydrated ? s.wantPlaces.length + s.savedPlans.length : 0));
  if (!TAB_ROUTES.includes(pathname)) return null;

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] bg-surface pb-safe shadow-nav"
    >
      <ul className="grid grid-cols-5 px-1 pt-1.5">
        {ITEMS.map(({ href, label, Icon, fillable }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press relative flex flex-col items-center gap-0.5 pb-1.5 pt-1 text-[10.5px] font-medium tracking-[-0.01em]",
                  active ? "text-pink" : "text-[#8a8f9c]"
                )}
              >
                <span className="relative">
                  <Icon
                    size={26}
                    strokeWidth={active ? 2 : 1.7}
                    fill={active && fillable ? "currentColor" : active ? "#ffe9f3" : "none"}
                    className={cn(active && "animate-pop")}
                  />
                  {href === "/favorites" && wantCount > 0 && (
                    <span className="absolute -right-2 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {wantCount}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
