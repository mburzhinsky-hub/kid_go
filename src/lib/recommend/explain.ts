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

export function explainPlan(plan: Plan, input: PlannerInput): { why: string[]; explanation: string } {
  const why: string[] = [];
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

  if (first.place.activity_level === 3) sentences.push("детям будет где выплеснуть энергию");
  else if (first.place.activity_level === 1 && input.mood === "calm") sentences.push("спокойный темп без толп и шума");
  else if (first.place.category === "museum") sentences.push("будет что обсудить по дороге домой");

  const food = plan.stops.find((s, i) => i > 0 && s.place.category === "cafe");
  if (food) {
    const prev = plan.stops[plan.stops.indexOf(food) - 1];
    const min = prev.travelToNext?.minutes ?? 5;
    why.push(`🍽 Кафе в ${min} мин`);
    const near = min <= 10 ? "всего в " : "в ";
    sentences.push(`а ${food.place.kids_menu ? "семейное кафе с детским меню" : "кафе"} — ${near}${min} ${plural(min, "минуте", "минутах", "минутах")}`);
  }

  // интересы конкретных детей
  for (const child of input.children) {
    const hit = child.interests.find((i) => plan.stops.some((s) => s.place.interest_tags.includes(i)));
    if (hit && child.name) {
      why.push(`${INTEREST_LABEL[hit].emoji} ${child.name} любит ${INTEREST_LABEL[hit].love}`);
      break;
    }
  }

  const ages = input.children.map((c) => c.age);
  if (ages.length) {
    const fits = ages.every((a) => a >= plan.ageMin && a <= plan.ageMax);
    if (fits) why.push(ages.length > 1 ? "👧👦 Подходит обоим" : `🎈 Для ${ages[0]} ${plural(ages[0], "года", "лет", "лет")}`);
  }

  if (plan.budget === 0) why.push("💚 Бесплатно");
  else if (input.budget !== "any" && plan.budget <= Number(input.budget)) why.push("👛 В бюджете");

  if (second && plan.distanceKm < 1.5) why.push("🚶 Всё рядом");

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
