"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Crosshair, RefreshCw, Loader2 } from "lucide-react";
import type { GeoPoint } from "@/lib/types";
import { nearestAreaLabel } from "@/lib/location";
import { createBaseMap } from "./base-map";

/**
 * «Указать на карте»: карта на весь экран, в центре — булавка; двигаем карту, пока булавка не встанет
 * на нужный дом/посёлок. Работает без геокодера и без GPS — только тайлы.
 */
export default function MapPicker({ initial, onPick, onClose }: { initial: GeoPoint; onPick: (p: GeoPoint, label: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [center, setCenter] = useState<GeoPoint>(initial);
  const [moving, setMoving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Загружаем карту…");

  useEffect(() => {
    const flag = { cancelled: false };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (async () => {
      if (!ref.current) return;
      const res = await createBaseMap({ container: ref.current, center: [initial.lng, initial.lat], zoom: 12.5, signal: flag, onStatus: setStatus });
      if (flag.cancelled) return;
      if (!res) {
        setState("failed");
        return;
      }
      const { map } = res;
      mapRef.current = map;
      const sync = () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
      };
      map.on("movestart", () => setMoving(true));
      map.on("moveend", () => {
        setMoving(false);
        sync();
      });
      setState("ready");
    })().catch(() => !flag.cancelled && setState("failed"));
    return () => {
      flag.cancelled = true;
      document.body.style.overflow = prev;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (typeof document === "undefined") return null;
  const label = nearestAreaLabel(center);
  return createPortal(
    <div className="fixed inset-0 z-[80] mx-auto max-w-[480px] overflow-hidden bg-[#efebe3]" role="dialog" aria-modal="true" aria-label="Указать точку на карте">
      {/* position inline: maplibre-gl.css иначе перебивает tailwind-класс и карта схлопывается до 300px */}
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {state === "loading" && (
        <div className="absolute inset-0 skeleton opacity-60">
          <span className="absolute left-1/2 top-[45%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[14px] font-medium text-ink-2 shadow-card">
            <Loader2 size={16} className="animate-spin" /> {status}
          </span>
        </div>
      )}

      {state === "ready" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden>
          <span className="absolute left-0 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/30 blur-[1px]" />
          <MapPin
            size={46}
            strokeWidth={2}
            className="absolute left-0 top-0 fill-pink text-white drop-shadow-lg transition-transform duration-150"
            style={{ transform: `translate(-50%, ${moving ? -118 : -100}%)` }}
          />
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Закрыть" className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white shadow-float">
          <X size={24} />
        </button>
        <div className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 shadow-float">
          <p className="truncate text-[16px] font-bold leading-tight">{state === "ready" ? label : "Указать на карте"}</p>
          <p className="truncate text-[12px] leading-tight text-muted">{state === "ready" ? "Двигайте карту — булавка в центре" : "Выберите точку выезда"}</p>
        </div>
      </div>

      {state === "failed" && (
        <div className="absolute inset-x-4 top-1/3 z-20 rounded-[24px] bg-white p-5 text-center shadow-float">
          <Crosshair size={28} className="mx-auto text-muted" />
          <p className="mt-2 text-[17px] font-bold">Карта не загрузилась</p>
          <p className="mt-1 text-[14px] leading-snug text-muted">Не удалось загрузить карту — возможно, слабый интернет. Повторите или найдите город, посёлок или округ без карты.</p>
          <button
            onClick={() => {
              setState("loading");
              setStatus("Загружаем карту…");
              setAttempt((n) => n + 1);
            }}
            className="press mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pink text-[16px] font-semibold text-white"
          >
            <RefreshCw size={20} /> Повторить
          </button>
          <button onClick={onClose} className="press mt-2 h-12 w-full rounded-full bg-fill text-[16px] font-semibold">
            Выбрать без карты
          </button>
        </div>
      )}

      {state === "ready" && (
        <div className="absolute inset-x-4 z-20" style={{ bottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => onPick(center, label)}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-[17px] font-semibold text-white shadow-pink"
          >
            <MapPin size={20} /> Выехать отсюда
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
