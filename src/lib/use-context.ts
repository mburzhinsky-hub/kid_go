"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useFamily } from "@/lib/store";
import { demoForecast, fetchForecast, WX_SCENARIOS, type Forecast, type WxScenario } from "@/lib/forecast";
import { nearestAreaLabel, type Origin } from "@/lib/location";
import { track } from "@/lib/analytics";

/* ───────── Прогноз: один запрос на всё приложение ───────── */

interface WxState {
  forecast?: Forecast;
  key?: string;
  loading: boolean;
}
const useWx = create<WxState>(() => ({ loading: false }));

/** ?wx=rain|rain15|sun|cold|heat|snow — тестовый сценарий погоды (QA и демо). */
export function wxOverride(): WxScenario | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("wx") ?? sessionStorageGet("kidgo-wx");
  if (v && (WX_SCENARIOS as string[]).includes(v)) {
    sessionStorageSet("kidgo-wx", v);
    return v as WxScenario;
  }
  return undefined;
}
function sessionStorageGet(k: string) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function sessionStorageSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* noop */
  }
}

export function useForecast(): { forecast?: Forecast; loading: boolean } {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const st = useWx();
  useEffect(() => {
    if (!hydrated) return;
    const scenario = wxOverride();
    const key = `${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}:${scenario ?? ""}`;
    const cur = useWx.getState();
    if (cur.key === key && (cur.forecast || cur.loading)) return;
    if (scenario) {
      useWx.setState({ forecast: demoForecast(origin, scenario), key, loading: false });
      return;
    }
    useWx.setState({ key, loading: true });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetchForecast(origin, ctrl.signal).then((f) => {
      clearTimeout(timer);
      if (useWx.getState().key === key) useWx.setState({ forecast: f, loading: false });
    });
  }, [hydrated, origin]);
  return { forecast: st.forecast, loading: !hydrated || st.loading || !st.forecast };
}

/* ───────── Геолокация ───────── */

export function requestGpsOrigin(): Promise<Origin> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // за пределами Москвы и области данных пока нет — честно говорим об этом в UI
        const o: Origin = { ...p, label: nearestAreaLabel(p), source: "gps" };
        track("location_set", { source: "gps" });
        resolve(o);
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60000 }
    );
  });
}
