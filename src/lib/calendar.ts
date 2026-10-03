import type { Plan } from "@/lib/types";
import { moscowDateISO } from "@/lib/forecast";
import { toMinutes } from "@/lib/format";

/** .ics с шагами дня — добавляется в Календарь iPhone одним тапом. */
export function planToICS(plan: Plan, dayOffset = 0, url?: string): string {
  const date = moscowDateISO(dayOffset).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const t = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KidGo//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  plan.stops.forEach((s, i) => {
    const from = toMinutes(s.start);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${plan.key}-${i}-${date}@kidgo`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Moscow:${date}T${t(from)}`,
      `DTEND;TZID=Europe/Moscow:${date}T${t(from + s.duration)}`,
      `SUMMARY:${esc(`${plan.emoji} ${s.place.title}`)}`,
      `LOCATION:${esc(s.place.address)}`,
      `GEO:${s.place.latitude};${s.place.longitude}`,
      `DESCRIPTION:${esc(`${plan.title} · шаг ${i + 1} из ${plan.stops.length}${s.travelToNext ? `\nДальше: ${s.travelToNext.minutes} мин в пути` : ""}${url ? `\n${url}` : ""}`)}`,
      ...(i === 0 ? ["BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:Через час выходим", "END:VALARM"] : []),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function downloadICS(plan: Plan, dayOffset = 0) {
  const ics = planToICS(plan, dayOffset, typeof location !== "undefined" ? location.href : undefined);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kidgo-${plan.key.slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
