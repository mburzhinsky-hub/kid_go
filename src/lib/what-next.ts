import type { Place } from "@/lib/types";
import type { NextGroup, NextItem } from "@/components/place/WhatNext";
import { allPlaces } from "@/lib/data/repository";
import { haversineKm, legMode, pt, travelMinutes } from "@/lib/geo";

/** Подбор «что сделать после» по типам: ближайшие места + время в пути. */
const GROUPS: { id: string; label: string; emoji: string; bg: string; match: (p: Place) => boolean; kind: (p: Place) => string }[] = [
  {
    id: "eat",
    label: "Поесть",
    emoji: "🍽",
    bg: "#FFE3D4",
    match: (p) => p.category === "cafe" && !p.experience_tags.includes("icecream"),
    kind: (p) => (p.kids_menu ? "семейное кафе" : "кафе"),
  },
  { id: "walk", label: "Погулять", emoji: "🌳", bg: "#E4F4DD", match: (p) => p.category === "park", kind: () => "прогулка в парке" },
  {
    id: "toys",
    label: "Купить игрушку",
    emoji: "🧸",
    bg: "#FFF3D6",
    match: (p) => p.category === "shop",
    kind: (p) => (p.experience_tags.includes("books") ? "детский книжный" : "магазин игрушек"),
  },
  {
    id: "icecream",
    label: "Съесть мороженое",
    emoji: "🍦",
    bg: "#FFE4F1",
    match: (p) => p.experience_tags.includes("icecream") || (p.category === "cafe" && p.subtitle.toLowerCase().includes("десерт")),
    kind: () => "кафе-мороженое",
  },
  {
    id: "play",
    label: "Ещё поиграть",
    emoji: "🎈",
    bg: "#EEE5FE",
    match: (p) => p.category === "play" || p.category === "active",
    kind: (p) => p.subtitle.charAt(0).toLowerCase() + p.subtitle.slice(1),
  },
];

export function whatNextGroups(place: Place): NextGroup[] {
  return GROUPS.map((g) => {
    const items: NextItem[] = allPlaces
      .filter((p) => p.id !== place.id && g.match(p))
      .map((p) => {
        const km = haversineKm(pt(place), pt(p));
        const mode = legMode(km, "transit");
        return { p, km, mode, minutes: travelMinutes(km, mode) };
      })
      .filter((x) => x.km <= 8)
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 3)
      .map(({ p, mode, minutes }) => ({
        slug: p.slug,
        title: p.title,
        kind: g.kind(p),
        photo: p.photos[0],
        tint: p.tint,
        emoji: p.emoji,
        rating: p.rating,
        minutes,
        mode,
        extra: p.kids_menu && g.id === "eat" ? "детское меню" : undefined,
      }));
    return { id: g.id, label: g.label, emoji: g.emoji, bg: g.bg, items };
  })
    .filter((g) => g.items.length > 0)
    // «своё» показываем последним: после музея логичнее поесть, после кафе — погулять
    .sort((a, b) => Number(sameKind(a.id, place)) - Number(sameKind(b.id, place)));
}

function sameKind(groupId: string, p: Place) {
  if (groupId === "eat" || groupId === "icecream") return p.category === "cafe";
  if (groupId === "walk") return p.category === "park";
  if (groupId === "toys") return p.category === "shop";
  return p.category === "play" || p.category === "active";
}
