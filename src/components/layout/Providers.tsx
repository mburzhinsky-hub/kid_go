"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { rehydrateFamily, useFamily } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const needsOnboarding = useFamily((s) => s.hydrated && !s.onboarded && s.children.length === 0);

  // первый запуск (в том числе с экрана «Домой»): знакомимся, а не показываем чужую семью
  useEffect(() => {
    if (!needsOnboarding || pathname !== "/") return;
    try {
      if (sessionStorage.getItem("kidgo-onb-shown")) return;
      sessionStorage.setItem("kidgo-onb-shown", "1");
    } catch {
      /* noop */
    }
    router.replace("/onboarding");
  }, [needsOnboarding, pathname, router]);

  useEffect(() => {
    rehydrateFamily();
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`).catch(() => {});
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <>
      {offline && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-[480px] items-center justify-center gap-2 bg-ink px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-[13px] font-medium text-white animate-rise"
        >
          <WifiOff size={15} /> Нет интернета — показываем сохранённое
        </div>
      )}
      {children}
    </>
  );
}
