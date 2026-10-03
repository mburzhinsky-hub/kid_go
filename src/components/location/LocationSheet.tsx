"use client";

import { useState } from "react";
import { LocateFixed, Home, MapPin, Check, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFamily } from "@/lib/store";
import { AREAS, type Origin } from "@/lib/location";
import { requestGpsOrigin } from "@/lib/use-context";
import { haversineKm } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

/** «Откуда выезжаем?» — GPS, сохранённый «Дом» или район. */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const origin = useFamily((s) => s.origin);
  const home = useFamily((s) => s.home);
  const setOrigin = useFamily((s) => s.setOrigin);
  const setHome = useFamily((s) => s.setHome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHome, setSaveHome] = useState(!home);

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
      if (haversineKm(o, { lat: 55.7558, lng: 37.6173 }) > 60) {
        setError("Похоже, вы не в Москве — пока мы знаем места только здесь. Выберите район ниже.");
        return;
      }
      setOrigin(o);
      if (saveHome) setHome({ ...o, label: "Дом" });
      onClose();
    } catch {
      setError("Не получилось определить место. Разрешите доступ к геопозиции в настройках Safari или выберите район.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Откуда выезжаем?">
      <p className="-mt-1 text-[14.5px] text-muted">Считаем дорогу и «рядом» от этой точки — в минутах.</p>
      <div className="mt-4 space-y-2">
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
  );
}
