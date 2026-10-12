"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Иллюстрация главного блока: объёмный извилистый маршрут с точками, кафе, деревьями, домиком и геометкой со звёздочкой.
 * Это настоящий SVG: дорога прорисовывается, объекты появляются по очереди, звёздочка вспыхивает последней;
 * потом спокойная фоновая жизнь (пульс звезды, лёгкое покачивание, редкий огонёк по дороге).
 * Стили и ключевые кадры — в globals.css (секция «Промоблок главной»). Без анимации (prefers-reduced-motion или без JS)
 * показывается готовая статичная картинка.
 *
 * Состояния (data-s на корне): pre — до запуска (на сервере), play — собирается, live — фоновая жизнь.
 * data-paused — блок не на экране или вкладка скрыта: анимации стоят, батарею не тратим.
 * data-go — нажали «Собрать наш день»: точки подсвечиваются и по дороге пробегает импульс (см. runRouteBurst).
 */

/** Центральная линия дороги в координатах viewBox 150×270. Начинается за нижним краем карточки, заканчивается у геометки. */
const ROAD = "M 70 300 C 70 272 118 266 118 238 C 118 213 42 209 42 184 C 42 159 114 155 114 130 C 114 107 98 103 98 80";

const star = (R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    return `${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`;
  }).join(" ");
const STAR = star(11.5, 5.6);

/** Объект на сцене: позиция + появление (--d — задержка в мс). Внутри — покачивание, они не мешают друг другу. */
function Piece({ x, y, d, s = 1, className = "", nd, children }: { x: number; y: number; d: number; s?: number; className?: string; nd?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={`kgr-piece ${className}`} style={{ ["--d" as string]: `${d}ms`, ...(nd === undefined ? null : { ["--nd" as string]: `${nd}ms` }) }}>
        {children}
      </g>
    </g>
  );
}

function Cloud({ x, y, s = 1, d, hide }: { x: number; y: number; s?: number; d: number; hide?: boolean }) {
  return (
    <Piece x={x} y={y} s={s} d={d} className={`kgr-soft${hide ? " kgr-sm-hide" : ""}`}>
      <ellipse cx="2" cy="8" rx="23" ry="4.5" fill="#8E73F2" opacity=".14" />
      <g fill="url(#kgr-cloud)">
        <circle cx="-10" cy="0" r="8.5" />
        <circle cx="2" cy="-5.5" r="11" />
        <circle cx="14" cy="0" r="8" />
        <rect x="-18" y="-1" width="40" height="9.5" rx="4.75" />
      </g>
    </Piece>
  );
}

function Tree({ x, y, d, s = 1, sway = 0, hide }: { x: number; y: number; d: number; s?: number; sway?: number; hide?: boolean }) {
  return (
    <Piece x={x} y={y} s={s} d={d} className={hide ? "kgr-sm-hide" : ""}>
      <ellipse cx="1" cy="1.5" rx="9" ry="2.6" fill="#4C3AA8" opacity=".16" />
      <g className="kgr-sway" style={{ ["--sd" as string]: `${sway}ms` }}>
        <rect x="-1.8" y="-9" width="3.6" height="10" rx="1.6" fill="url(#kgr-trunk)" />
        <circle cx="0" cy="-19" r="10.5" fill="url(#kgr-leaf-d)" />
        <circle cx="-5" cy="-24" r="8.2" fill="url(#kgr-leaf)" />
        <circle cx="5.2" cy="-23" r="7.4" fill="url(#kgr-leaf)" />
        <circle cx="-3.2" cy="-27.4" r="2.6" fill="#fff" opacity=".28" />
      </g>
    </Piece>
  );
}

function Island({ x, y, rx, ry = rx * 0.38, d, children }: { x: number; y: number; rx: number; ry?: number; d: number; children?: React.ReactNode }) {
  const t = 6;
  return (
    <Piece x={x} y={y} d={d}>
      <ellipse cx="0" cy={t + 5} rx={rx + 4} ry={ry + 1} fill="#7C5CF0" opacity=".13" />
      <ellipse cx="0" cy={t} rx={rx} ry={ry} fill="#D6CCF7" />
      <rect x={-rx} y="0" width={rx * 2} height={t} fill="#D6CCF7" />
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="url(#kgr-plate)" />
      {children}
    </Piece>
  );
}

function Node({ x, y, c, i }: { x: number; y: number; c: "g" | "o" | "b"; i: number }) {
  const delays = [600, 830, 1080];
  return (
    <Piece x={x} y={y} d={delays[i]} nd={[30, 110, 190][i]} className="kgr-node">
      <circle cx="0" cy="3" r="9" fill="#5B3FD9" opacity=".22" />
      <circle cx="0" cy="0" r="9" fill="url(#kgr-ring)" />
      <circle cx="0" cy="0" r="5.4" fill={`url(#kgr-n-${c})`} />
      <circle cx="-1.7" cy="-2" r="1.7" fill="#fff" opacity=".75" />
    </Piece>
  );
}

export function RouteArt() {
  return (
    <svg className="kgr-art" viewBox="0 0 150 270" preserveAspectRatio="xMaxYMid meet" aria-hidden focusable="false">
      <defs>
        <linearGradient id="kgr-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D5C9FF" />
          <stop offset="1" stopColor="#A586FF" />
        </linearGradient>
        <linearGradient id="kgr-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#EFEAFF" />
        </linearGradient>
        <linearGradient id="kgr-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#ECE7FF" />
        </linearGradient>
        <linearGradient id="kgr-trunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C58B5C" />
          <stop offset="1" stopColor="#8F5E3A" />
        </linearGradient>
        <radialGradient id="kgr-leaf" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#8BEDA6" />
          <stop offset="1" stopColor="#2FB765" />
        </radialGradient>
        <radialGradient id="kgr-leaf-d" cx=".4" cy=".3" r=".85">
          <stop offset="0" stopColor="#47C978" />
          <stop offset="1" stopColor="#1F9A52" />
        </radialGradient>
        <radialGradient id="kgr-ring" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#E6DFFF" />
        </radialGradient>
        <radialGradient id="kgr-n-g" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#7BE79C" />
          <stop offset="1" stopColor="#1FAF55" />
        </radialGradient>
        <radialGradient id="kgr-n-o" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#FFC261" />
          <stop offset="1" stopColor="#FF8A1F" />
        </radialGradient>
        <radialGradient id="kgr-n-b" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#7CC3FF" />
          <stop offset="1" stopColor="#2F7BFF" />
        </radialGradient>
        <linearGradient id="kgr-pin" x1=".15" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor="#FF86B8" />
          <stop offset=".45" stopColor="#FF3D8E" />
          <stop offset="1" stopColor="#D80F6C" />
        </linearGradient>
        <linearGradient id="kgr-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#FFE3EF" />
        </linearGradient>
        <radialGradient id="kgr-pad" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FF4F9C" stopOpacity=".5" />
          <stop offset="1" stopColor="#FF4F9C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="kgr-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".5" stopColor="#FFD1E6" stopOpacity=".55" />
          <stop offset="1" stopColor="#FF8CC0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kgr-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE7B0" />
          <stop offset="1" stopColor="#FFC25E" />
        </linearGradient>
        <linearGradient id="kgr-cup" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#F1E6DA" />
        </linearGradient>
        <radialGradient id="kgr-pond" cx=".4" cy=".3" r=".9">
          <stop offset="0" stopColor="#9BDCFF" />
          <stop offset="1" stopColor="#3FA7F5" />
        </radialGradient>
        <linearGradient id="kgr-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B8F0B5" />
          <stop offset="1" stopColor="#7FDB8B" />
        </linearGradient>
        <mask id="kgr-dash-mask" maskUnits="userSpaceOnUse" x="-20" y="0" width="190" height="320">
          <path d={ROAD} pathLength={1} className="kgr-draw" fill="none" stroke="#fff" strokeWidth="8" />
        </mask>
      </defs>

      {/* облака */}
      <Cloud x={36} y={108} s={0.85} d={260} hide />

      {/* дорога: тень → толщина → светлая кромка → поверхность → разметка */}
      <g fill="none" strokeLinecap="butt" strokeLinejoin="round" pathLength={1}>
        <path d={ROAD} pathLength={1} className="kgr-draw kgr-d1" stroke="#6B4DEB" strokeOpacity=".1" strokeWidth="36" transform="translate(0 8)" />
        <path d={ROAD} pathLength={1} className="kgr-draw kgr-d1" stroke="#6B4DEB" strokeOpacity=".14" strokeWidth="30" transform="translate(0 6.5)" />
        <path d={ROAD} pathLength={1} className="kgr-draw kgr-d1" stroke="#7253E6" strokeWidth="25" transform="translate(0 5)" />
        <path d={ROAD} pathLength={1} className="kgr-draw kgr-d1" stroke="#EDE7FF" strokeWidth="27.5" />
        <path d={ROAD} pathLength={1} className="kgr-draw kgr-d1" stroke="url(#kgr-road)" strokeWidth="24" />
        <path d={ROAD} className="kgr-dashes" stroke="#fff" strokeOpacity=".92" strokeWidth="2.4" strokeDasharray="6 7.5" strokeLinecap="round" mask="url(#kgr-dash-mask)" />
      </g>

      {/* огонёк, который изредка бежит по дороге, и яркий импульс при нажатии */}
      <g fill="none" strokeLinecap="round" pathLength={1}>
        <path d={ROAD} pathLength={1} className="kgr-run" stroke="#fff" strokeOpacity=".5" strokeWidth="13" strokeDasharray="0.0001 3" />
        <path d={ROAD} pathLength={1} className="kgr-run" stroke="#fff" strokeWidth="5.2" strokeDasharray="0.0001 3" />
        <path d={ROAD} pathLength={1} className="kgr-burst" stroke="#fff" strokeWidth="24" strokeLinecap="butt" strokeDasharray="0.2 3" />
        <path d={ROAD} pathLength={1} className="kgr-burst" stroke="#FF4F9C" strokeOpacity=".7" strokeWidth="9" strokeLinecap="round" strokeDasharray="0.16 3" />
      </g>

      {/* деревце у нижнего края */}
      <Tree x={139} y={265} d={500} s={0.62} sway={0} />

      {/* точки маршрута */}
      <Node x={118} y={238} c="g" i={0} />
      <Node x={42} y={184} c="o" i={1} />
      <Node x={114} y={130} c="b" i={2} />

      {/* кафе у второй точки */}
      <Piece x={121} y={190} d={740} s={0.9} className="kgr-cafe">
        <ellipse cx="4" cy="24" rx="27" ry="5" fill="#4C3AA8" opacity=".14" />
        <polygon points="14,-6 25,-11 25,18 14,23" fill="#F2A94B" />
        <rect x="-17" y="-6" width="31" height="29" rx="1.5" fill="url(#kgr-wall)" />
        <polygon points="-17,-6 14,-6 25,-11 -6,-11" fill="#FFF1CC" />
        <g>
          <rect x="-17" y="-6" width="7.75" height="8" fill="#F4575D" />
          <rect x="-9.25" y="-6" width="7.75" height="8" fill="#fff" />
          <rect x="-1.5" y="-6" width="7.75" height="8" fill="#F4575D" />
          <rect x="6.25" y="-6" width="7.75" height="8" fill="#fff" />
          <polygon points="14,-6 25,-11 25,-3 14,2" fill="#E14248" />
        </g>
        <rect x="-5" y="8" width="11" height="15" rx="1.5" fill="#6C5BD8" />
        <rect x="-3.4" y="9.6" width="3.2" height="12" rx=".8" fill="#fff" opacity=".28" />
        <rect x="-15" y="9" width="8" height="8" rx="1.4" fill="#BFE6FF" />
        <rect x="9" y="9" width="3.5" height="8" rx="1" fill="#BFE6FF" />
        <g className="kgr-sway" style={{ ["--sd" as string]: "300ms" }}>
          <path d="M -2 -23 L 0.5 -11 L 14 -11 L 16.5 -23 Z" fill="url(#kgr-cup)" />
          <ellipse cx="7.25" cy="-23" rx="9.3" ry="3.3" fill="#F7EEE4" />
          <ellipse cx="7.25" cy="-23" rx="7.4" ry="2.4" fill="#C98A56" />
          <ellipse cx="7.25" cy="-23.4" rx="4.2" ry="1.2" fill="#EBD0A6" />
          <path d="M 16.2 -21 q 6.2 0.6 3.8 6.4 q -1.4 2.8 -5.2 2.4" fill="none" stroke="#FF6F61" strokeWidth="2.3" strokeLinecap="round" />
        </g>
      </Piece>

      {/* домик и дерево у верхней части маршрута */}
      <Piece x={34} y={140} d={960} s={0.9} className="kgr-house kgr-sm-hide">
        <ellipse cx="2" cy="16.5" rx="16" ry="3.6" fill="#4C3AA8" opacity=".14" />
        <polygon points="9,-2 15,-5 15,13 9,16" fill="#F2A94B" />
        <rect x="-9" y="-2" width="18" height="18" rx="1.2" fill="url(#kgr-wall)" />
        <polygon points="-12.5,-1.5 0,-14 12.5,-1.5" fill="#FF8A3D" />
        <polygon points="0,-14 12.5,-1.5 17,-3.5 4.5,-16" fill="#E96F26" />
        <rect x="-2.6" y="6" width="5.2" height="10" rx="1" fill="#4A90FF" />
        <rect x="-8" y="3" width="4.2" height="4.2" rx=".8" fill="#BFE6FF" />
        <rect x="3.8" y="3" width="4.2" height="4.2" rx=".8" fill="#BFE6FF" />
      </Piece>
      <Tree x={80} y={122} d={1120} s={0.7} sway={400} hide />

      {/* геометка со звёздочкой: цель маршрута */}
      <Piece x={98} y={82} d={1300} className="kgr-pinbase">
        <ellipse cx="0" cy="3" rx="26" ry="8" fill="url(#kgr-pad)" />
        <ellipse cx="0" cy="3.5" rx="14" ry="4.2" fill="#7B5CF0" opacity=".2" />
        <ellipse cx="0" cy="1" rx="14" ry="4.2" fill="#fff" />
        <ellipse cx="0" cy="1" rx="14" ry="4.2" fill="none" stroke="#FF8CC0" strokeWidth="1.2" opacity=".8" />
      </Piece>
      <Piece x={98} y={76} d={1400} className="kgr-pinpiece">
        <g className="kgr-pin">
          <path d="M0 0 C-6 -8 -19.5 -19 -19.5 -34 A19.5 19.5 0 1 1 19.5 -34 C19.5 -19 6 -8 0 0Z" fill="url(#kgr-pin)" />
          <path d="M-13.5 -43 A15.5 15.5 0 0 1 -1 -52" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="0" cy="-34" r="23" fill="url(#kgr-glow)" className="kgr-flash" />
          <g transform="translate(0 -34)">
            <g className="kgr-piece kgr-starpiece" style={{ ["--d" as string]: "1850ms" }}>
              <g className="kgr-star">
                <polygon points={STAR} transform="translate(0 2)" fill="#B10B58" opacity=".35" stroke="#B10B58" strokeWidth="3.6" strokeLinejoin="round" />
                <polygon points={STAR} fill="url(#kgr-star)" stroke="url(#kgr-star)" strokeWidth="3.6" strokeLinejoin="round" />
              </g>
            </g>
          </g>
          <g className="kgr-piece kgr-sparkpiece" style={{ ["--d" as string]: "1950ms" }} fill="none" stroke="#FFC81F" strokeWidth="3" strokeLinecap="round">
            <path d="M -28 -60 L -23 -53" />
            <path d="M -34 -45 L -27 -42" />
            <path d="M 28 -62 L 23 -55" />
          </g>
        </g>
      </Piece>
    </svg>
  );
}

/* ───── Запуск и пауза анимации ───── */

type Phase = "pre" | "play" | "live";
/** Один раз за сессию: при возврате на главную блок уже собран, без повторной «сборки». */
let introPlayed = false;

/** Запускает «сборку» блока, когда он на экране и заставка первого захода (html[data-first]) убрана; ставит на паузу вне экрана. */
export function useRouteAnimation() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (introPlayed ? "live" : "pre"));

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPhase("live");
      return;
    }
    const html = document.documentElement;
    let visible = false;
    let timer = 0;
    let started = introPlayed;

    const sync = () => {
      const on = visible && !document.hidden;
      if (on) el.removeAttribute("data-paused");
      else el.setAttribute("data-paused", "");
      if (on && !started && !html.hasAttribute("data-first")) {
        started = true;
        introPlayed = true;
        setPhase("play");
        timer = window.setTimeout(() => setPhase("live"), 3100);
      }
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      sync();
    });
    io.observe(el);
    const mo = new MutationObserver(sync);
    mo.observe(html, { attributes: true, attributeFilter: ["data-first"] });
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.clearTimeout(timer);
    };
  }, []);

  return { ref, phase };
}

/** Короткий импульс по маршруту при нажатии (≈ 320 мс). Навигацию не задерживает: вызывается параллельно с переходом. */
export function runRouteBurst(el: HTMLElement | null) {
  if (!el) return;
  el.removeAttribute("data-go");
  void el.getBoundingClientRect(); // перезапуск анимации, если нажали повторно
  el.setAttribute("data-go", "");
  window.setTimeout(() => el.removeAttribute("data-go"), 420);
}
