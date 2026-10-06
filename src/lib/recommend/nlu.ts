import type { BudgetId, CategoryId, DurationId, InterestId, Level, MoodId, TransportId } from "@/lib/types";

/**
 * Интерпретация естественного языка → структурированный запрос.
 * MVP — правила (быстро, бесплатно, предсказуемо). Интерфейс ParsedQuery
 * совпадает с тем, что вернёт LLM-парсер (function calling с JSON-схемой),
 * поэтому его можно подключить как провайдер без изменений в UI.
 * Важно: результат — только фильтры, места всегда берутся из базы.
 */
export interface ParsedQuery {
  text: string;
  maxDistanceKm?: number;
  activity?: Level;
  foodAfter?: boolean;
  indoor?: boolean;
  outdoor?: boolean;
  free?: boolean;
  budget?: BudgetId;
  duration?: DurationId;
  mood?: MoodId;
  transport?: TransportId;
  category?: CategoryId;
  interests: InterestId[];
  ageMax?: number;
  chips: string[];
}

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

export function parseQuery(raw: string): ParsedQuery {
  const s = raw.toLowerCase().replace(/ё/g, "е");
  const q: ParsedQuery = { text: raw, interests: [], chips: [] };

  if (has(s, "недалеко", "рядом", "поблизости", "близко", "около дома")) {
    q.maxDistanceKm = 5;
    q.chips.push("📍 до 5 км");
  }
  if (has(s, "побега", "энерги", "попрыга", "подвига", "набега", "актив", "батут")) {
    q.activity = 3;
    q.mood = "energy";
    q.chips.push("⚡ активно");
  }
  if (has(s, "спокой", "тих", "без шума", "отдохнуть")) {
    q.activity = 1;
    q.mood = "calm";
    q.chips.push("🍃 спокойно");
  }
  if (has(s, "поесть", "покушать", "пообедать", "обед", "поужинать", "ужин", "позавтракать", "завтрак", "перекус", "кафе", "ресторан", "голодн")) {
    q.foodAfter = true;
    q.chips.push("🍽 потом поесть");
  }
  if (has(s, "дожд", "под крышей", "в помещени", "холодно")) {
    q.indoor = true;
    q.chips.push("☔ под крышей");
  }
  if (has(s, "погулять", "на улице", "на воздух", "прогул")) {
    q.outdoor = true;
    q.mood = q.mood ?? "outdoor";
    q.chips.push("🌿 на воздухе");
  }
  if (has(s, "бесплатн", "без денег", "даром")) {
    q.free = true;
    q.budget = "free";
    q.chips.push("💚 бесплатно");
  }
  if (has(s, "недорого", "дешев", "бюджетн")) {
    q.budget = "2000";
    q.chips.push("👛 недорого");
  }
  if (has(s, "пару часов", "на часок", "на 2 часа", "ненадолго")) {
    q.duration = "short";
    q.chips.push("⏱ 1–2 часа");
  }
  if (has(s, "весь день", "на целый день")) {
    q.duration = "day";
    q.chips.push("🗓 весь день");
  }
  if (has(s, "полдня", "пол дня")) {
    q.duration = "half";
    q.chips.push("🗓 полдня");
  }
  if (has(s, "пешком")) q.transport = "walk";
  if (has(s, "на машине", "машин")) q.transport = "car";
  if (has(s, "малыш", "годовал", "грудн", "до 3", "младен")) {
    q.ageMax = 3;
    q.chips.push("🍼 для малышей");
  }
  if (has(s, "необычн", "удиви", "что-нибудь классн", "что-то классн")) {
    q.mood = "surprise";
    q.chips.push("✨ необычное");
  }
  if (has(s, "творч", "рисова", "мастер-класс", "мастер класс", "лепк")) {
    q.mood = "creative";
    q.interests.push("drawing");
    q.chips.push("🎨 творчество");
  }
  if (has(s, "узнать", "познават", "музей", "наук", "опыт")) {
    q.mood = q.mood ?? "learn";
    q.chips.push("🔬 познавательно");
  }

  const INTERESTS: [InterestId, string[], string][] = [
    ["dinosaurs", ["динозавр", "динозав"], "🦖 динозавры"],
    ["animals", ["животн", "зверя", "зверей", "зоопарк", "звери", "покормить"], "🐾 животные"],
    ["space", ["космос", "ракет", "планетар", "звезд"], "🚀 космос"],
    ["science", ["наук", "опыт", "эксперимент"], "🧪 наука"],
    ["transport", ["машинк", "транспорт", "поезд", "трамва"], "🚋 транспорт"],
    ["construction", ["конструктор", "лего"], "🧱 конструкторы"],
    ["cooking", ["готов", "пицц", "печь"], "🍕 готовить"],
  ];
  for (const [id, words, chip] of INTERESTS) {
    if (has(s, ...words) && !q.interests.includes(id)) {
      q.interests.push(id);
      q.chips.push(chip);
    }
  }

  const CATS: [CategoryId, string[]][] = [
    ["park", ["парк", "сквер"]],
    ["play", ["площадк", "игров"]],
    ["museum", ["музе"]],
    ["animals", ["зоопарк", "океанариум", "животн"]],
    ["active", ["батут", "скалодром", "каток", "аквапарк"]],
    ["cafe", ["кафе", "мороженое", "блин", "пицц"]],
    ["shop", ["магазин", "игрушк", "купить"]],
  ];
  for (const [id, words] of CATS) if (has(s, ...words)) { q.category = id; break; }

  return q;
}
