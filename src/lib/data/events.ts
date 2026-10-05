import type { KidEvent } from "@/lib/types";
import { placeBySlug } from "./places";
import { buildEvents } from "./extra";

/**
 * Афиша строится только из программ с явным публичным источником.
 * Block 1 удалил относительные demo-события, которые раньше выглядели как реальные «сегодня».
 */
export function getEventsSeed(): KidEvent[] {
  return buildEvents(placeBySlug);
}
