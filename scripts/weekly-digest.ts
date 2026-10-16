/**
 * Черновик пятничной подборки «куда сходить в выходные» из данных каталога.
 *   npm run digest                     — ближайшая суббота и воскресенье (по Москве)
 *   npm run digest -- 2026-10-24       — суббота, от которой считать выходные
 *   npm run digest -- 2026-10-24 --src=vk   — метка источника в ссылках (по умолчанию tg)
 *
 * Берёт только то, что подтверждено на официальном сайте места: режим работы (verified_fields: opening_hours)
 * и цену (verified_fields: price). Неподтверждённую цену не показывает вовсе. Место, закрытое и в субботу, и в воскресенье, не попадает.
 * Это черновик для редактора: текст поста пишется вручную, скрипт даёт факты, ссылки и даты сверки.
 */
import { places } from "../src/lib/data/places";
import { auditForPlace } from "../src/lib/data/source-audit";
import { landingBySlug, verifiedFacts, landingHref } from "../src/lib/landings";
import { placeHref } from "../src/lib/place-href";
import type { Place } from "../src/lib/types";

const SITE = "https://kids-go.fun";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const args = process.argv.slice(2);
const srcArg = args.find((a) => a.startsWith("--src="))?.slice(6) ?? "tg";
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

/** Суббота выходных: заданная аргументом либо ближайшая (сегодня, если суббота; воскресенье — вчерашняя). Считаем по Москве. */
function saturday(): Date {
  if (dateArg) {
    const d = new Date(`${dateArg}T00:00:00Z`);
    if (d.getUTCDay() !== 6) {
      console.error(`${dateArg} — не суббота`);
      process.exit(1);
    }
    return d;
  }
  const todayMsk = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const d = new Date(`${todayMsk}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 вс … 6 сб
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -1 : 6 - dow));
  return d;
}

const sat = saturday();
const sun = new Date(sat.getTime() + 86400000);
const label =
  sat.getUTCMonth() === sun.getUTCMonth()
    ? `${sat.getUTCDate()}–${sun.getUTCDate()} ${MONTHS[sat.getUTCMonth()]}`
    : `${sat.getUTCDate()} ${MONTHS[sat.getUTCMonth()]} – ${sun.getUTCDate()} ${MONTHS[sun.getUTCMonth()]}`;
const campaign = `week-${sat.toISOString().slice(0, 10)}`;
const utm = `utm_source=${srcArg}&utm_medium=social&utm_campaign=${campaign}`;
const link = (path: string) => `${SITE}${path.endsWith("/") ? path : `${path}/`}?${utm}`;

const has = (p: Place, f: "price" | "opening_hours") => (p.verified_fields ?? []).includes(f);
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** Часы на субботу и воскресенье строкой; null — место закрыто оба дня. */
function weekendHours(p: Place): string | null {
  const [s, v] = [p.opening_hours[5], p.opening_hours[6]];
  if (!s && !v) return null;
  const t = (h: NonNullable<typeof s>) => (h[0] === "00:00" && h[1] === "24:00" ? "круглосуточно" : `${h[0]}–${h[1]}`);
  if (s && v) return s[0] === v[0] && s[1] === v[1] ? `сб и вс ${t(s)}` : `сб ${t(s)}, вс ${t(v)}`;
  return s ? `только сб ${t(s)}` : `только вс ${t(v!)}`;
}

interface Section {
  title: string;
  landing: string;
  limit: number;
  /** Дополнительное условие к правилу подборки. */
  only?: (p: Place) => boolean;
}

const SECTIONS: Section[] = [
  { title: "Под крышей в Москве", landing: "v-dozhd", limit: 6 },
  { title: "На день за город", landing: "v-podmoskovye", limit: 5, only: (p) => p.indoor },
  { title: "С малышом 1–2 года", landing: "s-malyshom-1-2-goda", limit: 4 },
  { title: "Школьникам 7–10 лет", landing: "s-shkolnikom-7-10-let", limit: 5 },
];

const trust = (p: Place) => (has(p, "price") ? 2 : 0) + (p.is_hit ? 1 : 0) + (p.rating >= 4.5 ? 1 : 0);
let oldest = "9999-99-99";
let newest = "0000-00-00";

console.log(`ВЫХОДНЫЕ ${label.toUpperCase()}  (utm: ${utm})\n`);

for (const sec of SECTIONS) {
  const l = landingBySlug(sec.landing);
  if (!l) throw new Error(`нет подборки ${sec.landing}`);
  const rows = places
    .filter((p) => !p.slug.startsWith("osm-") && has(p, "opening_hours") && weekendHours(p) && l.fit(p) != null && (sec.only?.(p) ?? true))
    .map((p) => ({ p, s: (l.fit(p) as number) + trust(p) }))
    .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title, "ru"))
    .slice(0, sec.limit);

  console.log(`## ${sec.title} — ${link(landingHref(l))}`);
  if (!rows.length) console.log("   (нет подтверждённых мест)");
  for (const { p } of rows) {
    const price = verifiedFacts(p).price;
    const checked = auditForPlace(p.slug)?.checked_at;
    if (checked) {
      if (checked < oldest) oldest = checked;
      if (checked > newest) newest = checked;
    }
    const where = p.region === "mo" ? `${p.town ?? "Подмосковье"}` : (p.metro ? `м. ${p.metro}` : p.town ?? "");
    const parts = [weekendHours(p), price, `${p.age_min}–${p.age_max} лет`, where, p.booking_required ? "лучше записаться" : "", checked ? `сверено ${dm(checked)}` : ""];
    console.log(`• ${p.title} — ${parts.filter(Boolean).join(" · ")}\n  ${link(placeHref(p))}`);
  }
  console.log("");
}

if (newest !== "0000-00-00") {
  console.log(`Данные сверены с сайтами мест: с ${dm(oldest)} по ${dm(newest)}. В пост — оговорка: «Часы и цены сверены с сайтами музеев, перед выездом проверьте».`);
}
