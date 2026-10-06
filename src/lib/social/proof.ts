"use client";

/**
 * Социальное доказательство «N семей хотят сюда» — только из реальных данных сервера.
 * Адрес со счётчиками задаётся NEXT_PUBLIC_COUNTS_URL (JSON { "slug": число }). Нет сервера или значение мало — ничего не показываем,
 * чисел не выдумываем.
 */
import { useEffect, useState } from "react";

export const PROOF_MIN = 20;
let cache: Promise<Record<string, number>> | undefined;

function load(): Promise<Record<string, number>> {
  const url = process.env.NEXT_PUBLIC_COUNTS_URL;
  if (!url) return Promise.resolve({});
  cache ??= fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, number>>) : {}))
    .catch(() => ({}));
  return cache;
}

export function useWantCount(slug: string): number | undefined {
  const [n, setN] = useState<number>();
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setN(typeof m[slug] === "number" && m[slug] >= PROOF_MIN ? m[slug] : undefined));
    return () => {
      alive = false;
    };
  }, [slug]);
  return n;
}
