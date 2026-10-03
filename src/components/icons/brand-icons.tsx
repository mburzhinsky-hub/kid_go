import type { SVGProps } from "react";

/**
 * Фирменные залитые иконки (как в референсе): крупные, сочные, без тонких линий.
 * Цвет задаётся через currentColor, «пузырьковые» иконки — со своими градиентами.
 */
type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: "0 0 24 24", width: 24, height: 24, "aria-hidden": true, ...p });

export const IconStar = (p: P) => (
  <svg {...base(p)}>
    <path
      d="M12 2.9l2.7 5.5 6.05.88-4.38 4.27 1.03 6.03L12 16.74l-5.4 2.84 1.03-6.03L3.25 9.28l6.05-.88z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconTree = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 13.5h2V21h-2z" fill="currentColor" />
    <path d="M7.5 21h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M12 2.5c2.5 0 4.4 1.9 4.6 4.2 1.9.6 3.2 2.3 3.2 4.3 0 2.5-2 4.5-4.6 4.5H8.8c-2.6 0-4.6-2-4.6-4.5 0-2 1.3-3.7 3.2-4.3.2-2.3 2.1-4.2 4.6-4.2z"
      fill="currentColor"
    />
    <path d="M12 15.5v-5M12 12.5l-2.2-2M12 11.6l2-1.8" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".9" />
  </svg>
);

export const IconSlide = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 21V6.5M9 21V6.5M5 10h4M5 14h4M5 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 6.5c3.5 0 4.3 2.4 5.3 6 .9 3.3 2.3 6.4 5.7 8.2" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none" />
    <circle cx="7" cy="4.2" r="2.2" fill="currentColor" />
  </svg>
);

export const IconMuseum = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.4 21.5 7.3V9H2.5V7.3z" fill="currentColor" />
    <path d="M4.5 10.5h2.4v7.4H4.5zM9.2 10.5h2.4v7.4H9.2zM13.9 10.5h2.4v7.4h-2.4zM18.6 10.5H21v7.4h-2.4z" fill="currentColor" />
    <rect x="2.3" y="19" width="19.4" height="2.6" rx="1" fill="currentColor" />
  </svg>
);

export const IconWaves = (p: P) => (
  <svg {...base(p)} fill="none">
    {[6.5, 12, 17.5].map((y) => (
      <path
        key={y}
        d={`M2.5 ${y}c1.6 0 1.6-1.6 3.2-1.6S7.3 ${y} 8.9 ${y}s1.6-1.6 3.1-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.1 1.6`}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ))}
  </svg>
);

export const IconCafe = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 2.5v6.2c0 1.3.8 2.3 2 2.6V21a1.2 1.2 0 0 0 2.4 0V11.3c1.2-.3 2-1.3 2-2.6V2.5h-1.6v5.6H9V2.5H7.4v5.6H6.6V2.5z" fill="currentColor" />
    <path d="M18.8 2.6c-2.5.5-4.3 3.1-4.3 6.6v4.3h2.2V21a1.3 1.3 0 0 0 2.6 0V3.1c0-.3-.2-.6-.5-.5z" fill="currentColor" />
  </svg>
);

export const IconPaw = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="6" cy="10" rx="2.1" ry="2.7" fill="currentColor" />
    <ellipse cx="9.7" cy="5.8" rx="2.1" ry="2.8" fill="currentColor" />
    <ellipse cx="14.3" cy="5.8" rx="2.1" ry="2.8" fill="currentColor" />
    <ellipse cx="18" cy="10" rx="2.1" ry="2.7" fill="currentColor" />
    <path d="M12 11c2.4 0 5.6 4.1 5.6 6.6 0 2-1.6 2.9-3 2.9-1.3 0-1.7-.6-2.6-.6s-1.3.6-2.6.6c-1.4 0-3-.9-3-2.9C6.4 15.1 9.6 11 12 11z" fill="currentColor" />
  </svg>
);

export const IconBag = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.3 8V6.6a3.7 3.7 0 0 1 7.4 0V8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M4.6 7.3h14.8l1 12.4a1.8 1.8 0 0 1-1.8 2H5.4a1.8 1.8 0 0 1-1.8-2z" fill="currentColor" />
    <path d="M9 11.5c.4 1.6 1.6 2.5 3 2.5s2.6-.9 3-2.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);


export const IconRocket = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 3.2c2.6-.9 5.1-.8 6 .1.9.9 1 3.4.1 6-.8 2.3-2.6 4.7-5 6.6l.2 2.7c0 .4-.1.8-.4 1l-2.4 1.9a.7.7 0 0 1-1.1-.4l-.6-2.8-2.9-2.9-2.8-.6a.7.7 0 0 1-.4-1.1l1.9-2.4c.3-.3.6-.4 1-.4l2.7.2c1.9-2.4 4.3-4.2 6.6-5z" fill="currentColor" />
    <circle cx="16.2" cy="7.8" r="1.7" fill="#fff" />
    <path d="M6.6 15.4c-1.6.4-2.6 1.6-3 4.9 3.3-.4 4.5-1.4 4.9-3" fill="currentColor" opacity=".65" />
  </svg>
);

/* ───────────── Пузырьковые иконки (Подборки / сценарии) ───────────── */

function Grad({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

export const GlyphSun = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gs" from="#FFE15A" to="#FFA70A" />
      <radialGradient id="gsh" cx=".38" cy=".32" r=".7">
        <stop offset="0" stopColor="#FFF6C4" />
        <stop offset=".55" stopColor="#FFD23F" />
        <stop offset="1" stopColor="#FFA200" />
      </radialGradient>
    </defs>
    {Array.from({ length: 12 }).map((_, i) => (
      <rect key={i} x="22.6" y="3.2" width="2.8" height="7" rx="1.4" fill="url(#gs)" transform={`rotate(${i * 30} 24 24)`} />
    ))}
    <circle cx="24" cy="24" r="11.2" fill="url(#gsh)" />
    <circle cx="20" cy="20" r="3.2" fill="#fff" opacity=".45" />
  </svg>
);

export const GlyphRain = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gr" from="#4DB6FF" to="#0A6CFF" />
    </defs>
    <path d="M14.5 32.5c-4.4 0-8-3.3-8-7.6 0-3.9 3-7.1 6.9-7.5C14.7 12 19.2 8.5 24.6 8.5c5.9 0 10.8 4.4 11.4 10.1 3.4.4 6 3.2 6 6.7 0 4-3.3 7.2-7.4 7.2z" fill="url(#gr)" />
    <path d="M14 22.5c.6-3.6 3.7-6.6 7.6-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".5" fill="none" />
    {[16, 24, 32].map((x, i) => (
      <path key={x} d={`M${x} ${36 + (i % 2)}l-1.6 4.2`} stroke="#1E88FF" strokeWidth="2.6" strokeLinecap="round" />
    ))}
  </svg>
);

export const GlyphSmile = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <radialGradient id="gm" cx=".38" cy=".3" r=".8">
        <stop offset="0" stopColor="#FFE07A" />
        <stop offset=".6" stopColor="#FFB21E" />
        <stop offset="1" stopColor="#FF8A00" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="17" fill="url(#gm)" />
    <ellipse cx="18.5" cy="20.5" rx="2.1" ry="2.8" fill="#7A3E00" />
    <ellipse cx="29.5" cy="20.5" rx="2.1" ry="2.8" fill="#7A3E00" />
    <path d="M16.5 27.5c1.8 3.4 4.4 5 7.5 5s5.7-1.6 7.5-5" stroke="#7A3E00" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <circle cx="17" cy="14" r="3" fill="#fff" opacity=".35" />
  </svg>
);

export const GlyphPeople = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gp" from="#A970FF" to="#6417F5" />
      <Grad id="gp2" from="#C9A2FF" to="#8E4BFF" />
    </defs>
    <circle cx="30.5" cy="15" r="6.2" fill="url(#gp2)" />
    <path d="M20 37c0-6.6 4.7-11.5 10.5-11.5S41 30.4 41 37a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 20 37z" fill="url(#gp2)" />
    <circle cx="18" cy="16.5" r="7" fill="url(#gp)" />
    <path d="M5.5 38.5C5.5 31 11 25.6 18 25.6S30.5 31 30.5 38.5A2.7 2.7 0 0 1 27.8 41.2H8.2a2.7 2.7 0 0 1-2.7-2.7z" fill="url(#gp)" />
  </svg>
);

export const GlyphClock = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gc" from="#5BE38B" to="#13B04B" />
    </defs>
    <circle cx="24" cy="25" r="16" fill="url(#gc)" />
    <circle cx="24" cy="25" r="12" fill="#fff" />
    <path d="M24 17v8.5l5.5 3.4" stroke="#13A447" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="20" y="5" width="8" height="4" rx="2" fill="#13B04B" />
  </svg>
);

export const GlyphSparkle = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gk" from="#FF72B6" to="#FF1A8C" />
      <Grad id="gk2" from="#FFD54A" to="#FFA200" />
    </defs>
    <path d="M22 6c1.2 8.6 4.4 11.8 13 13-8.6 1.2-11.8 4.4-13 13-1.2-8.6-4.4-11.8-13-13 8.6-1.2 11.8-4.4 13-13z" fill="url(#gk)" />
    <path d="M36 27c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" fill="url(#gk2)" />
    <circle cx="10" cy="35" r="2.6" fill="#8E4BFF" />
  </svg>
);

export const GlyphTreeWalk = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gt" from="#6FE07A" to="#16A34A" />
    </defs>
    <rect x="22" y="27" width="4" height="14" rx="2" fill="#9A5B2E" />
    <path d="M24 5c5.6 0 9.9 4.2 10.3 9.3 4.2 1.3 7.2 5.1 7.2 9.5 0 5.6-4.5 10.1-10.2 10.1H16.7C11 33.9 6.5 29.4 6.5 23.8c0-4.4 3-8.2 7.2-9.5C14.1 9.2 18.4 5 24 5z" fill="url(#gt)" />
    <circle cx="18" cy="15" r="3" fill="#fff" opacity=".35" />
  </svg>
);

export const GlyphPizza = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gz" from="#FFD25A" to="#FF9E1B" />
    </defs>
    <path d="M7 12.5c11-6 23-6 34 0L24 42.5z" fill="url(#gz)" />
    <path d="M7 12.5c11-6 23-6 34 0l-2.2 3.8c-9.6-5-20-5-29.6 0z" fill="#E7742A" />
    <circle cx="20" cy="20" r="3" fill="#FF3B4E" />
    <circle cx="28.5" cy="23" r="2.7" fill="#FF3B4E" />
    <circle cx="23.5" cy="30" r="2.4" fill="#FF3B4E" />
  </svg>
);

export const GlyphGift = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gg" from="#FF6FA8" to="#F0157A" />
    </defs>
    <rect x="8" y="20" width="32" height="21" rx="4" fill="url(#gg)" />
    <rect x="6" y="14" width="36" height="9" rx="3" fill="#FF4F97" />
    <rect x="21.5" y="14" width="5" height="27" fill="#FFC21A" />
    <path d="M24 14c-3-6-10-7-10-2.5S21 14 24 14zm0 0c3-6 10-7 10-2.5S27 14 24 14z" fill="#FFC21A" />
  </svg>
);

export const GlyphHeart = (p: P) => (
  <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden {...p}>
    <defs>
      <Grad id="gh" from="#5BE38B" to="#13B04B" />
    </defs>
    <path d="M24 41s-15-8.8-15-20.2C9 15 13 11 17.8 11c2.8 0 5 1.4 6.2 3.6C25.2 12.4 27.4 11 30.2 11 35 11 39 15 39 20.8 39 32.2 24 41 24 41z" fill="url(#gh)" />
    <path d="M15 19c.4-2.4 2-4 4.2-4.3" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".55" fill="none" />
  </svg>
);

