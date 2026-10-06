"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Home, MapPin, Check, Loader2, Search, Crosshair, X, Globe2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFamily } from "@/lib/store";
import { DEFAULT_ORIGIN, OKRUGS, geocode, okrugOrigin, searchSettlements, type GeoHit, type Origin } from "@/lib/location";
import { requestGpsOrigin } from "@/lib/use-context";
import { haversineKm } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

// карта подгружается только когда нужна (вместе со своим CSS)
const MapPicker = dynamic(() => import("@/components/map/MapPicker"), { ssr: false });

type Hit = GeoHit & { approx?: boolean };

/**
 * «Где ищем?» — по умолчанию вся Москва (ничего не привязано к точке).
 * Дальше по нарастающей: округ (условно) → город области → точный адрес, булавка, GPS, «Дом».
 */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const origin = useFamily((s) => s.origin);
  const home = useFamily((s) => s.home);
  const setOrigin = useFamily((s) => s.setOrigin);
  const setHome = useFamily((s) => s.setHome);
  const geoScope = useFamily((s) => s.geoScope);
  const setPrefs = useFamily((s) => s.setPrefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHome, setSaveHome] = useState(!home);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);

  const local = useMemo<Hit[]>(() => searchSettlements(q).map((x) => ({ label: x.label, sub: x.sub, lat: x.lat, lng: x.lng, approx: true })), [q]);

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

  const results = useMemo<Hit[]>(() => {
    const extra = remote.filter((r) => !local.some((l) => haversineKm(l, r) < 2 && l.label.toLowerCase() === r.label.toLowerCase()));
    return [...local, ...extra].slice(0, 8);
  }, [local, remote]);

  /** `precise` — точный адрес: его можно запомнить как «Дом». Округа, города и «вся Москва» домом не становятся. */
  const choose = (o: Origin, precise = true) => {
    setOrigin(o);
    if (precise && saveHome && o.source === "custom") setHome(o);
    onClose();
  };

  const gps = async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await requestGpsOrigin();
      setOrigin(o);
      if (saveHome && !home) setHome({ ...o, label: "Дом" });
      onClose();
    } catch {
      setError("Не получилось определить место. Разрешите доступ к геопозиции в настройках браузера — или найдите свой город через поиск.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <BottomSheet open={open && !picking} onClose={onClose} title="Где ищем?">
      <p className="-mt-1 text-[15px] leading-snug text-muted">
        Сразу выберите охват: только Москва или Москва вместе с Подмосковьем. Для «рядом» можно указать округ, город или точный адрес.
      </p>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            track("location_set", { source: "any", scope: "moscow" });
            setPrefs({ geoScope: "moscow" });
            choose(DEFAULT_ORIGIN, false);
          }}
          className={cn("press rounded-[20px] p-3.5 text-left", origin.source === "default" && geoScope === "moscow" ? "bg-ink text-white" : "bg-surface shadow-card")}
        >
          <span className={cn("grid h-10 w-10 place-items-center rounded-full", origin.source === "default" && geoScope === "moscow" ? "bg-white/15" : "bg-fill")}>
            <Globe2 size={20} />
          </span>
          <span className="mt-2 block text-[16px] font-bold">Москва</span>
          <span className={cn("mt-0.5 block text-[13px] leading-snug", origin.source === "default" && geoScope === "moscow" ? "text-white/75" : "text-muted")}>лучшие идеи в городе</span>
          {origin.source === "default" && geoScope === "moscow" && <Check size={20} className="mt-2" />}
        </button>
        <button
          onClick={() => {
            track("location_set", { source: "any", scope: "moscow-region" });
            setPrefs({ geoScope: "moscow-region" });
            choose(DEFAULT_ORIGIN, false);
          }}
          className={cn("press rounded-[20px] p-3.5 text-left", origin.source === "default" && geoScope === "moscow-region" ? "bg-purple-ink text-white" : "bg-purple-50 text-ink shadow-card")}
        >
          <span className={cn("grid h-10 w-10 place-items-center rounded-full", origin.source === "default" && geoScope === "moscow-region" ? "bg-white/15" : "bg-white text-purple-ink")}>
            <MapPin size={20} />
          </span>
          <span className="mt-2 block text-[16px] font-bold">Москва + область</span>
          <span className={cn("mt-0.5 block text-[13px] leading-snug", origin.source === "default" && geoScope === "moscow-region" ? "text-white/75" : "text-muted")}>Красногорск, Истра, Одинцово и другие</span>
          {origin.source === "default" && geoScope === "moscow-region" && <Check size={20} className="mt-2" />}
        </button>
      </div>

      <p className="mt-5 text-[14px] font-bold text-ink-2">Или округ — условно</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {OKRUGS.map((a) => {
          const on = origin.source === "area" && origin.label === a.short;
          return (
            <button
              key={a.id}
              aria-pressed={on}
              onClick={() => {
                track("location_set", { source: "okrug", area: a.id });
                choose(okrugOrigin(a), false);
              }}
              className={cn("press rounded-[16px] px-3 py-2 text-left", on ? "bg-ink text-white" : "bg-fill text-ink")}
            >
              <span className="flex items-center justify-between text-[15px] font-bold leading-tight">
                {a.short}
                {on && <Check size={16} />}
              </span>
              <span className={cn("mt-0.5 line-clamp-2 block text-[12px] leading-snug", on ? "text-white/75" : "text-muted")}>{a.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] leading-snug text-muted">Дорогу считаем условно — от центра округа, с запасом: «≈ N мин».</p>

      <p className="mt-5 text-[14px] font-bold text-ink-2">Подмосковье и точнее</p>
      <label className="mt-2 flex h-12 items-center gap-2.5 rounded-full bg-fill px-4">
        <Search size={20} className="shrink-0 text-ink-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Город, посёлок или улица"
          aria-label="Поиск места"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
        {searching && <Loader2 size={16} className="shrink-0 animate-spin text-muted" />}
        {q && !searching && (
          <button onClick={() => setQ("")} aria-label="Очистить" className="shrink-0 text-muted">
            <X size={20} />
          </button>
        )}
      </label>
      {q.trim().length >= 2 && (
        <ul className="mt-2 space-y-1.5" aria-label="Результаты поиска">
          {results.map((h) => (
            <li key={`${h.lat}:${h.lng}:${h.label}`}>
              <button
                onClick={() => {
                  track("location_set", { source: h.approx ? "settlement" : "search" });
                  choose({ lat: h.lat, lng: h.lng, label: h.label, source: h.approx ? "area" : "custom" }, !h.approx);
                }}
                className="press flex w-full items-center gap-3 rounded-[16px] bg-surface px-3 py-2.5 text-left shadow-card"
              >
                <MapPin size={20} className="shrink-0 text-pink-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold leading-tight">{h.label}</span>
                  {h.sub && <span className="block truncate text-[13px] leading-tight text-muted">{h.sub}</span>}
                </span>
              </button>
            </li>
          ))}
          {!results.length && !searching && q.trim().length >= 3 && (
            <li className="rounded-[12px] bg-fill-2 px-3 py-2.5 text-[14px] leading-snug text-muted">Не нашли «{q.trim()}». Попробуйте другое название или укажите точку на карте.</li>
          )}
        </ul>
      )}

      <div className="mt-3 space-y-2">
        <button onClick={() => setPicking(true)} className="press flex w-full items-center gap-3 rounded-[20px] bg-pink-50 p-3.5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-pink-ink">
            <Crosshair size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-pink-ink">Указать на карте</span>
            <span className="text-[13px] text-ink-2">булавка у дома — считаем минуты от двери</span>
          </span>
          {origin.source === "custom" && <Check size={20} className="text-pink-ink" />}
        </button>
        <button onClick={gps} disabled={busy} className="press flex w-full items-center gap-3 rounded-[20px] bg-blue-50 p-3.5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue-ink">
            {busy ? <Loader2 size={20} className="animate-spin" /> : <LocateFixed size={20} />}
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-blue-ink">Где я сейчас</span>
            <span className="text-[13px] text-ink-2">по геопозиции телефона</span>
          </span>
          {origin.source === "gps" && <Check size={20} className="text-blue-ink" />}
        </button>
        {home && (
          <button onClick={() => choose(home, false)} className="press flex w-full items-center gap-3 rounded-[20px] bg-surface p-3.5 text-left shadow-card">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-pink-50 text-pink-ink">
              <Home size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[16px] font-bold">Дом</span>
              <span className="text-[13px] text-muted">{home.label === "Дом" ? "сохранённая точка" : home.label}</span>
            </span>
            {origin.source === "home" && <Check size={20} className="text-pink-ink" />}
          </button>
        )}
      </div>
      {error && <p className="mt-3 rounded-[12px] bg-orange-50 px-3 py-2.5 text-[14px] leading-snug text-orange-ink">{error}</p>}

      <label className="mt-5 flex items-center gap-2.5 text-[15px] text-ink-2">
        <input type="checkbox" checked={saveHome} onChange={(e) => setSaveHome(e.target.checked)} className="h-5 w-5 accent-pink" />
        Точный адрес — запомнить как «Дом»
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
