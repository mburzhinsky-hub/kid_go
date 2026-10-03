import type { Weather } from "@/lib/types";

/**
 * Погода. MVP — детерминированный мок по дате (чтобы демо было стабильным),
 * интерфейс совместим с реальным провайдером (Open-Meteo / Яндекс.Погода):
 * заменить тело getWeather на fetch с revalidate: 1800.
 */
const MONTH_TEMP = [-7, -6, 0, 8, 15, 19, 22, 20, 14, 8, 1, -4];

export function getWeather(date = new Date(), override?: Weather["condition"]): Weather {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(date);
  const seed = [...ymd].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
  const month = Number(ymd.slice(5, 7)) - 1;
  const base = MONTH_TEMP[month];
  const temp = base + ((seed % 7) - 3);
  const cold = base <= 0;
  const conditions: Weather["condition"][] = cold ? ["snow", "cloud", "sun"] : ["rain", "cloud", "sun", "rain"];
  const condition = override ?? conditions[seed % conditions.length];
  const label =
    condition === "rain" ? "дождик" : condition === "snow" ? "снег" : condition === "cloud" ? "облачно" : "солнечно";
  return { temp, condition, label };
}

export const isBadWeather = (w: Weather) => w.condition === "rain" || w.condition === "snow" || w.temp < -10;
