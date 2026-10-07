import type { Forecast } from "@/lib/forecast";
import { daySummary } from "@/lib/forecast";
import { DAY_TEMP } from "@/lib/school-calendar";
import type { HomeCtx, ScenarioCtx } from "@/lib/scenarios";

export interface HomeCtxArgs {
  /** Минуты от полуночи по Москве. */
  nowMin: number;
  /** 0 — понедельник. */
  weekday: number;
  /** Московская дата ISO для сегодня (0) и завтра (1). */
  dateOf: (offset: 0 | 1) => string;
  forecast?: Forecast;
  kids: { age: number; interests: readonly string[] }[];
  region: boolean;
}

/** Контекст главной: сегодня и завтра (погода, день недели, дата, семья). Общий для главной и для аудитов. */
export function buildHomeCtx(a: HomeCtxArgs): HomeCtx {
  const ages = a.kids.map((k) => k.age);
  const one = (off: 0 | 1): ScenarioCtx => {
    const dateISO = a.dateOf(off);
    const sum = a.forecast ? daySummary(a.forecast, dateISO) : undefined;
    const w = sum?.window;
    return {
      weekday: (a.weekday + off) % 7,
      hour: off ? 10 : Math.floor(a.nowMin / 60),
      month: Number(dateISO.slice(5, 7)),
      day: Number(dateISO.slice(8, 10)),
      rainAllDay: !!sum?.allWet,
      rainLater: !!sum?.rainFrom && !sum.allWet,
      snow: w?.condition === "snow",
      cold: !!w && w.feelsMax < DAY_TEMP.cold,
      hot: !!w && w.feelsMax >= DAY_TEMP.hot,
      sunny: !!w && w.condition === "sun",
      warm: !!w && w.tempMax >= DAY_TEMP.warm,
      kidsCount: a.kids.length,
      youngest: ages.length ? Math.min(...ages) : 5,
      oldest: ages.length ? Math.max(...ages) : 5,
      interests: a.kids.flatMap((k) => [...k.interests]),
      region: a.region,
    };
  };
  return { today: one(0), tomorrow: one(1), nowMin: a.nowMin };
}
