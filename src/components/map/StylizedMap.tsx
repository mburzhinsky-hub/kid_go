"use client";

import { useRef, useState } from "react";

/**
 * Иллюстрированная карта Москвы — запасной вариант, когда тайлы недоступны
 * (офлайн, нет WebGL, блокировка). Стилистика повторяет референс:
 * бежевая земля, зелёные парки, жёлтые кольца, голубая река.
 */
const W = 880;
const H = 1240;
const C = { lat: 55.735, lng: 37.6 };
const K = 3100; // px на градус широты
const S = 2; // масштаб декоративных фигур

export function project(lat: number, lng: number) {
  return {
    x: W / 2 + (lng - C.lng) * K * Math.cos((C.lat * Math.PI) / 180),
    y: H / 2 - (lat - C.lat) * K,
  };
}

export function StylizedMap({ children, zoom = 1 }: { children: React.ReactNode; zoom?: number }) {
  const [off, setOff] = useState({ x: 20, y: -10 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const centre = project(55.7558, 37.6176);
  const ring = (r: number) => <circle cx={centre.x} cy={centre.y} r={r} fill="none" />;

  return (
    <div
      className="absolute inset-0 touch-none overflow-hidden"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setOff({ x: Math.max(-300 * zoom, Math.min(300 * zoom, d.ox + e.clientX - d.x)), y: Math.max(-420 * zoom, Math.min(380 * zoom, d.oy + e.clientY - d.y)) });
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: W * zoom, height: H * zoom, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`, transition: drag.current ? undefined : "width .3s, height .3s" }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width={W * zoom} height={H * zoom} className="absolute inset-0" aria-hidden>
          <rect width={W} height={H} fill="#EFEBE3" />
          {/* парки */}
          <g fill="#D3ECC3" transform={`scale(${S})`}>
            <path d="M268 160c30-18 70-10 82 14 10 22-8 44-34 50-30 6-62-6-66-28-2-14 6-26 18-36z" />
            <path d="M210 120c20-10 44-4 50 12s-8 30-28 32-34-6-36-20 4-18 14-24z" />
            <path d="M40 300c26-24 70-22 84 4s-6 56-40 60-58-8-62-30 6-22 18-34z" />
            <path d="M170 470c22-12 52-6 58 12 8 22-12 40-36 40s-40-14-38-30 6-16 16-22z" />
            <path d="M300 520c30-10 64 4 66 28s-26 40-54 36-40-22-34-40c4-12 12-20 22-24z" />
            <path d="M120 600c26-8 56 4 58 22s-22 34-46 32-38-16-34-32c2-10 10-18 22-22z" />
            <path d="M330 300c18-8 40 0 42 16s-14 26-30 26-28-10-26-22c1-10 6-16 14-20z" />
          </g>
          {/* река */}
          <path
            transform={`scale(${S})`}
            d="M-10 330c40 10 70 40 110 30s50-50 90-40 40 60 80 70 60-30 90-10 30 70 10 100-60 30-70 70 30 60 20 100-60 40-80 100"
            fill="none"
            stroke="#BFE1F6"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* кольца */}
          <g stroke="#FCE3A6" strokeWidth="7">
            {ring(62)}
            {ring(126)}
          </g>
          <g stroke="#FDEBC1" strokeWidth="9">{ring(330)}</g>
          {/* радиальные улицы */}
          <g stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * Math.PI) / 6 + 0.2;
              return <line key={i} x1={centre.x + Math.cos(a) * 30} y1={centre.y + Math.sin(a) * 30} x2={centre.x + Math.cos(a) * 700} y2={centre.y + Math.sin(a) * 700} />;
            })}
          </g>
          <g fill="#A3A6AF" fontSize="15" fontWeight="600" fontFamily="system-ui">
            <text x={centre.x - 30} y={centre.y + 6} fontSize="20" fill="#9A9DA6">
              Москва
            </text>
            <text x={centre.x - 60} y={centre.y - 230}>САО</text>
            <text x={centre.x + 200} y={centre.y - 90}>ВАО</text>
            <text x={centre.x + 10} y={centre.y + 300}>ЮАО</text>
            <text x={centre.x - 260} y={centre.y + 40}>ЗАО</text>
          </g>
        </svg>
        {children}
      </div>
      <span className="absolute bottom-[calc(var(--sheet-h,300px)+8px)] left-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-muted">
        Офлайн-карта · без подложки
      </span>
    </div>
  );
}
