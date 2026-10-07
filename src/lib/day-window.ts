import type { DurationId } from "@/lib/types";
import { ceilTo } from "@/lib/format";

/** Сколько минут «хочется» на день каждой длины (для плана и для проверки, хватит ли сегодня времени). */
export const DURATION_MIN: Record<DurationId, number> = { short: 120, mid: 240, half: 330, day: 450 };

/** Позже этого начинать сегодняшний выход уже не предлагаем: с детьми после половины седьмого — поздно. */
const LATEST_START = 18 * 60 + 30;
/** Какую долю заявленной длины день должен сохранить, иначе «полдня» и «весь день» превращаются в пару часов. */
const KEEP = 0.6;

export interface DayStart {
  /** Когда можно начать сегодня (собраться и доехать — 40 минут, шаг 30 минут). */
  start: number;
  /** Сегодня уже не успеть — план строится на завтра. */
  tomorrow: boolean;
}

/**
 * Единое правило «сегодня или завтра» — для движка и для главной.
 * Главная по нему решает, какой день (его погоду и день недели) брать для каждого сценария: «Большая суббота» в субботу
 * после трёх часов — это уже воскресенье, «После садика» вечером — завтрашние 16:00, а «Вечер пятницы» в 17:30 — ещё сегодняшний.
 */
export function startToday(nowMin: number, duration: DurationId, c: { startAt?: number; endBy?: number } = {}): DayStart {
  const start = Math.max(ceilTo(nowMin + 40, 30), 10 * 60, c.startAt ?? 0);
  const end = Math.min(c.endBy ?? 21 * 60, 21 * 60);
  const need = Math.max(60, Math.round(DURATION_MIN[duration] * KEEP));
  return { start, tomorrow: start > LATEST_START || end - 15 - start < need };
}

/** С какого часа начинается завтрашний выход (для «часов» сценария на главной). */
export const tomorrowStart = (c: { startAt?: number } = {}) => Math.max(10 * 60 + 30, c.startAt ?? 0);
