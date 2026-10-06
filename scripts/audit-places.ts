/**
 * Построчный аудит каждого места, приключения и события каталога.
 *   npx tsx scripts/audit-places.ts [--warn]
 *
 * ERROR — данные, которые приведут к неверному поведению (неверные часы/координаты/возраст, противоречия, дубли, пустые поля).
 * WARN  — подозрительное: проверить руками (выводится с --warn).
 * Выход ≠ 0, если есть хотя бы одна ERROR.
 */
import { allPlaces, allAdventures, adventurePlaces } from "../src/lib/data/repository";
import { getEventsSeed } from "../src/lib/data/events";
import { okrugOf } from "../src/lib/moscow";
import { OKRUGS } from "../src/lib/location";
import { haversineKm, pt } from "../src/lib/geo";
import type { Place } from "../src/lib/types";

const SHOW_WARN = process.argv.includes("--warn");
const errors: string[] = [];
const warns: string[] = [];
const E = (p: string, m: string) => errors.push(`${p}: ${m}`);
const W = (p: string, m: string) => warns.push(`${p}: ${m}`);

const CATS = new Set(["park", "play", "museum", "active", "animals", "cafe", "shop"]);
const WEATHER = new Set(["rain", "sun", "cold", "heat", "any"]);
const SEASONS = new Set(["spring", "summer", "autumn", "winter"]);
const INTERESTS = new Set(["dinosaurs", "animals", "transport", "sport", "drawing", "music", "science", "cooking", "construction", "nature", "space", "fairy"]);
const EXPERIENCE = new Set(["playzone", "cafe", "workshop", "show", "walk", "icecream", "toys", "books", "food", "picnic", "unusual", "free", "toddlers"]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

// Москва + область: грубые рамки, чтобы поймать перепутанные широта/долгота и опечатки в знаках
const BBOX = { latMin: 54.6, latMax: 56.6, lngMin: 35.2, lngMax: 39.2 };

const norm = (s: string) => s.toLowerCase().replace(/[«»"'“”.,!?()\-–—]/g, " ").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const seenSlug = new Map<string, string>();
const seenId = new Map<string, string>();
const seenTitle = new Map<string, string>();
const seenDesc = new Map<string, string>();

for (const p of allPlaces) {
  const k = `${p.slug}`;
  const tag = (m: string) => m;

  // ── идентификаторы
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) E(k, tag(`slug «${p.slug}» не в kebab-case`));
  if (seenSlug.has(p.slug)) E(k, `дубль slug с ${seenSlug.get(p.slug)}`);
  seenSlug.set(p.slug, p.id);
  if (seenId.has(p.id)) E(k, `дубль id ${p.id}`);
  seenId.set(p.id, p.slug);

  // ── тексты
  for (const f of ["title", "subtitle", "description", "address"] as const) {
    const v = p[f];
    if (!v || !v.trim()) E(k, `пустое поле ${f}`);
    else {
      if (v !== v.trim()) E(k, `${f}: пробелы по краям`);
      if (/\s{2,}/.test(v)) W(k, `${f}: двойной пробел`);
      if (/todo|lorem|undefined|null|\?\?\?|xxx/i.test(v)) E(k, `${f}: похоже на заглушку («${v.slice(0, 40)}»)`);
      if (/"/.test(v)) W(k, `${f}: прямые кавычки вместо «»`);
    }
  }
  if (p.title.length > 60) W(k, `длинное название (${p.title.length})`);
  if (p.subtitle.length > 90) W(k, `длинный подзаголовок (${p.subtitle.length})`);
  if (p.description.length < 50) E(k, `слишком короткое описание (${p.description.length})`);
  if (p.description.length > 420) W(k, `длинное описание (${p.description.length})`);
  if (!/[.!?…]$/.test(p.description.trim())) W(k, "описание без точки в конце");
  if (!/[а-яё]/i.test(p.title) && !/^[A-Z0-9 &.\-]+$/.test(p.title)) W(k, `название без кириллицы: ${p.title}`);
  const nt = norm(p.title);
  if (seenTitle.has(nt)) E(k, `дубль названия с ${seenTitle.get(nt)}`);
  seenTitle.set(nt, p.slug);
  const nd = norm(p.description);
  if (seenDesc.has(nd)) E(k, `одинаковое описание с ${seenDesc.get(nd)}`);
  seenDesc.set(nd, p.slug);

  // ── категория и теги
  if (!CATS.has(p.category)) E(k, `неизвестная категория ${p.category}`);
  if (!p.tint || !/^#[0-9a-f]{6}$/i.test(p.tint)) E(k, `tint «${p.tint}»`);
  if (!p.emoji) E(k, "нет emoji");
  for (const t of p.weather_tags) if (!WEATHER.has(t)) E(k, `weather_tag «${t}»`);
  for (const t of p.season_tags) if (!SEASONS.has(t)) E(k, `season_tag «${t}»`);
  for (const t of p.interest_tags) if (!INTERESTS.has(t)) E(k, `interest_tag «${t}»`);
  for (const t of p.experience_tags) if (!EXPERIENCE.has(t)) E(k, `experience_tag «${t}»`);
  if (!p.season_tags.length) E(k, "нет сезонов");
  if (!p.weather_tags.length) E(k, "нет погодных тегов");
  if (new Set(p.tags).size !== p.tags.length) W(k, "повторяющиеся чипы");
  if (!p.tags.length) E(k, "нет чипов (tags)");

  // ── координаты и регион
  const { latitude: la, longitude: lo } = p;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) E(k, "нет координат");
  else {
    if (la < BBOX.latMin || la > BBOX.latMax || lo < BBOX.lngMin || lo > BBOX.lngMax) E(k, `координаты вне региона (${la}, ${lo})`);
    const okr = okrugOf(p);
    if (p.region === "msk" && !okr) E(k, "region=msk, но округ не определился");
    if (p.region === "mo" && okr) E(k, `region=mo, но попадает в округ ${okr}`);
    if (!p.region) W(k, "нет region");
    if (p.region === "msk" || okr) {
      // метро нужно только московским
      if (okr && !p.metro && !p.town) W(k, "московское место без метро");
      // подпись округа в town должна совпадать с вычисленным
      const m = /\(([^)]+)\)/.exec(p.town ?? "");
      if (m && okr) {
        const short = OKRUGS.find((o) => o.id === okr)?.short;
        const known = OKRUGS.some((o) => o.short === m[1]);
        if (known && short !== m[1]) E(k, `в town указан ${m[1]}, а по координатам ${short}`);
      }
    }
    const d = haversineKm(pt(p), { lat: 55.7558, lng: 37.6173 });
    if (p.region === "msk" && d > 40) E(k, `region=msk, но ${d.toFixed(0)} км от центра`);
    if (p.region === "mo" && d < 8) W(k, `region=mo, но ${d.toFixed(1)} км от центра`);
  }
  for (const o of allPlaces) {
    if (o.slug >= p.slug) continue;
    if (haversineKm(pt(o), pt(p)) < 0.03 && o.category === p.category) W(k, `в 30 м от ${o.slug} той же категории`);
  }

  // ── цены
  if (!(p.price_min >= 0) || !(p.price_max >= p.price_min)) E(k, `цена ${p.price_min}–${p.price_max}`);
  if (p.price_max > 20000) W(k, `цена до ${p.price_max} ₽`);
  if (!(p.family_budget >= 0)) E(k, `family_budget ${p.family_budget}`);
  if (p.price_min === 0 && p.price_max === 0 && p.price_level !== 0) E(k, `бесплатно, но price_level=${p.price_level}`);
  if (p.price_max > 0 && p.price_level === 0 && p.category !== "park") W(k, `платное (до ${p.price_max}), price_level=0`);
  if (p.price_min > 0 && p.family_budget < p.price_min) E(k, `family_budget ${p.family_budget} меньше минимальной цены ${p.price_min}`);
  if (p.price_min > 0 && p.family_budget > 0 && p.family_budget < p.price_min * 2 && p.category !== "cafe") W(k, `family_budget ${p.family_budget} < 2 билетов по ${p.price_min}`);
  const free = p.price_max === 0;
  if (free && !p.experience_tags.includes("free") && p.category !== "shop") W(k, "бесплатно, но нет тега free");
  if (!free && p.price_min > 0 && p.experience_tags.includes("free")) E(k, "тег free у платного места");
  if (!free && p.tags.some((t) => /бесплатн/i.test(t)) && p.price_min > 0) E(k, "чип «Бесплатно» у платного места");
  if (free && p.family_budget > 1500 && p.category !== "cafe") W(k, `бесплатно, но бюджет семьи ${p.family_budget}`);

  // ── возраст, длительность
  if (!(p.age_min >= 0) || !(p.age_max >= p.age_min) || p.age_max > 18) E(k, `возраст ${p.age_min}–${p.age_max}`);
  if (p.age_max < 4) W(k, `верхняя граница возраста ${p.age_max}`);
  if (p.age_min > 8) W(k, `нижняя граница возраста ${p.age_min}`);
  if (p.experience_tags.includes("toddlers") && p.age_min > 2) E(k, `тег toddlers, но возраст от ${p.age_min}`);
  if (!(p.average_duration >= 15 && p.average_duration <= 600)) E(k, `длительность ${p.average_duration}`);
  if (p.category === "cafe" && p.average_duration > 150) W(k, `кафе на ${p.average_duration} мин`);
  if (p.category === "park" && p.average_duration < 30) W(k, `парк на ${p.average_duration} мин`);

  // ── помещение/улица и погода
  if (!p.indoor && !p.outdoor) E(k, "ни indoor, ни outdoor");
  if (p.indoor && !p.outdoor && p.weather_tags.length === 1 && p.weather_tags[0] === "sun") E(k, "в помещении, но подходит только для солнца");
  if (p.outdoor && !p.indoor && p.weather_tags.includes("rain")) E(k, "только на улице, но помечено «подходит под дождь»");
  if (p.outdoor && !p.indoor && p.weather_tags.includes("cold") && !p.season_tags.includes("winter")) W(k, "на улице, подходит в холод, но без зимы в сезонах");
  if (p.outdoor && !p.indoor && !p.season_tags.includes("summer") && !p.season_tags.includes("spring") && !p.season_tags.includes("autumn")) W(k, "только зимой на улице?");
  if (p.indoor && !p.outdoor && p.season_tags.length < 4) W(k, `в помещении, но сезоны ${p.season_tags.join("+")}`);
  if (p.category === "museum" && !p.indoor) W(k, "музей без indoor");
  if (p.category === "animals" && !p.interest_tags.includes("animals")) W(k, "категория animals без интереса animals");
  if (p.category === "cafe" && !p.experience_tags.some((t) => ["cafe", "food", "icecream"].includes(t))) W(k, "кафе без cafe/food в опыте");
  if (p.kids_menu && !["cafe", "park", "play", "animals", "active", "museum"].includes(p.category)) W(k, "детское меню у не-кафе");
  if (p.category === "cafe" && !p.kids_menu && !p.experience_tags.includes("playzone")) W(k, "кафе без детского меню и игровой зоны");
  if (p.baby_room && !p.indoor) W(k, "пеленальная на улице");
  if (p.wardrobe && !p.indoor) W(k, "гардероб на улице");

  // ── часы работы
  if (!Array.isArray(p.opening_hours) || p.opening_hours.length !== 7) E(k, "часы работы: не 7 дней");
  else {
    let open = 0;
    p.opening_hours.forEach((h, i) => {
      if (h === null) return;
      open++;
      if (!Array.isArray(h) || h.length !== 2 || !HHMM.test(h[0]) || !(HHMM.test(h[1]) || h[1] === "24:00")) return E(k, `часы дня ${i}: ${JSON.stringify(h)}`);
      const a = mins(h[0]);
      const b = h[1] === "24:00" ? 1440 : mins(h[1]);
      if (b <= a) E(k, `часы дня ${i}: закрытие ${h[1]} не позже открытия ${h[0]}`);
      if (b - a < 120 && p.category !== "shop") W(k, `часы дня ${i}: всего ${(b - a) / 60} ч (${h[0]}–${h[1]})`);
      if (a < 360 && p.category !== "park") W(k, `часы дня ${i}: открывается в ${h[0]}`);
    });
    if (open === 0) E(k, "закрыто все 7 дней");
    if (open < 5 && p.category === "cafe") W(k, `кафе открыто ${open} дн.`);
    if (!p.opening_hours[5] && !p.opening_hours[6]) W(k, "закрыто и в субботу, и в воскресенье");
    const weekend = p.opening_hours[5] || p.opening_hours[6];
    if (weekend && p.average_duration > mins(weekend[1] === "24:00" ? "23:59" : weekend[1]) - mins(weekend[0])) W(k, `средняя длительность ${p.average_duration} мин больше окна работы в выходной`);
  }

  // ── удобства: логика
  if (p.stroller_friendly === false && p.age_max <= 3) W(k, "малышовое место без коляски");
  if (p.booking_required && p.category === "park") W(k, "парк с обязательной записью");

  // ── фото
  if (!p.photos.length) E(k, "нет фото");
  const srcs = new Set<string>();
  for (const ph of p.photos) {
    if (!ph.src) E(k, "пустой src у фото");
    if (!ph.alt || !ph.alt.trim()) E(k, `нет alt у фото ${ph.src}`);
    if (srcs.has(ph.src)) E(k, `фото повторяется внутри места: ${ph.src}`);
    srcs.add(ph.src);
  }

  // ── рейтинг и отзывы
  if (p.reviews.length) {
    if (!(p.rating >= 1 && p.rating <= 5)) E(k, `рейтинг ${p.rating} при наличии отзывов`);
    if (p.review_count < p.reviews.length) E(k, `review_count ${p.review_count} < отзывов ${p.reviews.length}`);
    const avg = p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length;
    if (Math.abs(avg - p.rating) > 0.8) W(k, `рейтинг ${p.rating}, а средняя по отзывам ${avg.toFixed(1)}`);
    for (const r of p.reviews) {
      if (!(r.rating >= 1 && r.rating <= 5)) E(k, `оценка в отзыве ${r.rating}`);
      if (!r.text || r.text.trim().length < 15) E(k, "пустой/короткий отзыв");
      if (!r.author?.trim()) E(k, "отзыв без автора");
      if (/назад$|^вчера$|^сегодня$/.test(r.date.trim())) {
        // относительная дата («неделю назад») — формат демо-отзывов
      } else if (Number.isNaN(Date.parse(r.date))) E(k, `дата отзыва «${r.date}»`);
      else if (Date.parse(r.date) > Date.now() + 86400000) E(k, `отзыв из будущего ${r.date}`);
    }
  } else if (p.rating > 0 && p.confidence !== "demo") {
    W(k, `рейтинг ${p.rating} без отзывов`);
  }
  if (p.rating && (p.rating < 1 || p.rating > 5)) E(k, `рейтинг вне 1–5: ${p.rating}`);

  // ── источник данных
  if (p.confidence === "high" || p.confidence === "medium") {
    if (!p.source || !/^https?:\/\//.test(p.source)) E(k, `confidence=${p.confidence}, но нет ссылки-источника`);
  }
  if (!p.confidence) W(k, "нет confidence");
}

// ───────────────────────── приключения ─────────────────────────
const bySlug = new Map(allPlaces.map((p) => [p.slug, p]));
const byId = new Map(allPlaces.map((p) => [p.id, p]));
const advSlugs = new Set<string>();
for (const a of allAdventures) {
  const k = `приключение ${a.slug}`;
  if (advSlugs.has(a.slug)) E(k, "дубль slug");
  advSlugs.add(a.slug);
  if (!a.title.trim() || !a.tagline.trim() || a.description.trim().length < 60) E(k, "пустые тексты");
  if (!a.cover_image?.src || !a.cover_image.alt) E(k, "нет обложки или alt");
  if (!(a.steps.length >= 2)) E(k, `шагов: ${a.steps.length}`);
  if (!HHMM.test(a.start_time)) E(k, `start_time ${a.start_time}`);
  if (!(a.age_min >= 0 && a.age_max >= a.age_min)) E(k, `возраст ${a.age_min}–${a.age_max}`);
  if (a.recommend_percent != null && !(a.recommend_percent >= 50 && a.recommend_percent <= 100)) W(k, `recommend ${a.recommend_percent}`);
  const places = a.steps.map((s) => byId.get(s.place_id));
  places.forEach((p, i) => {
    if (!p) return E(k, `шаг ${i + 1}: нет места ${a.steps[i].place_id}`);
    if (a.steps[i].position !== i + 1) E(k, `шаг ${i + 1}: position ${a.steps[i].position}`);
    if (a.age_max < p.age_min || a.age_min > p.age_max) E(k, `шаг «${p.title}» не подходит по возрасту (${p.age_min}–${p.age_max}) к ${a.age_min}–${a.age_max}`);
    if (!(a.steps[i].recommended_duration >= 15)) E(k, `шаг ${i + 1}: длительность ${a.steps[i].recommended_duration}`);
  });
  if (new Set(a.steps.map((s) => s.place_id)).size !== a.steps.length) E(k, "место повторяется");
  const full = places.filter(Boolean) as Place[];
  if (full.length === a.steps.length) {
    if (a.weather_tags.includes("rain") && !a.weather_tags.includes("any") && full.some((p) => !p.indoor)) W(k, `дождливое приключение, но «${full.find((p) => !p.indoor)!.title}» на улице`);
    if (a.weather_tags.length === 1 && a.weather_tags[0] === "sun" && full.every((p) => p.indoor && !p.outdoor)) E(k, "только для солнца, но все шаги в помещении");
    // можно ли пройти маршрут целиком хотя бы в один выходной день с этого старта
    let ok = false;
    for (const day of [5, 6, 0, 1, 2, 3, 4]) {
      let t = mins(a.start_time);
      let fine = true;
      full.forEach((p, i) => {
        const h = p.opening_hours[day];
        const dur = a.steps[i].recommended_duration;
        if (!h || t < mins(h[0]) || t + Math.min(dur, 30) > (h[1] === "24:00" ? 1440 : mins(h[1]))) fine = false;
        t += dur + (a.steps[i].travel_time_to_next ?? 8);
      });
      if (fine) {
        ok = true;
        break;
      }
    }
    if (!ok) E(k, `маршрут не проходит по часам работы ни в один день (старт ${a.start_time})`);
    for (const day of [5, 6]) {
      let t = mins(a.start_time);
      full.forEach((p, i) => {
        const h = p.opening_hours[day];
        const dur = a.steps[i].recommended_duration;
        if (!h) W(k, `«${p.title}» закрыто в ${day === 5 ? "субботу" : "воскресенье"}`);
        else if (t < mins(h[0]) || t >= (h[1] === "24:00" ? 1440 : mins(h[1]))) W(k, `в ${day === 5 ? "субботу" : "воскресенье"} «${p.title}» не работает в ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
        t += dur + (a.steps[i].travel_time_to_next ?? 8);
      });
    }
    const sum = full.reduce((s, p) => s + p.family_budget, 0);
    if (a.estimated_budget > sum * 1.3 + 500) W(k, `бюджет ${a.estimated_budget} при сумме по местам ${sum}`);
    const dur = a.steps.reduce((s, x, i) => s + x.recommended_duration + (i < a.steps.length - 1 ? x.travel_time_to_next ?? 8 : 0), 0);
    if (Math.abs(dur - a.estimated_duration) > 20) W(k, `estimated_duration ${a.estimated_duration}, по шагам ${dur}`);
    for (let i = 0; i < full.length - 1; i++) {
      const km = haversineKm(pt(full[i]), pt(full[i + 1]));
      const t = a.steps[i].travel_time_to_next;
      if (t != null && km > 4 && t < 10) W(k, `${full[i].title} → ${full[i + 1].title}: ${km.toFixed(1)} км за ${t} мин`);
      if (km > 25) E(k, `${full[i].title} → ${full[i + 1].title}: ${km.toFixed(0)} км между соседними шагами`);
    }
  }
  adventurePlaces(a); // не должно падать
}

// ───────────────────────── события ─────────────────────────
const evIds = new Set<string>();
for (const e of getEventsSeed()) {
  const k = `событие ${e.id}`;
  if (evIds.has(e.id)) E(k, "дубль id");
  evIds.add(e.id);
  const p = byId.get(e.place_id);
  if (!p) {
    E(k, `нет места ${e.place_id}`);
    continue;
  }
  const s = Date.parse(e.start_at);
  const f = Date.parse(e.end_at);
  if (Number.isNaN(s) || Number.isNaN(f) || f <= s) E(k, `время ${e.start_at}–${e.end_at}`);
  if (f - s > 12 * 3600000) W(k, "длится больше 12 часов");
  if (!e.title.trim() || e.description.trim().length < 20) E(k, "пустые тексты");
  if (e.age_max < p.age_min || e.age_min > p.age_max) W(k, `возраст события ${e.age_min}–${e.age_max} вне возраста места ${p.age_min}–${p.age_max}`);
  if (e.price < 0) E(k, `цена ${e.price}`);
  if (!e.image?.src || !e.image.alt) E(k, "нет картинки или alt");
  // событие должно происходить в часы работы места (по Москве)
  const msk = new Date(s + 3 * 3600000);
  const dow = (msk.getUTCDay() + 6) % 7;
  const h = p.opening_hours[dow];
  const t = msk.getUTCHours() * 60 + msk.getUTCMinutes();
  const t2 = new Date(f + 3 * 3600000);
  const tEnd = t2.getUTCHours() * 60 + t2.getUTCMinutes();
  if (!h) E(k, `в день события «${p.title}» закрыто`);
  else if (t < mins(h[0]) || tEnd > (h[1] === "24:00" ? 1440 : mins(h[1]))) W(k, `${e.start_at.slice(11, 16)}–${e.end_at.slice(11, 16)} вне часов работы «${p.title}» (${h[0]}–${h[1]})`);
}

// ───────────────── фото и служебные слова в публичных текстах ─────────────────
{
  const covers = new Map<string, string>();
  const TECH = /подтвержд|[Сс]татус|источник|проверен|аудит|в карточке|\bdemo\b|демо\b|OSM|OpenStreetMap|в файле|confidence|иллюстраци/i;
  for (const p of allPlaces) {
    const cover = p.photos[0]?.src;
    if (!cover) E(p.slug, "нет фото");
    else if (covers.has(cover)) E(p.slug, `первое фото совпадает с «${covers.get(cover)}»`);
    else covers.set(cover, p.slug);
    for (const ph of p.photos) if (TECH.test(ph.alt)) E(p.slug, `служебное слово в подписи к фото: «${ph.alt}»`);
    const texts: [string, string | undefined][] = [
      ["title", p.title],
      ["subtitle", p.subtitle],
      ["description", p.description],
      ["parking", p.parking_info?.details],
      ["editorial_note", p.editorial_note],
      ...p.tags.map((t): [string, string] => ["tag", t]),
    ];
    for (const [f, v] of texts) if (v && TECH.test(v)) E(p.slug, `служебное слово в тексте для родителей (${f}): «${v.slice(0, 120)}»`);
  }
}

// ───────────────────────── итог ─────────────────────────
const cat = new Map<string, number>();
for (const p of allPlaces) cat.set(p.category, (cat.get(p.category) ?? 0) + 1);
console.log(`Мест: ${allPlaces.length} (${[...cat].map(([c, n]) => `${c} ${n}`).join(", ")}), приключений: ${allAdventures.length}, событий: ${getEventsSeed().length}`);
if (SHOW_WARN && warns.length) {
  console.log(`\nWARN (${warns.length}):`);
  for (const w of warns) console.log("  ~ " + w);
}
if (errors.length) {
  console.log(`\nERROR (${errors.length}):`);
  for (const e of errors) console.log("  ✗ " + e);
  console.log(`\nПредупреждений: ${warns.length} (--warn, чтобы показать)`);
  process.exit(1);
}
console.log(`\nАудит мест пройден ✓ (предупреждений: ${warns.length}${SHOW_WARN ? "" : ", --warn — показать"})`);
