"use client";

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import type { GeoPoint, Place } from "@/lib/types";
import { useFamily } from "@/lib/store";
import { haversineKm } from "@/lib/geo";
import { okrugOf, okrugOfOrigin } from "@/lib/moscow";
import type { Origin } from "@/lib/location";
import { places as STATIC } from "@/lib/data/places";
import { CACHE_TTL, cellOf, getDynamic, loadCell, pinElements, registerDynamic, saveCell } from "@/lib/data/dynamic";
import { fetchOsmByIds, fetchOverpass, placesFromOsm, type OsmElement } from "@/lib/osm";
import { track } from "@/lib/analytics";

/**
 * «Места рядом» из OpenStreetMap для тех, кто живёт там, где наш каталог редкий (за МКАД, окраины, посёлки).
 * Загрузка фоновая: один запрос на ячейку ~4 км, дальше — из кэша браузера.
 */

type Status = "idle" | "skipped" | "loading" | "ready" | "error";

interface NearbyState {
  key?: string;
  els?: OsmElement[];
  status: Status;
  /** Когда началась загрузка (для «не ждём дольше N секунд»). */
  since?: number;
}
export const useNearbyStore = create<NearbyState>(() => ({ status: "idle" }));

/** Радиус выборки вокруг центра ячейки: покрывает ~10 км вокруг любой точки внутри ячейки. */
const FETCH_KM = 14;
/** Если в 8 км от точки каталог уже даёт столько мест — OSM не нужен (центр города). */
const DENSE_ENOUGH = 14;

export function staticCoverage(p: GeoPoint, km = 8): number {
  let n = 0;
  for (const s of STATIC) if (s.category !== "cafe" && s.category !== "shop" && haversineKm(p, { lat: s.latitude, lng: s.longitude }) <= km) n++;
  return n;
}

/**
 * Выбран округ: ему нужно своё покрытие, а не «в 8 км от центра округа что-то есть» — иначе при строгом правиле «округ — граница»
 * в ЮВАО, СЗАО или Зеленограде остаются 2–5 мест каталога, и на большинство ситуаций честно отвечается «здесь нет».
 */
const OKRUG_ENOUGH = 14;
const ANCHOR_CATS = ["park", "play", "museum", "active", "animals"];
export function okrugCoverage(okrugId: string): number {
  let n = 0;
  for (const s of STATIC) if (ANCHOR_CATS.includes(s.category) && okrugOf(s) === okrugId) n++;
  return n;
}

export const needsOsm = (p: GeoPoint & Partial<Pick<Origin, "source" | "label">>) => {
  const okrug = p.source === "area" ? okrugOfOrigin({ source: "area", label: p.label ?? "", lat: p.lat, lng: p.lng }) : undefined;
  return okrug ? okrugCoverage(okrug.id) < OKRUG_ENOUGH : staticCoverage(p) < DENSE_ENOUGH;
};

let inflight: AbortController | null = null;
/** После неудачи не долбим серверы при каждом открытии экрана — пробуем снова не чаще раза в 90 секунд. */
const failedAt = new Map<string, number>();

export async function ensureNearby(origin: GeoPoint & Partial<Pick<Origin, "source" | "label">>, force = false) {
  if (!needsOsm(origin)) {
    useNearbyStore.setState({ key: undefined, els: undefined, status: "skipped" });
    return;
  }
  const { key, center } = cellOf(origin);
  const cur = useNearbyStore.getState();
  if (!force && cur.key === key && (cur.status === "loading" || cur.status === "ready")) return;
  if (!force && Date.now() - (failedAt.get(key) ?? 0) < 90_000) return;

  const cached = loadCell(key);
  const fresh = cached && Date.now() - cached.at < CACHE_TTL;
  if (cached) {
    registerDynamic(placesFromOsm(cached.els, origin));
    useNearbyStore.setState({ key, els: cached.els, status: fresh ? "ready" : "loading", since: Date.now() });
    if (fresh && !force) return;
  } else {
    useNearbyStore.setState({ key, els: undefined, status: "loading", since: Date.now() });
  }

  inflight?.abort();
  const ctrl = (inflight = new AbortController());
  try {
    const els = await fetchOverpass(center, FETCH_KM, ctrl.signal);
    if (ctrl.signal.aborted) return;
    saveCell({ key, lat: center.lat, lng: center.lng, at: Date.now(), els });
    registerDynamic(placesFromOsm(els, origin));
    if (useNearbyStore.getState().key === key) useNearbyStore.setState({ els, status: "ready" });
    failedAt.delete(key);
    track("osm_loaded", { n: els.length });
  } catch {
    if (ctrl.signal.aborted && inflight !== ctrl) return; // нас вытеснил более новый запрос
    if (useNearbyStore.getState().key === key) useNearbyStore.setState({ status: cached ? "ready" : "error" });
    failedAt.set(key, Date.now());
    track("osm_failed");
  }
}

const EMPTY: Place[] = [];

/**
 * Дополнительные места вокруг точки выезда.
 * `settling` — первые секунды загрузки, когда стоит чуть подождать, чтобы не показать «бедную» выдачу и тут же её поменять.
 */
export function useNearbyExtras(): { places: Place[]; status: Status; settling: boolean } {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const { els, status, since } = useNearbyStore();

  useEffect(() => {
    if (hydrated) void ensureNearby(origin);
  }, [hydrated, origin]);

  const [, tick] = useState(0);
  useEffect(() => {
    if (status !== "loading") return;
    const left = 7100 - (Date.now() - (since ?? Date.now()));
    const t = setTimeout(() => tick((n) => n + 1), Math.max(0, left));
    return () => clearTimeout(t);
  }, [status, since]);

  const places = useMemo(() => (els ? placesFromOsm(els, origin) : EMPTY), [els, origin]);
  const settling = status === "loading" && !els && Date.now() - (since ?? 0) < 7000;
  return { places, status, settling };
}

/**
 * Подгружает по идентификатору места OSM, которых нет в локальном кэше (общая ссылка на «Наш день»,
 * кэш вытеснен). Возвращает «версию» — меняется, когда реестр пополнился, чтобы экран перечитал места.
 */
export function useResolveDynamic(slugs: string[]): number {
  const [ver, setVer] = useState(0);
  const key = slugs.filter((s) => s.startsWith("osm-")).join(",");
  useEffect(() => {
    if (!key) return;
    const missing = key.split(",").filter((s) => !getDynamic(s));
    if (!missing.length) return;
    const ctrl = new AbortController();
    fetchOsmByIds(missing, ctrl.signal)
      .then((els) => {
        if (ctrl.signal.aborted || !els.length) return;
        pinElements(els);
        const c = els[0].center ?? (els[0].lat != null && els[0].lon != null ? { lat: els[0].lat, lon: els[0].lon } : null);
        registerDynamic(placesFromOsm(els, c ? { lat: c.lat, lng: c.lon } : { lat: 55.75, lng: 37.6 }));
        setVer((v) => v + 1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);
  return ver;
}
