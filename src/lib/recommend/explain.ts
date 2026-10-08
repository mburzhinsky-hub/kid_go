import type { Plan, PlannerInput, InterestId } from "@/lib/types";
import { fromMoscowLabel, plural } from "@/lib/format";

/**
 * Человекопонятные объяснения «почему это подходит вашей семье».
 * Детерминированные шаблоны — источник истины; LLM-провайдер (если подключён)
 * получает те же факты и может только переформулировать их, не добавляя мест.
 */

/** `about` — винительный падеж для «про …»: «про динозавров», «про музыку». */
export const INTEREST_LABEL: Record<InterestId, { label: string; emoji: string; love: string; about: string }> = {
  dinosaurs: { label: "Динозавры", emoji: "🦖", love: "динозавров", about: "динозавров" },
  animals: { label: "Животные", emoji: "🐾", love: "животных", about: "животных" },
  transport: { label: "Транспорт", emoji: "🚂", love: "транспорт", about: "транспорт" },
  sport: { label: "Спорт", emoji: "⚽", love: "спорт", about: "спорт" },
  drawing: { label: "Рисование", emoji: "🎨", love: "рисовать", about: "рисование" },
  music: { label: "Музыка", emoji: "🎵", love: "музыку", about: "музыку" },
  science: { label: "Наука", emoji: "🔬", love: "опыты", about: "науку" },
  cooking: { label: "Готовка", emoji: "🧁", love: "готовить", about: "готовку" },
  construction: { label: "Конструкторы", emoji: "🧱", love: "конструкторы", about: "конструкторы" },
  nature: { label: "Природа", emoji: "🌿", love: "природу", about: "природу" },
  space: { label: "Космос", emoji: "🪐", love: "космос", about: "космос" },
  fairy: { label: "Сказки", emoji: "🧚", love: "сказки", about: "сказки" },
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const ages0 = (input: PlannerInput) => (input.children.length ? Math.min(...input.children.map((c) => c.age)) : null);

export function explainPlan(plan: Plan, input: PlannerInput, notes: string[] = []): { why: string[]; explanation: string } {
  const why: string[] = [...notes];
  let head: string | null = null;
  const sentences: string[] = [];
  const [first, second] = plan.stops;
  const snow = input.weather.condition === "snow";
  const rain = input.weather.condition === "rain" || snow;

  if (rain && plan.rainProof) {
    why.push(snow ? "❄️ Всё под крышей" : "☔ Всё под крышей");
    head = snow ? "Хороший вариант на снежный день" : "Хороший вариант на дождливый день";
  } else if (!rain && plan.stops.some((s) => s.place.outdoor) && input.weather.condition === "sun") {
    if (input.weather.temp >= 27) head = "Хороший вариант для жаркого дня";
    else if (input.weather.temp <= -3) head = "Хороший вариант для морозного дня";
    else {
      why.push("☀️ Погода в плюс");
      head = "Отличный вариант для солнечного дня";
    }
  }

  // условия дня, повлиявшие на выбор: показываем, чтобы было видно, что план не «усреднённый»
  const temp = input.weather.temp;
  const outdoorShare = plan.stops.filter((s) => s.place.outdoor && !s.place.indoor).length / plan.stops.length;
  const youngest = ages0(input);
  const cond: string[] = [];
  if (!rain && temp <= -3) cond.push(outdoorShare > 0.5 ? "🧤 Мороз — одевайтесь теплее" : "🧣 Мороз — в основном в тепле");
  else if (!rain && temp >= 27) cond.push(plan.stops.some((s) => s.place.indoor || s.place.tags.some((t) => /вода|аквапарк|фонтан/i.test(t))) ? "🌡 Жара — есть тень или вода" : "🌡 Жара — берите воду и панамку");
  else if (input.weather.condition === "snow" && outdoorShare > 0) cond.push("❄️ Снег — для зимних забав");
  if (youngest != null && youngest <= 3) {
    const startMin = toMin(first.start);
    if (startMin >= 15 * 60 || startMin + first.duration <= 13 * 60) cond.push("😴 Учли дневной сон");
  }
  if (input.transport === "car" && plan.stops.some((s) => s.place.parking_info?.status === "yes")) cond.push("🚗 Есть парковка");
  else if (input.transport === "car" && plan.stops.some((s) => s.place.parking_info?.status === "partial")) cond.push("🚗 Парковка рядом");
  if (!plan.fromHome?.fromMoscow && (first.place.confidence === "osm" || (plan.fromHome && plan.fromHome.minutes <= 12 && plan.fromHome.mode === "walk"))) cond.push("🏡 Рядом с домом");
  else if (plan.fromHome && plan.fromHome.minutes >= 35 && !plan.fromHome.fromMoscow) cond.push(`🛣 Выезд: ${plan.fromHome.minutes} мин`);
  // выезд за город: главный факт — сколько ехать от Москвы
  if (plan.fromHome?.fromMoscow) cond.unshift(fromMoscowLabel(plan.fromHome.minutes, plan.fromHome.mode));
  why.push(...cond.slice(0, 2));

  if (first.place.activity_level === 3) sentences.push("детям будет где выплеснуть энергию");
  else if (first.place.activity_level === 1 && input.mood === "calm") sentences.push("спокойный темп без толп и шума");
  else if (first.place.category === "museum") sentences.push("будет что обсудить по дороге домой");

  const food = plan.stops.find((s) => s.foodOption === true && s.place.category === "cafe");
  const foodOnSite = !food ? plan.stops.find((s) => s.foodOption === true && !!s.place.menu_url) : undefined;
  if (food) {
    const foodIndex = plan.stops.indexOf(food);
    const prev = foodIndex > 0 ? plan.stops[foodIndex - 1] : undefined;
    const min = prev?.travelToNext?.minutes;
    if (min != null) {
      why.push(`🍽 Кафе в ${min} мин`);
      const verifiedKidsMenu = !food.place.unknown_fields?.includes("kids_menu") && food.place.kids_menu;
      sentences.push(`а до ${verifiedKidsMenu ? "семейного кафе с детским меню" : "кафе"} — ${min} ${plural(min, "минута", "минуты", "минут")}`);
    } else {
      why.push("🍽 Еда в самом сценарии");
      sentences.push("поесть можно прямо на месте — это семейное кафе");
    }
  } else if (foodOnSite) {
    why.push("🍽 Можно поесть на месте");
    sentences.push("а поесть можно на месте — у места есть меню");
  }

  // интересы конкретных детей
  for (const child of input.children) {
    const hit = child.interests.find((i) => plan.stops.some((s) => s.place.interest_tags.includes(i)));
    if (hit) {
      why.push(child.name ? `${INTEREST_LABEL[hit].emoji} ${child.name} любит ${INTEREST_LABEL[hit].love}` : `${INTEREST_LABEL[hit].emoji} Про ${INTEREST_LABEL[hit].about}`);
      break;
    }
  }

  const ages = input.children.map((c) => c.age);
  if (ages.length) {
    const fits = ages.every((a) => a >= plan.ageMin && a <= plan.ageMax);
    if (fits) why.push(ages.length > 2 ? "👧👦 Подходит всем" : ages.length > 1 ? "👧👦 Подходит обоим детям" : ages[0] === 0 ? "🎈 Для малышей до года" : `🎈 Для ${ages[0]} ${plural(ages[0], "года", "лет", "лет")}`);
  }

  if (plan.budget === 0) why.push("💚 Бесплатно");
  else if (input.budget !== "any" && plan.budget <= Number(input.budget)) why.push("👛 В бюджете");

  if (second && plan.distanceKm < 1.5) why.push("🚶 Всё рядом");
  if (plan.fromHome && !plan.fromHome.fromMoscow && plan.fromHome.minutes <= 20) why.push(`📍 ${plan.fromHome.minutes} мин от вас`);

  let explanation: string;
  if (head && sentences.length) explanation = `${head}: ${sentences.join(", ").replace(/^а /, "")}.`;
  else if (head) explanation = `${head} — всё продумано заранее.`;
  else if (sentences.length) {
    const body = sentences.join(", ").replace(/^а /, "");
    explanation = body[0].toUpperCase() + body.slice(1) + ".";
  } else if (plan.stops.length === 1) explanation = "Всё в одном месте — без лишних переездов.";
  else explanation = `${plan.stops.length} ${plural(plan.stops.length, "место", "места", "мест")} рядом друг с другом — без лишних переездов.`;

  return { why: why.slice(0, 4), explanation };
}
