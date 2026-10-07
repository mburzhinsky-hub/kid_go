import type { GeoPoint, Weather } from "@/lib/types";
import { getWeather } from "@/lib/weather";

/**
 * Почасовой прогноз. Источник — Open-Meteo (без ключа, CORS открыт, работает и со статики).
 * Нет сети / сервис недоступен → демо-прогноз с честной пометкой source: "demo".
 * Для проверки: ?wx=rain | rain15 | sun | cold | heat | snow (тестовые сценарии погоды).
 */

export interface HourWx {
  /** "2026-10-03T14:00" — местное время Москвы */
  time: string;
  temp: number;
  feels: number;
  /** вероятность осадков, % */
  pop: number;
  /** осадки, мм/ч */
  precip: number;
  /** WMO weather code */
  code: number;
  /** порывы ветра, м/с */
  gust: number;
  uv: number;
}

export interface Forecast {
  source: "open-meteo" | "demo";
  fetchedAt: number;
  lat: number;
  lng: number;
  hours: HourWx[];
  /** Сценарий для теста (?wx=…) */
  scenario?: string;
}

export type WxScenario = "rain" | "rain15" | "sun" | "cold" | "heat" | "snow";
export const WX_SCENARIOS: WxScenario[] = ["rain", "rain15", "sun", "cold", "heat", "snow"];

/* ───────── даты по Москве ───────── */

const MSK_OFFSET_MIN = 180;

/** "YYYY-MM-DD" для сегодня + offset дней по Москве. */
export function moscowDateISO(offset = 0, now = new Date()): string {
  const d = new Date(now.getTime() + MSK_OFFSET_MIN * 60000 + offset * 86400000);
  return d.toISOString().slice(0, 10);
}

/** День недели (0 — понедельник) для даты "YYYY-MM-DD". */
export function weekdayOf(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

/* ───────── загрузка ───────── */

const CACHE_MIN = 30;
const memory = new Map<string, Forecast>();
const keyOf = (p: GeoPoint) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

export async function fetchForecast(p: GeoPoint, signal?: AbortSignal): Promise<Forecast> {
  const key = keyOf(p);
  const hit = memory.get(key) ?? readCache(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_MIN * 60000) return hit;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lng.toFixed(3)}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_gusts_10m,uv_index` +
    `&timezone=Europe%2FMoscow&forecast_days=7&wind_speed_unit=ms`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const h = j.hourly;
    const hours: HourWx[] = h.time.map((t: string, i: number) => ({
      time: t,
      temp: Math.round(h.temperature_2m[i]),
      feels: Math.round(h.apparent_temperature[i]),
      pop: h.precipitation_probability?.[i] ?? 0,
      precip: h.precipitation?.[i] ?? 0,
      code: h.weather_code?.[i] ?? 0,
      gust: h.wind_gusts_10m?.[i] ?? 0,
      uv: h.uv_index?.[i] ?? 0,
    }));
    const f: Forecast = { source: "open-meteo", fetchedAt: Date.now(), lat: p.lat, lng: p.lng, hours };
    memory.set(key, f);
    writeCache(key, f);
    return f;
  } catch {
    // устаревший, но настоящий прогноз лучше выдуманного
    if (hit) return hit;
    return demoForecast(p);
  }
}

function readCache(key: string): Forecast | undefined {
  try {
    const raw = localStorage.getItem(`kidgo-wx:${key}`);
    return raw ? (JSON.parse(raw) as Forecast) : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(key: string, f: Forecast) {
  try {
    localStorage.setItem(`kidgo-wx:${key}`, JSON.stringify(f));
  } catch {
    /* приватный режим */
  }
}

/* ───────── демо-прогноз (офлайн / тесты) ───────── */

export function demoForecast(p: GeoPoint, scenario?: WxScenario, now = new Date()): Forecast {
  const hours: HourWx[] = [];
  for (let d = 0; d < 7; d++) {
    const date = moscowDateISO(d, now);
    const base = getWeather(new Date(now.getTime() + d * 86400000));
    for (let hh = 0; hh < 24; hh++) {
      const daily = Math.sin(((hh - 9) / 24) * Math.PI * 2) * 3; // теплее днём
      let temp = Math.round(base.temp + daily);
      let pop = base.condition === "rain" ? 75 : base.condition === "cloud" ? 25 : base.condition === "snow" ? 70 : 5;
      let code = base.condition === "rain" ? 61 : base.condition === "snow" ? 71 : base.condition === "cloud" ? 3 : 1;
      let gust = 6;
      let uv = hh >= 10 && hh <= 16 && base.condition === "sun" ? 3 : 1;
      if (scenario === "rain") [pop, code] = [85, 63];
      if (scenario === "sun") [pop, code, temp] = [5, 0, Math.max(temp, 17 + Math.round(daily))];
      if (scenario === "rain15") [pop, code, temp] = hh >= 15 ? [80, 63, 13] : [10, 2, 15 + Math.round(daily)];
      if (scenario === "cold") [pop, code, temp, gust] = [10, 1, -14 + Math.round(daily), 8];
      if (scenario === "heat") [pop, code, temp, uv] = [5, 0, 31 + Math.round(daily), hh >= 11 && hh <= 16 ? 8 : 3];
      if (scenario === "snow") [pop, code, temp] = [80, 73, -3];
      const wind = gust > 10 ? 4 : 2;
      hours.push({
        time: `${date}T${String(hh).padStart(2, "0")}:00`,
        temp,
        feels: temp - wind,
        pop,
        precip: pop >= 60 ? 1.2 : 0,
        code,
        gust,
        uv,
      });
    }
  }
  return { source: "demo", fetchedAt: Date.now(), lat: p.lat, lng: p.lng, hours, scenario };
}

/* ───────── чтение прогноза ───────── */

export function conditionOf(code: number, pop = 0): Weather["condition"] {
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (pop >= 60) return "rain";
  if (code >= 2) return "cloud";
  return "sun";
}

export const CONDITION_LABEL: Record<Weather["condition"], string> = {
  rain: "дождь",
  snow: "снег",
  cloud: "облачно",
  sun: "солнечно",
};

/** Снегопад (WMO 71–77, 85–86). */
const isSnowfall = (h: HourWx) => (h.code >= 71 && h.code <= 77) || h.code === 85 || h.code === 86;
const precipitating = (h: HourWx) => h.pop >= 60 || h.precip >= 0.5;
/**
 * Снег — не дождь: при умеренном морозе и без сильного ветра снегопад гулять не мешает (горки, каток, «первый снег»),
 * мешает только очень сильный. Без этой поправки в любой снегопад день считался «дождливым» и улица запрещалась целиком.
 */
export const isMildSnow = (h: HourWx) => isSnowfall(h) && h.precip < 2 && h.feels >= -12 && h.gust < 12;
/** Час, в который улица плоха из-за осадков. */
export const isWetHour = (h: HourWx) => precipitating(h) && !isMildSnow(h);

export interface WxWindow {
  tempMin: number;
  tempMax: number;
  feelsMin: number;
  feelsMax: number;
  popMax: number;
  precipMax: number;
  gustMax: number;
  uvMax: number;
  condition: Weather["condition"];
  /** часов в окне, данных нет — окно за пределами прогноза */
  empty: boolean;
  /** Осадки в окне есть, но это только умеренный снег — улицу он не закрывает. */
  snowOnly: boolean;
}

/** Погода в окне [from, to) минут от полуночи для даты. Берём худшее за окно. */
export function windowWx(f: Forecast, dateISO: string, from: number, to: number): WxWindow {
  const h0 = Math.floor(from / 60);
  const h1 = Math.max(h0, Math.ceil(to / 60) - 1);
  const hrs = f.hours.filter((h) => {
    if (!h.time.startsWith(dateISO)) return false;
    const hh = Number(h.time.slice(11, 13));
    return hh >= h0 && hh <= h1;
  });
  if (!hrs.length)
    return { tempMin: 0, tempMax: 0, feelsMin: 0, feelsMax: 0, popMax: 0, precipMax: 0, gustMax: 0, uvMax: 0, condition: "cloud", empty: true, snowOnly: false };
  const worst = hrs.reduce((a, b) => (severity(b) > severity(a) ? b : a));
  return {
    tempMin: Math.min(...hrs.map((h) => h.temp)),
    tempMax: Math.max(...hrs.map((h) => h.temp)),
    feelsMin: Math.min(...hrs.map((h) => h.feels)),
    feelsMax: Math.max(...hrs.map((h) => h.feels)),
    popMax: Math.max(...hrs.map((h) => h.pop)),
    precipMax: Math.max(...hrs.map((h) => h.precip)),
    gustMax: Math.max(...hrs.map((h) => h.gust)),
    uvMax: Math.max(...hrs.map((h) => h.uv)),
    condition: conditionOf(worst.code, worst.pop),
    empty: false,
    snowOnly: hrs.some(precipitating) && hrs.filter(precipitating).every(isMildSnow),
  };
}

const severity = (h: HourWx) => h.pop + h.precip * 30 + (h.code >= 51 ? 40 : 0);

/** Сводка дня для баннеров: днём (11–17), с «окнами» дождя. */
export function daySummary(f: Forecast, dateISO: string) {
  const w = windowWx(f, dateISO, 11 * 60, 17 * 60);
  const dayHours = f.hours.filter((h) => h.time.startsWith(dateISO)).filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    return hh >= 9 && hh <= 20;
  });
  const wet = isWetHour;
  const firstWet = dayHours.find(wet);
  const firstDryAfter = firstWet ? dayHours.find((h) => h.time > firstWet.time && !wet(h)) : undefined;
  const allWet = dayHours.length > 0 && dayHours.every(wet);
  const mid = dayHours.find((h) => h.time.endsWith("13:00")) ?? dayHours[0];
  const weather: Weather = {
    temp: mid?.temp ?? w.tempMax,
    condition: allWet ? (w.condition === "snow" ? "snow" : "rain") : firstWet ? "cloud" : w.condition,
    label: allWet ? CONDITION_LABEL[w.condition === "snow" ? "snow" : "rain"] : CONDITION_LABEL[w.condition === "rain" ? "cloud" : w.condition],
  };
  return {
    weather,
    window: w,
    allWet,
    rainFrom: firstWet ? firstWet.time.slice(11, 16) : undefined,
    dryFrom: firstDryAfter ? firstDryAfter.time.slice(11, 16) : undefined,
  };
}

/**
 * Насколько улица подходит в это окно: "ban" — нельзя ни при каком настроении,
 * число 0..1 — мягкая оценка. Пороги стартовые — уточнять по отзывам семей.
 */
export function outdoorVerdict(w: WxWindow, youngestAge: number): { ok: boolean; score: number; reason?: string } {
  if (w.empty) return { ok: true, score: 0.8 };
  const coldLimit = youngestAge < 3 ? -12 : -20;
  const falling = w.popMax >= 60 || w.precipMax >= 0.5;
  if (falling && !w.snowOnly) return { ok: false, score: 0, reason: w.condition === "snow" ? "снегопад" : "дождь" };
  if (w.gustMax >= 15) return { ok: false, score: 0, reason: "сильный ветер" };
  if (w.feelsMin < coldLimit) return { ok: false, score: 0, reason: "сильный мороз" };
  if (w.feelsMax >= 33 || (youngestAge < 3 && w.feelsMax >= 30)) return { ok: false, score: 0, reason: "жара" };
  let score = 1;
  if (w.popMax >= 30) score -= w.snowOnly ? 0.2 : 0.35;
  if (w.feelsMin < 0) score -= 0.25;
  if (w.feelsMin < -10) score -= 0.2;
  if (w.feelsMax > 27) score -= 0.3;
  if (w.uvMax >= 7) score -= 0.1;
  if (w.condition === "sun" && w.feelsMin >= 12 && w.feelsMax <= 25) score += 0.15;
  return { ok: true, score: Math.max(0.1, Math.min(1, score)) };
}

/** «Что взять» — по погоде дня и возрасту. */
export function bringList(w: WxWindow, youngestAge: number, hasOutdoor: boolean): string[] {
  const out: string[] = [];
  if (w.empty) return out;
  if (w.popMax >= 30) out.push(hasOutdoor ? "☂️ Дождевики и сменные носки" : "☂️ Зонт на дорогу");
  if (w.feelsMin <= 0) out.push("🧤 Шапки, варежки, тёплые штаны");
  else if (w.feelsMin <= 8 && hasOutdoor) out.push("🧥 Куртки потеплее — к вечеру прохладно");
  if (w.feelsMax >= 25 && hasOutdoor) out.push("🧢 Панамы и вода");
  if (w.uvMax >= 6 && hasOutdoor) out.push("🧴 Солнцезащитный крем");
  if (youngestAge < 3 && w.popMax >= 30) out.push("🍼 Дождевик на коляску");
  return out.slice(0, 3);
}
