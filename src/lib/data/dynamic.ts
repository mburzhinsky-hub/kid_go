import type { GeoPoint, Place } from "@/lib/types";
import { placesFromOsm, type OsmElement } from "@/lib/osm";

/**
 * Места, подтянутые «на лету» (OpenStreetMap вокруг точки выезда), и их кэш в браузере.
 *
 * Кэш — по ячейкам ~3,5×5,5 км: переезд внутри ячейки не вызывает новый запрос.
 * Кэшированные места регистрируются при старте, поэтому избранное и «Наш день» продолжают
 * открывать такие места и после перезагрузки.
 */

const KEY = "kidgo-osm-v1";
export const CELL_DEG = 0.05;
/** Через сколько данные считаем устаревшими и обновляем в фоне. */
export const CACHE_TTL = 7 * 864e5;
const MAX_CELLS = 8;

export interface CellRec {
  key: string;
  lat: number;
  lng: number;
  at: number;
  els: OsmElement[];
}

export function cellOf(p: GeoPoint): { key: string; center: GeoPoint } {
  const i = Math.round(p.lat / CELL_DEG);
  const j = Math.round(p.lng / CELL_DEG);
  return { key: `${i}:${j}`, center: { lat: +(i * CELL_DEG).toFixed(4), lng: +(j * CELL_DEG).toFixed(4) } };
}

function readAll(): CellRec[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CellRec[]) : [];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.key === "string" && Array.isArray(c.els)) : [];
  } catch {
    return [];
  }
}

function writeAll(list: CellRec[]) {
  let cur = list;
  for (let i = 0; i < 4; i++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cur));
      return;
    } catch {
      cur = cur.slice(0, Math.max(0, cur.length - 2)); // не влезло — выкидываем самые старые
    }
  }
}

export function loadCell(key: string): CellRec | null {
  if (typeof window === "undefined") return null;
  return readAll().find((c) => c.key === key) ?? null;
}

export function saveCell(rec: CellRec) {
  if (typeof window === "undefined") return;
  const rest = readAll().filter((c) => c.key !== rec.key);
  writeAll([rec, ...rest].slice(0, MAX_CELLS));
}

/** Отдельная «ячейка» для мест, подтянутых по идентификатору (например, из общей ссылки). */
export function pinElements(els: OsmElement[]) {
  if (typeof window === "undefined" || !els.length) return;
  const cur = readAll().find((c) => c.key === "pinned");
  const byId = new Map<string, OsmElement>();
  for (const e of [...(cur?.els ?? []), ...els]) byId.set(`${e.type}${e.id}`, e);
  saveCell({ key: "pinned", lat: 55.75, lng: 37.6, at: Date.now(), els: [...byId.values()].slice(-80) });
}

/* ───────── Реестр ───────── */

const bySlug = new Map<string, Place>();
let warmed = false;

export function registerDynamic(ps: Place[]) {
  for (const p of ps) bySlug.set(p.slug, p);
}

function warm() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  for (const rec of readAll()) registerDynamic(placesFromOsm(rec.els, { lat: rec.lat, lng: rec.lng }));
}

export function getDynamic(slug: string): Place | null {
  if (!slug.startsWith("osm-")) return null;
  warm();
  return bySlug.get(slug) ?? null;
}
