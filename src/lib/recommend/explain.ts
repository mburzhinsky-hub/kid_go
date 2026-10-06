import type { Plan, PlannerInput, InterestId } from "@/lib/types";
import { plural } from "@/lib/format";

/**
 * Человекопонятные объяснения «почему это подходит вашей семье».
 * Детерминированные шаблоны — источник истины; LLM-провайдер (если подключён)
 * получает те же факты и может только переформулировать их, не добавляя мест.
 */

export const INTEREST_LABEL: Record<InterestId, { label: string; emoji: string; love: string }> = {
  dinosaurs: { label: "Динозавры", emoji: "🦖", love: "динозавров" },
  animals: { label: "Животные", emoji: "🐾", love: "животных" },
  transport: { label: "Транспорт", emoji: "🚂", love: "транспорт" },
  sport: { label: "Спорт", emoji: "⚽", love: "спорт" },
  drawing: { label: "Рисование", emoji: "🎨", love: "рисовать" },
  music: { label: "Музыка", emoji: "🎵", love: "музыку" },
  science: { label: "Наука", emoji: "🔬", love: "опыты" },
  cooking: { label: "Готовка", emoji: "🧁", love: "готовить" },
  construction: { label: "Конструкторы", emoji: "🧱", love: "конструкторы" },
  nature: { label: "Природа", emoji: "🌿", love: "природу" },
  space: { label: "Космос", emoji: "🪐", love: "космос" },
  fairy: { label: "Сказки", emoji: "🧚", love: "сказки" },
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
  const rain = input.weather.condition === "rain" || input.weather.condition === "snow";

  if (rain && plan.rainProof) {
    why.push("☔ Всё под крышей");
    head = "Хороший вариант на дождливый день";
  } else if (!rain && plan.stops.some((s) => s.place.outdoor) && input.weather.condition === "sun") {
    why.push("☀️ Погода в плюс");
    head = "Отличный вариант для солнечного дня";
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
  if (first.place.confidence === "osm" || (plan.fromHome && plan.fromHome.minutes <= 12 && plan.fromHome.mode === "walk")) cond.push("🏡 Рядом с домом");
  else if (plan.fromHome && plan.fromHome.minutes >= 35) cond.push(`🛣 Выезд: ${plan.fromHome.minutes} мин`);
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
      const near = min <= 10 ? "всего в " : "в ";
      const verifiedKidsMenu = !food.place.unknown_fields?.includes("kids_menu") && food.place.kids_menu;
      sentences.push(`а ${verifiedKidsMenu ? "семейное кафе с детским меню" : "кафе"} — ${near}${min} ${plural(min, "минуте", "минутах", "минутах")}`);
    } else {
      why.push("🍽 Еда в самом сценарии");
      sentences.push("семейное кафе уже является основной точкой маршрута");
    }
  } else if (foodOnSite) {
    why.push("🍽 Можно поесть на месте");
    sentences.push("и для еды не нужен отдельный переезд — у места есть детское меню");
  }

  // интересы конкретных детей
  for (const child of input.children) {
    const hit = child.interests.find((i) => plan.stops.some((s) => s.place.interest_tags.includes(i)));
    if (hit) {
      why.push(child.name ? `${INTEREST_LABEL[hit].emoji} ${child.name} любит ${INTEREST_LABEL[hit].love}` : `${INTEREST_LABEL[hit].emoji} Про ${INTEREST_LABEL[hit].label.toLowerCase()}`);
      break;
    }
  }

  const ages = input.children.map((c) => c.age);
  if (ages.length) {
    const fits = ages.every((a) => a >= plan.ageMin && a <= plan.ageMax);
    if (fits) why.push(ages.length > 2 ? "👧👦 Подходит всем" : ages.length > 1 ? "👧👦 Подходит обоим" : `🎈 Для ${ages[0]} ${plural(ages[0], "года", "лет", "лет")}`);
  }

  if (plan.budget === 0) why.push("💚 Бесплатно");
  else if (input.budget !== "any" && plan.budget <= Number(input.budget)) why.push("👛 В бюджете");

  if (second && plan.distanceKm < 1.5) why.push("🚶 Всё рядом");
  if (plan.fromHome && plan.fromHome.minutes <= 20) why.push(`📍 ${plan.fromHome.minutes} мин от вас`);

  let explanation: string;
  if (head && sentences.length) explanation = `${head}: ${sentences.join(", ")}.`;
  else if (head) explanation = `${head} — всё продумано заранее.`;
  else if (sentences.length) {
    const body = sentences.join(", ").replace(/^а /, "");
    explanation = body[0].toUpperCase() + body.slice(1) + ".";
  } else
    explanation = `${plan.stops.length} ${plural(plan.stops.length, "место", "места", "мест")} рядом друг с другом — без лишних переездов.`;

  return { why: why.slice(0, 4), explanation };
}
