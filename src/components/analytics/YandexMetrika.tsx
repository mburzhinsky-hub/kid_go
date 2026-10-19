"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { YM_ID, cleanHitUrl, cleanReferrer, isPrivatePath, isTrackedHost } from "@/lib/metrika";

/**
 * Яндекс Метрика (счётчик из src/lib/metrika.ts). Только просмотры страниц, без Вебвизора, карты кликов,
 * отслеживания ссылок и «точного показателя отказов»: эти режимы сами шлют текущий адрес страницы вместе с параметрами,
 * а в параметрах (`kids=`) лежат возрасты детей.
 *
 * Как работает: счётчик создаётся с defer — он ничего не отправляет сам. Каждый переход мы отправляем вручную (`hit`)
 * с очищенным адресом. Utm-метки уходят только с первым просмотром визита (заход по рекламной ссылке).
 *
 * Свои визиты можно исключить: в консоли браузера `localStorage.setItem("kg-no-metrika","1")`.
 */

type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
type YmWindow = Window & { ym?: Ym };

export function YandexMetrika() {
  const pathname = usePathname();
  const ready = useRef(false);
  const prevUrl = useRef("");
  const first = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !isTrackedHost(window.location.hostname)) return;
    try {
      if (window.localStorage.getItem("kg-no-metrika") === "1") return;
    } catch {
      /* без localStorage считаем как обычного посетителя */
    }
    const w = window as YmWindow;

    if (!ready.current) {
      ready.current = true;
      const ym: Ym =
        w.ym ??
        Object.assign(
          (...args: unknown[]) => {
            (ym.a = ym.a || []).push(args);
          },
          {} as { a?: unknown[][]; l?: number }
        );
      ym.l = Date.now();
      w.ym = ym;
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
      document.head.appendChild(s);
      ym(YM_ID, "init", {
        defer: true,
        webvisor: false,
        clickmap: false,
        trackLinks: false,
        accurateTrackBounce: false,
        trackHash: false,
      });
    }

    if (isPrivatePath(pathname)) {
      prevUrl.current = "";
      first.current = false;
      return;
    }
    const url = cleanHitUrl(window.location.origin, pathname, window.location.search, first.current);
    const referer = first.current ? cleanReferrer(document.referrer, window.location.origin) : prevUrl.current;
    w.ym?.(YM_ID, "hit", url, { title: document.title, referer });
    prevUrl.current = cleanHitUrl(window.location.origin, pathname, "", false);
    first.current = false;
  }, [pathname]);

  return null;
}
