import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Weather } from "@/lib/types";
import { GlyphRain, GlyphSun } from "@/components/icons/brand-icons";

/** Погодный контекст: в плохую погоду сразу предлагаем идеи под крышей. */
export function WeatherBanner({ weather }: { weather: Weather }) {
  const bad = weather.condition === "rain" || weather.condition === "snow";
  const temp = `${weather.temp > 0 ? "+" : ""}${weather.temp}°`;
  return (
    <Link
      href={bad ? "/planner/results?mood=surprise&duration=mid&weather=rain&from=weather" : "/planner/results?mood=outdoor&duration=mid&weather=sun&from=weather"}
      className="press mx-4 flex items-center gap-3 rounded-[20px] px-3 py-2.5"
      style={{ background: bad ? "linear-gradient(100deg,#E2EEFF,#EEE5FE)" : "linear-gradient(100deg,#FFF3D6,#FFE9F3)" }}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/70">
        {bad ? <GlyphRain width={36} height={36} /> : <GlyphSun width={36} height={36} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight">
          Сегодня {temp}, {weather.label}
        </span>
        <span className="block text-[13px] leading-tight text-ink-2">
          {bad ? "Собрали идеи под крышей — без мокрых ботинок" : "Отличный день, чтобы гулять — идеи на воздухе"}
        </span>
      </span>
      <ArrowRight size={20} className="shrink-0 text-ink-2" />
    </Link>
  );
}
