"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Лёгкий журнал переходов внутри приложения — чтобы «назад» знал, есть ли куда возвращаться.
 * В режиме «веб-приложения» на iPhone нет кнопки браузера «назад» и стрелка рисуется самим приложением;
 * history.length для этого ненадёжен (он считает и то, что было до запуска), поэтому ведём свой стек экранов.
 *
 *  - переход по ссылке → экран добавляется в стек;
 *  - системное «назад» (жест, popstate) → стек укорачивается;
 *  - переключение вкладок внизу → стек начинается заново (у вкладок нет «назад» к другой вкладке).
 */
const stack: string[] = [];
const listeners = new Set<() => void>();
let popped = false;
let popTimer: ReturnType<typeof setTimeout> | undefined;
let resetNext = false;

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Нажали вкладку внизу: следующий экран — корень, назад к предыдущей вкладке не ведём. */
export function markTabSwitch() {
  resetNext = true;
}

/** Подключается один раз в Providers. */
export function useNavTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const onPop = () => {
      popped = true;
      clearTimeout(popTimer);
      // если путь не изменится (меняется только query), «возврат» не должен прилипнуть к следующему переходу
      popTimer = setTimeout(() => (popped = false), 600);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (resetNext) {
      resetNext = false;
      popped = false;
      stack.length = 0;
      stack.push(pathname);
    } else if (popped) {
      popped = false;
      const i = stack.lastIndexOf(pathname);
      if (i >= 0) stack.length = i + 1;
      else if (stack[stack.length - 1] !== pathname) stack.push(pathname);
    } else if (stack[stack.length - 1] !== pathname) {
      stack.push(pathname);
    }
    emit();
  }, [pathname]);
}

const canBack = () => stack.length > 1;

/** Есть ли в приложении экран, на который можно вернуться. На сервере и при первой загрузке — нет. */
export function useCanGoBack(): boolean {
  return useSyncExternalStore(subscribe, canBack, () => false);
}

/** «Назад»: на предыдущий экран приложения, а если его нет (открыли ссылку, перезапуск) — на запасной. */
export function goBack(router: { back: () => void; push: (href: string) => void }, fallback = "/") {
  if (canBack() && typeof history !== "undefined" && history.length > 1) router.back();
  else router.push(fallback);
}
