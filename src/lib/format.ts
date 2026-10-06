import type { OpeningHours, Place } from "@/lib/types";

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/** «3 часа», «полтора часа» — для карточек, где важна лёгкость. */
export function formatDurationShort(min: number): string {
  const h = min / 60;
  if (min < 60) return `${min} мин`;
  const rounded = Math.round(h * 2) / 2;
  if (rounded === 1.5) return "1,5 часа";
  if (Number.isInteger(rounded)) return `${rounded} ${plural(rounded, "час", "часа", "часов")}`;
  return `${String(rounded).replace(".", ",")} ч`;
}

export function formatPrice(rub: number): string {
  return `${rub.toLocaleString("ru-RU").replace(/[\u00a0\u202f ]/g, "\u00a0")}\u00a0₽`;
}

export function formatBudget(rub: number): string {
  if (rub === 0) return "Бесплатно";
  return `≈ ${formatPrice(Math.round(rub / 100) * 100)}`;
}

export function priceLevelLabel(level: number): string {
  return level === 0 ? "Бесплатно" : "₽".repeat(level);
}

export function formatAge(min: number, max: number): string {
  if (min === 0 && max >= 12) return "0–12 лет";
  if (min === 0) return `до ${max} ${plural(max, "года", "лет", "лет")}`;
  if (max >= 12) return `от ${min} ${plural(min, "года", "лет", "лет")}`;
  return `${min}–${max} ${plural(max, "год", "года", "лет")}`;
}

export function formatAgeRange(min: number, max: number): string {
  return `${min}–${max} ${plural(max, "год", "года", "лет")}`;
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return String(n);
}

/**
 * Вход без билета: полностью бесплатное место либо парк/магазин, где платны только необязательные аттракционы и покупки.
 * Музей или зоопарк с «от 0 ₽» (льготы для малышей) бесплатным для семьи не считается.
 */
export function isFreeEntry(p: Pick<Place, "price_min" | "price_max" | "category">): boolean {
  return p.price_max === 0 || (p.price_min === 0 && (p.category === "park" || p.category === "shop"));
}

export function placePriceShort(p: Place): string {
  if (p.price_max === 0) return "бесплатно";
  if (p.price_min === 0) return `до ${formatPrice(p.price_max)}`;
  return `от ${formatPrice(p.price_min)}`;
}

/* ---------- время ---------- */

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** «Пн–Вс» / «Вт–Вс» и часы «10:00–22:00». */
export function scheduleSummary(hours: OpeningHours): { days: string; time: string } {
  const open = hours.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const first = hours[open[0]];
  const isAlways = first && first[0] === "00:00" && first[1] === "24:00";
  const days = open.length === 7 ? "Пн–Вс" : `${DAYS_SHORT[open[0]]}–${DAYS_SHORT[open[open.length - 1]]}`;
  return { days, time: isAlways ? "круглосуточно" : first ? `${first[0]}–${first[1]}` : "закрыто" };
}

/** Время в Москве — приложение городское, считаем по местному времени. */
export function moscowNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return { weekday: wd, minutes };
}

export type OpenState =
  | { open: true; closesAt: string; always: boolean }
  | { open: false; opensAt?: string; tomorrow?: boolean };

export function openState(hours: OpeningHours, date = new Date(), atMinutes?: number): OpenState {
  const { weekday, minutes: nowMin } = moscowNow(date);
  const minutes = atMinutes ?? nowMin;
  const today = hours[weekday];
  if (today) {
    const from = toMinutes(today[0]);
    const to = toMinutes(today[1]);
    if (minutes >= from && minutes < to)
      return { open: true, closesAt: today[1], always: today[0] === "00:00" && today[1] === "24:00" };
    if (minutes < from) return { open: false, opensAt: today[0] };
  }
  for (let i = 1; i <= 7; i++) {
    const d = hours[(weekday + i) % 7];
    if (d) return { open: false, opensAt: d[0], tomorrow: i === 1 };
  }
  return { open: false };
}

/** Открыто ли место весь интервал [from, from+duration]. */
export function isOpenDuring(hours: OpeningHours, weekday: number, from: number, duration: number) {
  const d = hours[weekday];
  if (!d) return false;
  return from >= toMinutes(d[0]) && from + duration <= toMinutes(d[1]);
}

const WEEKDAY_ACC = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
export function weekdayAccusative(date = new Date()) {
  return WEEKDAY_ACC[moscowNow(date).weekday];
}
