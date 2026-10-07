import { cn } from "@/lib/cn";

const LETTERS = [
  { ch: "K", c: "#1DAA5A", r: -6, y: 1 },
  { ch: "i", c: "#FF9500", r: 4, y: 3 },
  { ch: "d", c: "#FF3B30", r: -3, y: 2 },
  { ch: "s", c: "#FFB800", r: 5, y: 2 },
  { ch: "G", c: "#4C4CF2", r: -4, y: 0, gap: true },
  { ch: "o", c: "#18B4E0", r: 6, y: 2 },
];

/** Логотип «Kids Go»: пухлые разноцветные буквы + солнечные лучики. */
export function Logo({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative inline-flex select-none items-end font-logo font-black leading-none", className)}
      style={{ fontSize: size, letterSpacing: "-0.03em" }}
      aria-label="Kids Go"
      role="img"
    >
      {LETTERS.map((l, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block"
          style={{
            color: l.c,
            marginLeft: l.gap ? "0.22em" : undefined,
            transform: `translateY(${l.y}px) rotate(${l.r}deg)`,
            textShadow: `0 2px 0 color-mix(in oklab, ${l.c} 75%, #000 25%)`,
            WebkitTextStroke: `0.5px ${l.c}`,
          }}
        >
          {l.ch}
        </span>
      ))}
      <svg aria-hidden viewBox="0 0 24 24" className="-ml-[0.05em] mb-[0.35em] h-[0.62em] w-[0.62em]">
        {[[-60, 0], [-25, 1], [10, 2]].map(([a], i) => (
          <rect key={i} x="10.5" y="1" width="3.4" height="7.2" rx="1.7" fill="#FFB800" transform={`rotate(${a} 4 20)`} />
        ))}
      </svg>
    </span>
  );
}
