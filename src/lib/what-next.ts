import type { Place } from "@/lib/types";
import type { NextGroup, NextItem } from "@/components/place/WhatNext";
import { allPlaces } from "@/lib/data/repository";
import { haversineKm, legMode, pt, travelMinutes } from "@/lib/geo";
import { isOutside } from "@/lib/outside";

/**
 * «Что потом?» — 2–4 логичных продолжения дня после этого места.
 * Учитываем: расстояние, тип места (музей → музей не предлагаем), сколько обычно длится визит,
 * возраст, «крыша / воздух» (после помещения — на воздух и наоборот), еду.
 * Серверная часть (на сборке) даёт кандидатов; клиент дополнительно смотрит на детей семьи и на то, что уже в «нашем дне».
 */
type GroupId = "eat" | "walk" | "toys" | "play" | "learn";

interface Def {
  id: GroupId;
  label: string;
  emoji: string;
  bg: string;
  match: (p: Place) => boolean;
  kind: (p: Place) => string;
}

const GROUPS: Def[] = [
  {
    id: "eat",
    label: "Поесть",
    emoji: "🍽",
    bg: "#FFE3D4",
    match: (p) => p.category === "cafe",
    kind: (p) => (p.kids_menu ? "семейное кафе" : "кафе"),
  },
  { id: "walk", label: "Погулять", emoji: "🌳", bg: "#E4F4DD", match: (p) => p.category === "park", kind: () => "прогулка в парке" },
  {
    id: "play",
    label: "Поиграть",
    emoji: "🎈",
    bg: "#EEE5FE",
    match: (p) => p.category === "play" || p.category === "active",
    kind: (p) => p.subtitle.charAt(0).toLowerCase() + p.subtitle.slice(1),
  },
  {
    id: "learn",
    label: "Узнать новое",
    emoji: "🔬",
    bg: "#E1ECFF",
    match: (p) => p.category === "museum" || p.category === "animals",
    kind: (p) => p.subtitle.charAt(0).toLowerCase() + p.subtitle.slice(1),
  },
  {
    id: "toys",
    label: "Игрушка",
    emoji: "🧸",
    bg: "#FFF3D6",
    match: (p) => p.category === "shop",
    kind: (p) => (p.experience_tags.includes("books") ? "детский книжный" : "магазин игрушек"),
  },
];

/** Группа места — чтобы клиент знал, что из «нашего дня» уже покрывает «поесть», «погулять» и т.д. */
export function nextGroupOf(p: Place): GroupId | null {
  return GROUPS.find((g) => g.match(p))?.id ?? null;
}

/** slug → группа, для всех мест (маленькая карта: клиенту хватает её, чтобы не тащить каталог целиком). */
export function nextGroupMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of allPlaces) {
    const g = nextGroupOf(p);
    if (g) out[p.slug] = g;
  }
  return out;
}

const SAME_IS_POINTLESS = new Set(["museum", "animals"]); // музей → музей / зоопарк → зоопарк не предлагаем вообще

function sameKind(groupId: GroupId, p: Place) {
  const own = nextGroupOf(p);
  return own === groupId;
}

function whyFor(g: GroupId, place: Place): string {
  const long = place.average_duration >= 90;
  const hrs = place.average_duration >= 90 ? `${Math.round((place.average_duration / 60) * 2) / 2}`.replace(".", ",") : "";
  switch (g) {
    case "eat":
      return long ? `Обычно здесь проводят около ${hrs} ч — самое время поесть` : "Если пора перекусить";
    case "walk":
      return place.indoor && !place.outdoor ? "После помещения — на воздух" : "Продолжить прогулкой";
    case "play":
      return place.category === "museum" ? "Выплеснуть энергию после музея" : "Ещё немного активности";
    case "learn":
      return place.outdoor && !place.indoor ? "Если станет прохладно или пойдёт дождь — в тепло" : "Что-то новое рядом";
    case "toys":
      return "Игрушка или книга на память о дне";
  }
}

function groupScore(g: GroupId, place: Place): number {
  let s = 0;
  const indoorOnly = place.indoor && !place.outdoor;
  const outdoorOnly = place.outdoor && !place.indoor;
  const long = place.average_duration >= 90;
  const toddler = place.age_max <= 3;
  const kidsOlder = place.age_min >= 7;
  switch (g) {
    case "eat":
      s += 2 + (long ? 2.5 : 0) + (place.average_duration >= 150 ? 1 : 0);
      break;
    case "walk":
      s += 2 + (indoorOnly ? 2 : 0) + (toddler ? 1 : 0) - (outdoorOnly ? 2 : 0);
      break;
    case "play":
      s += 1.5 + (place.category === "museum" ? 1.5 : 0) + (kidsOlder ? -0.5 : 0.5) + (place.activity_level === 1 ? 0.7 : 0);
      break;
    case "learn":
      s += 1.2 + (outdoorOnly ? 1.5 : 0) + (kidsOlder ? 0.8 : 0) - (toddler ? 1 : 0);
      break;
    case "toys":
      s += 0.6 + (toddler ? 0.4 : 0) + (place.average_duration < 60 ? 0.5 : 0);
      break;
  }
  if (sameKind(g, place)) s -= 3.2;
  return s;
}

export function whatNextGroups(place: Place): NextGroup[] {
  const far = isOutside(place);
  const radius = far ? 14 : 8;
  const strictSame = SAME_IS_POINTLESS.has(place.category);
  const groups = GROUPS.map((g) => {
    if (strictSame && sameKind(g.id, place)) return null;
    // возраст: продолжение должно подходить тем же детям, что и это место
    const items: NextItem[] = allPlaces
      .filter((p) => p.id !== place.id && g.match(p) && p.age_min <= place.age_max && p.age_max >= place.age_min)
      .filter((p) => (far ? true : !isOutside(p)))
      .map((p) => {
        const km = haversineKm(pt(place), pt(p));
        const mode = far && km > 1.6 ? ("car" as const) : legMode(km, "transit");
        return { p, km, mode, minutes: travelMinutes(km, mode) };
      })
      .filter((x) => x.km <= radius)
      .map((x) => {
        // небольшой бонус за подтверждённую оценку и за контраст «крыша / воздух»
        const rated = x.p.review_count > 0 && x.p.rating >= 4.5 ? 3 : 0;
        const contrast = (place.indoor && !place.outdoor && x.p.outdoor) || (place.outdoor && !place.indoor && x.p.indoor) ? 2 : 0;
        return { ...x, rank: x.minutes - rated - contrast };
      })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map(({ p, mode, minutes }): NextItem => ({
        slug: p.slug,
        title: p.title,
        kind: g.kind(p),
        photo: p.photos[0],
        tint: p.tint,
        emoji: p.emoji,
        rating: p.review_count > 0 ? p.rating : undefined,
        minutes,
        mode,
        extra: p.kids_menu && g.id === "eat" ? "детское меню" : undefined,
        menuUrl: g.id === "eat" ? p.menu_url : undefined,
        ageMin: p.age_min,
        ageMax: p.age_max,
      }));
    const out: NextGroup = { id: g.id, label: g.label, emoji: g.emoji, bg: g.bg, why: whyFor(g.id, place), items, score: groupScore(g.id, place) };
    return out;
  })
    .filter((g): g is NextGroup => !!g && g.items.length > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  // 2–4 продолжения: слабые «такого же типа» вкладки показываем, только если иначе осталась бы одна
  const strong = groups.filter((g) => (g.score ?? 0) > 0);
  return (strong.length >= 2 ? strong : groups).slice(0, 4);
}
