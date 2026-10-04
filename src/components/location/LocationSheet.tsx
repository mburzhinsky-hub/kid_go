"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Home, MapPin, Check, Loader2, Search, Crosshair, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFamily } from "@/lib/store";
import { AREAS, geocode, searchSettlements, type GeoHit, type Origin } from "@/lib/location";
import { requestGpsOrigin } from "@/lib/use-context";
import { haversineKm } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

// карта подгружается только когда нужна (вместе со своим CSS)
const MapPicker = dynamic(() => import("@/components/map/MapPicker"), { ssr: false });

/** «Откуда выезжаем?» — поиск города/посёлка/улицы, точка на карте, GPS, сохранённый «Дом» или район. */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const origin = useFamily((s) => s.origin);
  const home = useFamily((s) => s.home);
  const setOrigin = useFamily((s) => s.setOrigin);
  const setHome = useFamily((s) => s.setHome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHome, setSaveHome] = useState(!home);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);

  const local = useMemo<GeoHit[]>(() => searchSettlements(q).map((x) => ({ label: x.label, sub: x.sub, lat: x.lat, lng: x.lng })), [q]);

  // онлайн-поиск адресов и посёлков (с задержкой, чтобы не засыпать геокодер запросами)
  useEffect(() => {
    setRemote([]);
    if (q.trim().length < 3) {
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const hits = await geocode(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setRemote(hits);
      setSearching(false);
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const results = useMemo(() => {
    const extra = remote.filter((r) => !local.some((l) => haversineKm(l, r) < 2 && l.label.toLowerCase() === r.label.toLowerCase()));
    return [...local, ...extra].slice(0, 8);
  }, [local, remote]);

  const choose = (o: Origin) => {
    setOrigin(o);
    if (saveHome && o.source !== "gps") setHome(o);
    onClose();
  };

  const gps = async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await requestGpsOrigin();
      setOrigin(o);
      if (saveHome) setHome({ ...o, label: "Дом" });
      onClose();
    } catch {
      setError("Не получилось определить место. Разрешите доступ к геопозиции в настройках браузера — или найдите свой город через поиск.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <BottomSheet open={open && !picking} onClose={onClose} title="Откуда выезжаем?">
      <p className="-mt-1 text-[14.5px] text-muted">Считаем дорогу и «рядом» от этой точки — в минутах. Подойдёт любой город или посёлок.</p>

      <label className="mt-3.5 flex h-12 items-center gap-2.5 rounded-full bg-fill px-4">
        <Search size={19} className="shrink-0 text-ink-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Город, посёлок или улица"
          aria-label="Поиск точки выезда"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
        {searching && <Loader2 size={17} className="shrink-0 animate-spin text-muted" />}
        {q && !searching && (
          <button onClick={() => setQ("")} aria-label="Очистить" className="shrink-0 text-muted">
            <X size={18} />
          </button>
        )}
      </label>
      {q.trim().length >= 2 && (
        <ul className="mt-2 space-y-1.5" aria-label="Результаты поиска">
          {results.map((h) => (
            <li key={`${h.lat}:${h.lng}:${h.label}`}>
              <button
                onClick={() => {
                  track("location_set", { source: "search" });
                  choose({ lat: h.lat, lng: h.lng, label: h.label, source: "custom" });
                }}
                className="press flex w-full items-center gap-3 rounded-[16px] bg-surface px-3 py-2.5 text-left shadow-card"
              >
                <MapPin size={18} className="shrink-0 text-pink" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold leading-tight">{h.label}</span>
                  {h.sub && <span className="block truncate text-[12.5px] leading-tight text-muted">{h.sub}</span>}
                </span>
              </button>
            </li>
          ))}
          {!results.length && !searching && q.trim().length >= 3 && (
            <li className="rounded-[14px] bg-fill-2 px-3 py-2.5 text-[13.5px] leading-snug text-muted">Не нашли «{q.trim()}». Попробуйте другое название или укажите точку на карте.</li>
          )}
        </ul>
      )}

      <div className="mt-3 space-y-2">
        <button onClick={() => setPicking(true)} className="press flex w-full items-center gap-3 rounded-[18px] bg-pink-50 p-3.5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-pink">
            <Crosshair size={21} />
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-pink">Указать на карте</span>
            <span className="text-[13px] text-ink-2">поставить булавку у своего дома</span>
          </span>
          {origin.source === "custom" && <Check size={20} className="text-pink" />}
        </button>
        <button onClick={gps} disabled={busy} className="press flex w-full items-center gap-3 rounded-[18px] bg-blue-50 p-3.5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue">
            {busy ? <Loader2 size={21} className="animate-spin" /> : <LocateFixed size={21} />}
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-blue">Где я сейчас</span>
            <span className="text-[13px] text-ink-2">по геопозиции телефона</span>
          </span>
          {origin.source === "gps" && <Check size={20} className="text-blue" />}
        </button>
        {home && (
          <button onClick={() => choose(home)} className="press flex w-full items-center gap-3 rounded-[18px] bg-surface p-3.5 text-left shadow-card">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-pink-50 text-pink">
              <Home size={21} />
            </span>
            <span className="flex-1">
              <span className="block text-[16px] font-bold">Дом</span>
              <span className="text-[13px] text-muted">{home.label === "Дом" ? "сохранённая точка" : home.label}</span>
            </span>
            {origin.source === "home" && <Check size={20} className="text-pink" />}
          </button>
        )}
      </div>
      {error && <p className="mt-3 rounded-[14px] bg-orange-50 px-3 py-2.5 text-[13.5px] leading-snug text-[#8a4a00]">{error}</p>}

      <p className="mt-5 text-[14px] font-bold text-ink-2">Или район</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AREAS.map((a) => {
          const on = origin.source === "area" && origin.label === a.label;
          return (
            <button
              key={a.id}
              onClick={() => {
                track("location_set", { source: "area", area: a.id });
                choose({ lat: a.lat, lng: a.lng, label: a.label, source: "area" });
              }}
              className={cn("press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-semibold", on ? "bg-ink text-white" : "bg-fill text-ink")}
            >
              <MapPin size={14} /> {a.label}
            </button>
          );
        })}
      </div>
      <label className="mt-5 flex items-center gap-2.5 text-[14.5px] text-ink-2">
        <input type="checkbox" checked={saveHome} onChange={(e) => setSaveHome(e.target.checked)} className="h-5 w-5 accent-pink" />
        Запомнить как «Дом»
      </label>
    </BottomSheet>
    {picking && (
      <MapPicker
        initial={origin.source === "default" ? { lat: 55.7558, lng: 37.6173 } : { lat: origin.lat, lng: origin.lng }}
        onClose={() => setPicking(false)}
        onPick={(p, label) => {
          track("location_set", { source: "map" });
          setPicking(false);
          choose({ lat: p.lat, lng: p.lng, label, source: "custom" });
        }}
      />
    )}
    </>
  );
}
