import { loadMapLibre } from "@/lib/maplibre-runtime";
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

export type ProviderId = "ofm" | "osm" | "osmde" | "osmfr" | "esri";

interface Provider {
  id: ProviderId;
  vector: boolean;
  probe: (ms: number) => Promise<boolean>;
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

/**
 * Проба растрового источника: берём ДВА разных тайла Москвы. Настоящие тайлы различаются; если сервер вместо карты
 * отдаёт одну и ту же картинку-заглушку («API KEY REQUIRED», «blocked»), байты совпадут — источник не годится.
 * (Так вела себя CARTO: отвечала 200 OK и рисовала водяной знак поверх всей карты.)
 */
async function probeRaster(tpl: string, ms: number): Promise<boolean> {
  const [a, b] = await Promise.all([fetchOk(tileUrl(tpl, 0, 0), ms), fetchOk(tileUrl(tpl, 1, 1), ms)]);
  if (!(a instanceof Blob) || !(b instanceof Blob) || a.size < 200 || b.size < 200) return false;
  if (a.type && !a.type.startsWith("image/")) return false;
  if (a.size !== b.size) return true;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return true;
  return false;
}

const rasterStyle = (tiles: string[], attribution: string, maxzoom = 19): StyleSpecification => ({
  version: 8,
  sources: { base: { type: "raster", tiles, tileSize: 256, maxzoom, attribution } },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#F4EFE6" } },
    { id: "base", type: "raster", source: "base", paint: { "raster-saturation": 0.06, "raster-fade-duration": 150 } },
  ],
});

const tileUrl = (tpl: string, dx = 0, dy = 0) =>
  tpl.replace("{z}", String(Z9.z)).replace("{x}", String(Z9.x + dx)).replace("{y}", String(Z9.y + dy));

const OSM = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
const OSMDE = ["https://tile.openstreetmap.de/{z}/{x}/{y}.png"];
const OSMFR = ["https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"];
/** Esri World Street Map: порядок {z}/{y}/{x}. */
const ESRI = ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"];

export const PROVIDERS: Provider[] = [
  {
    id: "ofm",
    vector: true,
    style: () => OFM_STYLE,
    probe: async (ms) => {
      const style = (await fetchOk(OFM_STYLE, ms, true)) as { sources?: Record<string, { url?: string; tiles?: string[] }> } | null;
      if (!style?.sources) return false;
      const src = Object.values(style.sources).find((s) => s.url || s.tiles);
      if (src?.url) return !!(await fetchOk(src.url, ms, true));
      if (src?.tiles?.[0]) return !!(await fetchOk(tileUrl(src.tiles[0]), ms));
      return true;
    },
  },
  {
    id: "osm",
    vector: false,
    style: () => rasterStyle(OSM, "© OpenStreetMap", 19),
    probe: (ms) => probeRaster(OSM[0], ms),
  },
  {
    id: "osmde",
    vector: false,
    style: () => rasterStyle(OSMDE, "© OpenStreetMap", 19),
    probe: (ms) => probeRaster(OSMDE[0], ms),
  },
  {
    id: "osmfr",
    vector: false,
    style: () => rasterStyle(OSMFR, "© OpenStreetMap, HOT", 19),
    probe: (ms) => probeRaster(OSMFR[0], ms),
  },
  {
    id: "esri",
    vector: false,
    style: () => rasterStyle(ESRI, "© Esri, HERE, Garmin, OpenStreetMap", 19),
    probe: (ms) => probeRaster(ESRI[0], ms),
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
  /** Человекочитаемый статус для экрана загрузки. */
  onStatus?: (text: string) => void;
  signal?: { cancelled: boolean };
}

export interface BaseMapResult {
  map: MLMap;
  provider: ProviderId;
  vector: boolean;
  /** Какие провайдеры пробовали (для диагностики). */
  tried: ProviderId[];
}

/** Сколько ждём ответа пробы: мобильная сеть бывает медленной — «долго» не значит «недоступно». */
const PROBE_MS = 8000;
/** Столько ждём более приоритетный источник, если менее приоритетный уже ответил. */
const PATIENCE_MS = 3500;
/** Сколько ждём первый отрисованный тайл у выбранного источника. */
const TILES_MS = 11000;

/** v2: старый ключ мог хранить CARTO (заглушка «API KEY REQUIRED») — начинаем с чистого листа. */
const PREF_KEY = "kidgo-map-ok2";
const readPref = (): ProviderId | null => {
  try {
    localStorage.removeItem("kidgo-map-ok");
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as { id: ProviderId; at: number } | null;
    return v && PROVIDERS.some((p) => p.id === v.id) && Date.now() - v.at < 14 * 86400_000 ? v.id : null;
  } catch {
    return null;
  }
};
const writePref = (id: ProviderId | null) => {
  try {
    if (id) localStorage.setItem(PREF_KEY, JSON.stringify({ id, at: Date.now() }));
    else localStorage.removeItem(PREF_KEY);
  } catch {
    /* приватный режим */
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ждём первый отрисованный тайл; false — нет тайлов за отведённое время (или сплошные ошибки). */
function waitForTiles(map: MLMap, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let ok = 0;
    let bad = 0;
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      map.off("data", onData as never);
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
      if (bad >= 6 && ok === 0) finish(false);
    };
    const timer = setTimeout(() => finish(ok > 0), ms);
    map.on("data", onData as never);
    map.on("error", onError);
  });
}

/**
 * Создаёт карту на первом рабочем источнике. null — ничего не доступно (или нет WebGL):
 * вызывающий код предложит запасной вариант (карта Яндекса или схема).
 *
 * Порядок: последний рабочий источник этого устройства → пробы всех источников параллельно →
 * лучший по приоритету из ответивших (если приоритетный молчит дольше PATIENCE_MS — берём тот, что ответил).
 * Источник считается рабочим только когда карта реально отрисовала тайл.
 */
export async function createBaseMap(opts: BaseMapOptions): Promise<BaseMapResult | null> {
  const ml = await loadMapLibre();
  const cancelled = () => !!opts.signal?.cancelled;
  const t0 = Date.now();
  const tried: ProviderId[] = [];

  const results: (boolean | undefined)[] = PROVIDERS.map(() => undefined);
  PROVIDERS.forEach((p, i) => {
    p.probe(PROBE_MS).then(
      (ok) => (results[i] = ok),
      () => (results[i] = false)
    );
  });

  const attempt = async (p: Provider): Promise<BaseMapResult | null> => {
    tried.push(p.id);
    opts.onStatus?.("Загружаем карту…");
    let map: MLMap;
    try {
      map = new ml.Map({
        container: opts.container,
        style: p.style(),
        center: opts.center,
        zoom: opts.zoom,
        minZoom: 6.5,
        maxBounds: REGION_BOUNDS,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 120,
      });
    } catch (err) {
      console.warn("[map] WebGL/MapLibre недоступен", err);
      return null;
    }
    map.touchZoomRotate.disableRotation();
    // подпись источника — слева над панелью: справа стоят кнопки «где я» и «сменить карту»
    map.addControl(new ml.AttributionControl({ compact: true }), "bottom-left");
    const alive = await waitForTiles(map, TILES_MS);
    if (cancelled()) {
      map.remove();
      return null;
    }
    if (alive) {
      writePref(p.id);
      return { map, provider: p.id, vector: p.vector, tried: [...tried] };
    }
    console.warn(`[map] источник ${p.id} не отдал тайлы`);
    if (readPref() === p.id) writePref(null);
    map.remove();
    return null;
  };

  // 1) то, что уже работало на этом устройстве (и не «заглушка»), — без ожидания проб
  const pref = readPref();
  if (pref) {
    const idx = PROVIDERS.findIndex((x) => x.id === pref);
    // его проба идёт параллельно с остальными; ждём её (не дольше PROBE_MS): сервер мог начать отдавать заглушки
    while (results[idx] === undefined && Date.now() - t0 < PROBE_MS + 500 && !cancelled()) await sleep(60);
    if (results[idx] === false) writePref(null);
    else if (!cancelled()) {
      const r = await attempt(PROVIDERS[idx]);
      if (r || cancelled()) return r;
    }
  }

  // 2) остальные — по приоритету из ответивших
  opts.onStatus?.("Ищем доступный сервер карты…");
  for (;;) {
    if (cancelled()) return null;
    const left = PROVIDERS.map((p, i) => ({ p, i })).filter(({ p, i }) => !tried.includes(p.id) && results[i] !== false);
    if (!left.length) return null;
    const firstTrue = left.find(({ i }) => results[i] === true);
    const higherPending = left.some(({ i }) => results[i] === undefined && (!firstTrue || i < firstTrue.i));
    if (firstTrue && (!higherPending || Date.now() - t0 > PATIENCE_MS)) {
      const r = await attempt(firstTrue.p);
      if (r || cancelled()) return r;
      continue;
    }
    await sleep(80);
  }
}

/**
 * Тёплая «детская» палитра для векторной подложки (OpenFreeMap / OpenMapTiles).
 * Цвета заданы по настоящим id слоёв стиля positron — без угадывания по подстрокам, поэтому дороги не «слипаются» в жёлтые полосы,
 * а у магистралей есть обводка. Для чужого стиля (NEXT_PUBLIC_MAP_STYLE_URL) работает прежняя эвристика.
 */
const BG = "#F5F1E8";
const WATER = "#A9D8F0";
const KID_PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": BG },
  park: { "fill-color": "#CBE8B5", "fill-opacity": 1 },
  water: { "fill-color": WATER },
  landuse_residential: { "fill-color": "#EEE8DA", "fill-opacity": 0.9 },
  landcover_wood: { "fill-color": "#BEDFA7", "fill-opacity": 0.75 },
  waterway: { "line-color": WATER },
  building: { "fill-color": "#E9E0CE", "fill-outline-color": "#DDD2BB", "fill-opacity": 0.95 },
  "aeroway-area": { "fill-color": "#E9E2D3" },
  "aeroway-taxiway": { "line-color": "#FFFFFF" },
  "aeroway-runway-casing": { "line-color": "#E2D8C2" },
  "aeroway-runway": { "line-color": "#FFFFFF" },
  highway_path: { "line-color": "#D9CFB8" },
  highway_minor: { "line-color": "#FFFFFF" },
  highway_major_casing: { "line-color": "#E7D9B2" },
  highway_major_inner: { "line-color": "#FFF6D9" },
  highway_major_subtle: { "line-color": "#EADFC2" },
  highway_motorway_casing: { "line-color": "#E3BE6B" },
  highway_motorway_inner: { "line-color": "#FFE39B" },
  highway_motorway_subtle: { "line-color": "#F1D48C" },
  highway_motorway_bridge_casing: { "line-color": "#E3BE6B" },
  highway_motorway_bridge_inner: { "line-color": "#FFE39B" },
  tunnel_motorway_casing: { "line-color": "#E7D9B2" },
  tunnel_motorway_inner: { "line-color": "#FFF1C9" },
  railway: { "line-color": "#D3C9B5" },
  railway_dashline: { "line-color": BG },
  railway_service: { "line-color": "#D8CFBC" },
  railway_service_dashline: { "line-color": BG },
  railway_transit: { "line-color": "#D3C9B5" },
  railway_transit_dashline: { "line-color": BG },
  boundary_3: { "line-color": "#C8B3C8", "line-opacity": 0.8 },
  boundary_2: { "line-color": "#B49AB6" },
  waterway_line_label: { "text-color": "#5A9AC6", "text-halo-color": "#EAF6FD" },
  water_name_point_label: { "text-color": "#5A9AC6", "text-halo-color": "#EAF6FD" },
  water_name_line_label: { "text-color": "#5A9AC6", "text-halo-color": "#EAF6FD" },
  "highway-name-path": { "text-color": "#8B8F9C", "text-halo-color": "#FFFFFF" },
  "highway-name-minor": { "text-color": "#7A7F8E", "text-halo-color": "#FFFFFF" },
  "highway-name-major": { "text-color": "#6B7080", "text-halo-color": "#FFFFFF" },
  airport: { "text-color": "#7A7F8E" },
};
const KID_LABELS = ["label_other", "label_village", "label_town", "label_state", "label_city", "label_city_capital"];
const KID_HIDE = ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us", "road_area_pier", "road_pier", "label_country_1", "label_country_2", "label_country_3"];

/** Зелень и «детские» зоны, которых нет в минималистичном стиле: луга, детские и спортивные площадки, зоопарки, парки аттракционов. */
function addKidLanduse(map: MLMap) {
  if (!map.getSource("openmaptiles")) return;
  const before = map.getLayer("park") ? "park" : map.getLayer("water") ? "water" : undefined;
  const add = (layer: Parameters<MLMap["addLayer"]>[0]) => {
    try {
      if (!map.getLayer(layer.id)) map.addLayer(layer, before);
    } catch {
      /* стиль без такого источника — не страшно */
    }
  };
  add({
    id: "kg-landcover",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    minzoom: 8,
    filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "wetland", "sand"]]],
    paint: { "fill-color": ["match", ["get", "class"], "grass", "#DCEFC8", "farmland", "#EFEBD4", "wetland", "#D6EAD3", "sand", "#F3E8C7", BG] },
  });
  add({
    id: "kg-landuse",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landuse",
    minzoom: 11,
    filter: ["in", ["get", "class"], ["literal", ["playground", "pitch", "stadium", "track", "cemetery", "zoo", "theme_park", "garden"]]],
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        "playground", "#FBE1B2",
        "pitch", "#D6EDC1",
        "stadium", "#EBE4D2",
        "track", "#EBE4D2",
        "cemetery", "#D2E6C5",
        "zoo", "#F8D9C9",
        "theme_park", "#F8D9C9",
        "garden", "#D6EDC1",
        BG,
      ],
    },
  });
}

export function applyKidStyle(map: MLMap) {
  const layers = map.getStyle()?.layers ?? [];
  const known = layers.some((l) => l.id === "highway_major_casing");
  if (known) {
    for (const [id, paint] of Object.entries(KID_PAINT)) {
      if (!map.getLayer(id)) continue;
      for (const [prop, v] of Object.entries(paint)) {
        try {
          map.setPaintProperty(id, prop as Parameters<MLMap["setPaintProperty"]>[1], v as never);
        } catch {
          /* у слоя нет такого свойства */
        }
      }
    }
    for (const id of KID_LABELS) {
      if (!map.getLayer(id)) continue;
      try {
        map.setPaintProperty(id, "text-color", id === "label_city" || id === "label_city_capital" || id === "label_state" ? "#3E4352" : "#5B6070");
        map.setPaintProperty(id, "text-halo-color", BG);
        map.setPaintProperty(id, "text-halo-width", 1.6);
      } catch {
        /* пропускаем */
      }
    }
    for (const id of KID_HIDE) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    addKidLanduse(map);
    return;
  }
  for (const l of layers) {
    try {
      const id = l.id.toLowerCase();
      const src = "source-layer" in l ? String(l["source-layer"] ?? "") : "";
      if (l.type === "background") map.setPaintProperty(l.id, "background-color", BG);
      else if (l.type === "fill" && (src === "water" || id.includes("water"))) map.setPaintProperty(l.id, "fill-color", WATER);
      else if (l.type === "fill" && (src === "park" || id.includes("park") || id.includes("wood") || id.includes("grass") || id.includes("forest")))
        map.setPaintProperty(l.id, "fill-color", "#CBE8B5");
      else if (l.type === "fill" && (src === "landuse" || src === "landcover")) map.setPaintProperty(l.id, "fill-color", "#EEE8DA");
      else if (l.type === "fill" && src === "building") map.setPaintProperty(l.id, "fill-color", "#E9E0CE");
      else if (l.type === "line" && src === "waterway") map.setPaintProperty(l.id, "line-color", WATER);
      else if (l.type === "symbol" && /poi/.test(id)) map.setLayoutProperty(l.id, "visibility", "none");
    } catch {
      /* слой без такого свойства — пропускаем */
    }
  }
}
