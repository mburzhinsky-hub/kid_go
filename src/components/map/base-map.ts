import type { Map as MLMap, StyleSpecification } from "maplibre-gl";

/**
 * Подложка карты с цепочкой запасных источников.
 *
 * Один внешний сервер тайлов — единая точка отказа (блокировки, офлайн, CORS), поэтому:
 *  1) параллельно «пробуем» все источники маленьким запросом (то же, что сделает карта: CORS-fetch);
 *  2) берём первый рабочий по приоритету;
 *  3) если карта всё равно не отрисовала ни одного тайла — переходим к следующему;
 *  4) если не работает ничего — вызывающий код показывает схему без подложки.
 */

export type ProviderId = "ofm" | "carto" | "osm" | "osmfr";

interface Provider {
  id: ProviderId;
  vector: boolean;
  probe: () => Promise<boolean>;
  style: () => string | StyleSpecification;
}

const OFM_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";
/** Москва, z9 — тайл для пробы. */
const Z9 = { z: 9, x: 309, y: 160 };

async function fetchOk(url: string, ms: number, json = false): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    return json ? await res.json() : await res.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const rasterStyle = (tiles: string[], attribution: string, maxzoom = 19): StyleSpecification => ({
  version: 8,
  sources: { base: { type: "raster", tiles, tileSize: 256, maxzoom, attribution } },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#F4EFE6" } },
    { id: "base", type: "raster", source: "base", paint: { "raster-saturation": 0.06, "raster-fade-duration": 150 } },
  ],
});

const tileUrl = (tpl: string) => tpl.replace("{z}", String(Z9.z)).replace("{x}", String(Z9.x)).replace("{y}", String(Z9.y));

const CARTO = ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`);
const OSM = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
const OSMFR = ["https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"];

export const PROVIDERS: Provider[] = [
  {
    id: "ofm",
    vector: true,
    style: () => OFM_STYLE,
    probe: async () => {
      const style = (await fetchOk(OFM_STYLE, 4500, true)) as { sources?: Record<string, { url?: string; tiles?: string[] }> } | null;
      if (!style?.sources) return false;
      const src = Object.values(style.sources).find((s) => s.url || s.tiles);
      if (src?.url) return !!(await fetchOk(src.url, 4500, true));
      if (src?.tiles?.[0]) return !!(await fetchOk(tileUrl(src.tiles[0]), 4500));
      return true;
    },
  },
  {
    id: "carto",
    vector: false,
    style: () => rasterStyle(CARTO, "© OpenStreetMap, © CARTO"),
    probe: async () => !!(await fetchOk(tileUrl(CARTO[0]), 4500)),
  },
  {
    id: "osm",
    vector: false,
    style: () => rasterStyle(OSM, "© OpenStreetMap", 19),
    probe: async () => !!(await fetchOk(tileUrl(OSM[0]), 4500)),
  },
  {
    id: "osmfr",
    vector: false,
    style: () => rasterStyle(OSMFR, "© OpenStreetMap, HOT", 19),
    probe: async () => !!(await fetchOk(tileUrl(OSMFR[0]), 4500)),
  },
];

/** Широкие границы: Москва и вся область (раньше было только МКАД — из посёлка карта «пустела»). */
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [34.6, 54.3],
  [40.9, 57.2],
];

export interface BaseMapOptions {
  container: HTMLElement;
  center: [number, number];
  zoom: number;
  /** Вызывается после создания, до загрузки — чтобы подписаться на события. */
  onProvider?: (id: ProviderId) => void;
  signal?: { cancelled: boolean };
}

export interface BaseMapResult {
  map: MLMap;
  provider: ProviderId;
  vector: boolean;
  /** Сколько провайдеров пробовали (для диагностики). */
  tried: ProviderId[];
}

/** Ждём первый отрисованный тайл; false — нет тайлов за отведённое время. */
function waitForTiles(map: MLMap, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let ok = 0;
    let bad = 0;
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      map.off("data", onData);
      map.off("error", onError);
      resolve(v);
    };
    const onData = (e: { dataType?: string; tile?: unknown }) => {
      if (e.dataType === "source" && e.tile) {
        ok++;
        finish(true);
      }
    };
    const onError = () => {
      bad++;
      if (bad >= 5 && ok === 0) finish(false);
    };
    const timer = setTimeout(() => finish(ok > 0), ms);
    map.on("data", onData as never);
    map.on("error", onError);
  });
}

/**
 * Создаёт карту на первом рабочем источнике. null — ничего не доступно (или нет WebGL):
 * вызывающий код показывает схему без подложки.
 */
export async function createBaseMap(opts: BaseMapOptions): Promise<BaseMapResult | null> {
  const ml = (await import("maplibre-gl")).default;
  // пробы идут параллельно, но выбираем строго по приоритету
  const probes = PROVIDERS.map((p) => p.probe().catch(() => false));
  const tried: ProviderId[] = [];
  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    if (!(await probes[i])) continue;
    if (opts.signal?.cancelled) return null;
    tried.push(p.id);
    let map: MLMap;
    try {
      map = new ml.Map({
        container: opts.container,
        style: p.style(),
        center: opts.center,
        zoom: opts.zoom,
        minZoom: 6.5,
        maxBounds: REGION_BOUNDS,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 120,
      });
    } catch (err) {
      console.warn("[map] WebGL/MapLibre недоступен", err);
      return null;
    }
    map.touchZoomRotate.disableRotation();
    opts.onProvider?.(p.id);
    const alive = await waitForTiles(map, 9000);
    if (opts.signal?.cancelled) {
      map.remove();
      return null;
    }
    if (alive) return { map, provider: p.id, vector: p.vector, tried };
    console.warn(`[map] источник ${p.id} не отдал тайлы — пробуем следующий`);
    map.remove();
  }
  return null;
}

/** Тёплая палитра референса для векторной подложки: бежевая земля, зелёные парки, жёлтые магистрали. */
export function applyKidStyle(map: MLMap) {
  const layers = map.getStyle()?.layers ?? [];
  for (const l of layers) {
    try {
      const id = l.id.toLowerCase();
      const src = "source-layer" in l ? String(l["source-layer"] ?? "") : "";
      if (l.type === "background") map.setPaintProperty(l.id, "background-color", "#F4EFE6");
      else if (l.type === "fill" && (src === "water" || id.includes("water"))) map.setPaintProperty(l.id, "fill-color", "#BFE1F6");
      else if (l.type === "fill" && (src === "park" || id.includes("park") || id.includes("wood") || id.includes("grass") || id.includes("forest")))
        map.setPaintProperty(l.id, "fill-color", "#D3ECC3");
      else if (l.type === "fill" && (src === "landuse" || src === "landcover")) map.setPaintProperty(l.id, "fill-color", "#EDE8DC");
      else if (l.type === "fill" && src === "building") map.setPaintProperty(l.id, "fill-color", "#E9E3D6");
      else if (l.type === "line" && src === "transportation") {
        const major = /motorway|trunk|primary|major/.test(id);
        map.setPaintProperty(l.id, "line-color", major ? "#FCE3A6" : "#FFFFFF");
      } else if (l.type === "line" && src === "waterway") map.setPaintProperty(l.id, "line-color", "#BFE1F6");
      else if (l.type === "symbol" && /poi/.test(id)) map.setLayoutProperty(l.id, "visibility", "none");
      else if (l.type === "symbol") map.setPaintProperty(l.id, "text-color", "#8A8F9C");
    } catch {
      /* слой без такого свойства — пропускаем */
    }
  }
}
