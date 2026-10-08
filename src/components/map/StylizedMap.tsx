"use client";

import { useRef, useState } from "react";
import type { GeoPoint } from "@/lib/types";
import { CITY_CENTER, OKRUGS } from "@/lib/location";

/**
 * Схема без подложки — запасной вариант, когда тайлы недоступны (офлайн, блокировка, нет WebGL).
 * Честно рисуем только то, что знаем точно: условную границу МКАД, центр Москвы, подписи округов на опорных
 * точках и — для точного места — расстояния от него (кольца 5/10/20/40 км). Места стоят на верных направлениях и расстояниях.
 */
const BASE_PX_PER_KM = 9;

export function makeProjector(center: GeoPoint, zoom: number) {
  const px = BASE_PX_PER_KM * zoom;
  const kx = Math.cos((center.lat * Math.PI) / 180);
  return {
    pxPerKm: px,
    /** Координаты относительно центра схемы, px. */
    project: (lat: number, lng: number) => ({ x: (lng - center.lng) * 111.32 * kx * px, y: -(lat - center.lat) * 110.57 * px }),
  };
}

const RINGS = [5, 10, 20, 40];

export function StylizedMap({ children, center, zoom = 1, origin }: { children: React.ReactNode; center: GeoPoint; zoom?: number; origin?: GeoPoint }) {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { pxPerKm, project } = makeProjector(center, zoom);
  const moscow = project(CITY_CENTER.lat, CITY_CENTER.lng);
  const me = origin ? project(origin.lat, origin.lng) : { x: 0, y: 0 };
  const SIZE = 9000;
  const half = SIZE / 2;

  return (
    <div
      className="absolute inset-0 touch-none overflow-hidden bg-[#EFEBE3]"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {/* начало координат схемы — центр экрана */}
      <div className="absolute left-1/2 top-[44%]" style={{ width: 0, height: 0, transform: `translate(${off.x}px, ${off.y}px)` }}>
        <svg width={SIZE} height={SIZE} viewBox={`${-half} ${-half} ${SIZE} ${SIZE}`} className="absolute" style={{ left: -half, top: -half }} aria-hidden>
          {/* километровая сетка */}
          <g stroke="#E4DED2" strokeWidth="1">
            {Array.from({ length: 41 }).map((_, i) => {
              const v = (i - 20) * 10 * pxPerKm;
              return (
                <g key={i}>
                  <line x1={v} y1={-half} x2={v} y2={half} />
                  <line x1={-half} y1={v} x2={half} y2={v} />
                </g>
              );
            })}
          </g>
          {/* условный МКАД */}
          <circle cx={moscow.x} cy={moscow.y} r={17.5 * pxPerKm} fill="#F6F1E7" stroke="#FCE3A6" strokeWidth={Math.max(5, pxPerKm * 0.7)} />
          <circle cx={moscow.x} cy={moscow.y} r={4 * pxPerKm} fill="none" stroke="#FDEBC1" strokeWidth={Math.max(3, pxPerKm * 0.4)} />
          <text x={moscow.x} y={moscow.y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#9A9DA6" fontFamily="system-ui">
            Москва
          </text>
          <text x={moscow.x} y={moscow.y - 17.5 * pxPerKm - 8} textAnchor="middle" fontSize="11" fill="#B3B6BF" fontFamily="system-ui">
            МКАД (условно)
          </text>
          {/* округа — подписи на опорных точках (ориентир, не границы) */}
          {OKRUGS.filter((o) => o.id !== "cao").map((o) => {
            const q = project(o.lat, o.lng);
            return (
              <text key={o.id} x={q.x} y={q.y} textAnchor="middle" fontSize="11" fontWeight="700" fill="#C2BDB0" fontFamily="system-ui" letterSpacing="0.5">
                {o.short}
              </text>
            );
          })}
          {/* кольца расстояний от точки выезда */}
          {origin &&
            RINGS.map((km) => (
              <g key={km}>
                <circle cx={me.x} cy={me.y} r={km * pxPerKm} fill="none" stroke="#6AA8F5" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 6" />
                <text x={me.x + 6} y={me.y - km * pxPerKm - 4} fontSize="11" fontWeight="600" fill="#4F8FE0" fontFamily="system-ui">
                  {km} км
                </text>
              </g>
            ))}
        </svg>
        {children}
      </div>
      <span className="absolute bottom-[calc(var(--sheet-h,300px)+8px)] left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted">Упрощённая схема — без улиц</span>
    </div>
  );
}
