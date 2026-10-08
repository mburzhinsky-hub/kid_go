"use client";

import { loadMapLibre } from "@/lib/maplibre-runtime";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, Navigation, ArrowRight, X, ChevronDown, LocateOff, Plus, Minus, RefreshCw, ExternalLink, Loader2, Layers, MapPin } from "lucide-react";
import type { Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import type { CategoryId, GeoPoint, Place } from "@/lib/types";
import { allPlaces, getPlaceSync } from "@/lib/data/repository";
import { useNearbyExtras } from "@/lib/nearby";
import { DEFAULT_LOCATION, pt } from "@/lib/geo";
import { travelToPlace, nearestAreaLabel, locationMode, isSuburban } from "@/lib/location";
import { GeoScope } from "@/components/location/GeoScope";
import { inMoscow, okrugOfOrigin, tierOf } from "@/lib/moscow";
import { orderByArea } from "@/lib/area-fit";
import { ageWord, isFreeEntry, openState } from "@/lib/format";
import { categoryDef } from "@/lib/catalog";
import { useFamily } from "@/lib/store";
import { MapMarker } from "./MapMarker";
import { declutter, type MarkerLayout } from "./declutter";
import { PlaceBottomSheet } from "./PlaceBottomSheet";
import { StylizedMap, makeProjector } from "./StylizedMap";
import { createBaseMap, applyKidStyle, type ProviderId } from "./base-map";
import { frameOf, yandexMapsUrl, yandexWidgetUrl } from "./map-links";
import { MapPlaceChip } from "./MapPlaceChip";
import { FilterChip } from "@/components/ui/FilterChip";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TabBackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/analytics";
import { IntentSourceProvider } from "@/lib/social/intent-source";
import { cn } from "@/lib/cn";

/** Москва в пределах МКАД: [запад, юг], [восток, север]. */
const MKAD_BOX: [[number, number], [number, number]] = [
  [37.37, 55.57],
  [37.87, 55.915],
];
/** Основная часть каталога Подмосковья: запад, северо-восток, юг и восток. */
const MOSCOW_REGION_BOX: [[number, number], [number, number]] = [
  [36.65, 55.05],
  [38.85, 56.35],
];

type Toggle = "near" | "open" | "indoor" | "outdoor" | "cafe" | "parking" | "free";
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: "near", label: "Рядом сейчас" },
  { id: "open", label: "Сейчас открыто" },
  { id: "indoor", label: "Под крышей" },
  { id: "outdoor", label: "На улице" },
  { id: "cafe", label: "Кафе" },
  { id: "parking", label: "Парковка" },
  { id: "free", label: "Бесплатно" },
];
const AGES = [
  { id: "baby", label: "0–2 года", range: [0, 2] },
  { id: "pre", label: "3–5 лет", range: [3, 5] },
  { id: "school", label: "6–8 лет", range: [6, 8] },
  { id: "big", label: "9–12 лет", range: [9, 12] },
] as const;
const PRICES = [
  { id: "500", label: "до 500 ₽", max: 500 },
  { id: "1000", label: "до 1 000 ₽", max: 1000 },
  { id: "2000", label: "до 2 000 ₽", max: 2000 },
] as const;

/** Набор мест без маршрута — подборка автора: только её места, без линии «шаг за шагом». */
export interface MapSet {
  slugs: string[];
  title?: string;
  creator_id?: string;
  collection_id?: string;
}

export function MapScreen({ initialCategory, initialFocus, initialPlan, initialSet }: { initialCategory?: CategoryId; initialFocus?: string; initialPlan?: string[]; initialSet?: MapSet }) {
  const isSet = !!initialSet?.slugs.length;
  const planInput = isSet ? initialSet!.slugs : initialPlan;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, MLMarker>>(new Map());
  const userMarkerRef = useRef<MLMarker | null>(null);
  const [els, setEls] = useState<Record<string, HTMLElement>>({});
  const [mode, setMode] = useState<"loading" | "map" | "fallback" | "yandex">("loading");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Загружаем карту…");
  const [slow, setSlow] = useState(false);
  /** Пользователь сам переключился на другой вид карты (основная при этом остаётся живой под ним). */
  const [manual, setManual] = useState(false);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [zoom, setZoom] = useState(11);
  const [layout, setLayout] = useState<Record<string, MarkerLayout>>({});
  const [viewTick, setViewTick] = useState(0);
  const [fz, setFz] = useState(1); // зум схемы без подложки
  const [selected, setSelected] = useState<string | null>(initialFocus ?? null);
  const [query, setQuery] = useState("");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [age, setAge] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | undefined>(initialCategory);
  const [sheet, setSheet] = useState<"age" | "price" | null>(null);
  const [user, setUser] = useState<GeoPoint>(DEFAULT_LOCATION);
  const [geo, setGeo] = useState<"idle" | "ok" | "denied">("idle");
  const kids = useFamily((s) => s.children);
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  const setOrigin = useFamily((s) => s.setOrigin);
  const transport = useFamily((s) => s.transport);
  const maxTravelMin = useFamily((s) => s.maxTravelMin);
  const geoScope = useFamily((s) => s.geoScope);
  const setPrefs = useFamily((s) => s.setPrefs);
  // каталог + места рядом из OpenStreetMap (для тех, у кого каталог редкий)
  const { places: extra } = useNearbyExtras();
  const pool = useMemo(() => (extra.length ? [...allPlaces, ...extra] : allPlaces), [extra]);
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const poolBySlug = useMemo(() => new Map(pool.map((p) => [p.slug, p])), [pool]);
  const planPlaces = useMemo(() => (planInput ?? []).map((x) => poolBySlug.get(x) ?? getPlaceSync(x)).filter(Boolean) as Place[], [planInput, poolBySlug]);
  const planSlugs = useMemo(() => planPlaces.map((p) => p.slug), [planPlaces]);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const anywhereRef = useRef(false);
  anywhereRef.current = hydrated && locationMode(origin) === "any";
  const okrugRef = useRef<string | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);
  const anywhere = hydrated && locationMode(origin) === "any";
  const withRegion = anywhere && geoScope === "moscow-region";
  const okrug = useMemo(() => (hydrated ? okrugOfOrigin(origin) : undefined), [hydrated, origin]);
  okrugRef.current = okrug?.id;
  // точка выезда семьи — она же «я» на карте
  useEffect(() => {
    if (hydrated && origin.source !== "default") setUser({ lat: origin.lat, lng: origin.lng });
  }, [hydrated, origin]);
  // схема без подложки: кадр = точка выезда + ближайшие места (влезают в экран)
  const fbFrame = useMemo(() => {
    const me: GeoPoint = origin.source !== "default" ? { lat: origin.lat, lng: origin.lng } : DEFAULT_LOCATION;
    // Общий режим: Москва или расширенный кадр Москвы и области.
    if (origin.source === "default" && !planPlaces.length)
      return withRegion
        ? { center: { lat: 55.72, lng: 37.74 } as GeoPoint, zoom: 0.48 }
        : { center: DEFAULT_LOCATION as GeoPoint, zoom: 1.15 };
    const near = planPlaces.length
      ? planPlaces
      : [...pool].sort((a, b) => travelToPlace(me, a, "car").minutes - travelToPlace(me, b, "car").minutes).slice(0, 8);
    const pts = [me, ...near.map((p) => ({ lat: p.latitude, lng: p.longitude }))];
    const lat = (Math.min(...pts.map((q) => q.lat)) + Math.max(...pts.map((q) => q.lat))) / 2;
    const lng = (Math.min(...pts.map((q) => q.lng)) + Math.max(...pts.map((q) => q.lng))) / 2;
    const kmY = (Math.max(...pts.map((q) => q.lat)) - Math.min(...pts.map((q) => q.lat))) * 110.57;
    const kmX = (Math.max(...pts.map((q) => q.lng)) - Math.min(...pts.map((q) => q.lng))) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const extent = Math.max(kmX / 300, kmY / 360, 0.01);
    return { center: { lat, lng } as GeoPoint, zoom: Math.max(0.35, Math.min(3, (1 / (extent * 9)) * 0.72)) };
  }, [origin, planPlaces, pool, withRegion]);
  const fbCenter = fbFrame.center;
  useEffect(() => {
    if (mode === "fallback") setFz(fbFrame.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const fbProject = useMemo(() => makeProjector(fbCenter, fz).project, [fbCenter, fz]);
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetH, setSheetH] = useState(236);
  // панель уходит под нижнюю навигацию (padding), поэтому под ней не остаётся полоски карты
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // список можно свернуть, чтобы видеть карту целиком
  const [collapsed, setCollapsed] = useState(false);

  /* ───── фильтрация ───── */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    if (planSlugs.length) return planPlaces;
    return pool.filter((p) => {
      // Общий режим: по умолчанию Москва; по явному фильтру добавляем Подмосковье.
      if (anywhere && !withRegion && (!inMoscow(p) || isSuburban(pt(p)))) return false;
      if (category && p.category !== category) return false;
      // кафе и магазины из OSM — только по запросу, иначе они заслоняют места, куда стоит ехать
      if (p.confidence === "osm" && (p.category === "cafe" || p.category === "shop") && !(toggles.has("cafe") || category === "cafe" || category === "shop" || q)) return false;
      if (toggles.has("near") && (travelToPlace(user, p, transport).minutes > maxTravelMin || !openState(p.opening_hours, now).open)) return false;
      if (q && !`${p.title} ${p.subtitle} ${p.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      if (toggles.has("open") && !openState(p.opening_hours, now).open) return false;
      if (toggles.has("indoor") && !p.indoor) return false;
      if (toggles.has("outdoor") && !p.outdoor) return false;
      if (toggles.has("cafe") && !(p.category === "cafe" || p.experience_tags.includes("cafe"))) return false;
      if (toggles.has("parking") && !p.parking) return false;
      if (toggles.has("free") && !isFreeEntry(p)) return false;
      if (age) {
        const [a, b] = AGES.find((x) => x.id === age)!.range;
        if (p.age_max < a || p.age_min > b) return false;
      }
      if (price) {
        const max = PRICES.find((x) => x.id === price)!.max;
        if (p.price_min > max) return false;
      }
      return true;
    });
  }, [query, toggles, age, price, category, user, transport, maxTravelMin, planSlugs, planPlaces, pool, anywhere, withRegion]);
  const visibleIds = useMemo(() => new Set(visible.map((p) => p.slug)), [visible]);
  const nearby = useMemo(() => {
    if (planSlugs.length) return visible.map((p) => ({ p, min: 0 }));
    const quality = (p: Place) => p.rating * 2 + Math.log10(p.review_count + 1) + (p.is_hit ? 1 : 0);
    // Без точки «рядом» не считаем. В широком охвате намеренно показываем
    // несколько подмосковных вариантов в первой ленте, чтобы они не терялись среди Москвы.
    if (anywhere) {
      const ranked = visible.map((p) => ({ p, min: 0, s: quality(p) })).sort((a, b) => b.s - a.s);
      if (!withRegion) return ranked;
      const city = ranked.filter(({ p }) => inMoscow(p) && !isSuburban(pt(p)));
      const region = ranked.filter(({ p }) => !inMoscow(p) || isSuburban(pt(p)));
      const first = [...city.slice(0, 8), ...region.slice(0, 6)];
      const used = new Set(first.map(({ p }) => p.slug));
      return [...first, ...ranked.filter(({ p }) => !used.has(p.slug))];
    }
    const minOf = (p: Place) => travelToPlace(user, p, transport).minutes;
    if (okrug) {
      // выбран округ: сначала лучшее в нём самом, затем у соседей; из других концов города — только если рядом почти ничего нет
      return orderByArea(visible, (p) => p, okrug, quality, { enough: 3, fallback: (a, b) => minOf(a) - minOf(b) }).list.map((p) => ({ p, min: minOf(p) }));
    }
    return visible.map((p) => ({ p, min: minOf(p) })).sort((a, b) => a.min - b.min);
  }, [visible, user, transport, planSlugs, anywhere, okrug, withRegion]);
  // ссылки на Яндекс Карты: рамка — по лучшим местам выдачи (или точке выезда)
  const yFrame = useMemo(() => {
    const top = nearby.slice(0, 30).map(({ p }) => ({ lat: p.latitude, lng: p.longitude }));
    if (planPlaces.length) return { ...frameOf(top.length ? top : [DEFAULT_LOCATION]), pins: planPlaces.map((p, i) => ({ lat: p.latitude, lng: p.longitude, n: i + 1 })) };
    if (anywhere)
      return withRegion
        ? { center: { lat: 55.72, lng: 37.74 } as GeoPoint, zoom: 8, pins: top.slice(0, 20) }
        : { center: DEFAULT_LOCATION as GeoPoint, zoom: 10, pins: top.slice(0, 20) };
    const pts = [{ lat: user.lat, lng: user.lng }, ...top.slice(0, 8)];
    return { ...frameOf(pts), pins: [...top.slice(0, 15)] };
  }, [nearby, planPlaces, anywhere, user, withRegion]);
  const ySrc = useMemo(() => yandexWidgetUrl(yFrame.center, yFrame.zoom, yFrame.pins), [yFrame]);
  const yLink = useMemo(() => yandexMapsUrl(yFrame.center, yFrame.zoom, yFrame.pins), [yFrame]);
  const selectedPlace = selected ? poolBySlug.get(selected) ?? getPlaceSync(selected) : null;

  /* ───── инициализация карты ───── */
  // Ждём гидрации, чтобы сразу открыть карту у точки выезда семьи (а не в центре Москвы).
  const startRef = useRef<GeoPoint | null>(null);
  if (hydrated && !startRef.current) startRef.current = origin.source !== "default" ? { lat: origin.lat, lng: origin.lng } : DEFAULT_LOCATION;
  const start = startRef.current;
  useEffect(() => {
    if (!start || !containerRef.current) return;
    const flag = { cancelled: false };
    (async () => {
      const res = await createBaseMap({ container: containerRef.current!, center: [start.lng, start.lat], zoom: anywhereRef.current ? 9.9 : 10.6, signal: flag, onStatus: setStatus });
      if (flag.cancelled) return;
      if (!res) {
        // нет подложки: онлайн → карта Яндекса (открывается там, где иностранные тайлы — нет), офлайн → схема
        setMode(typeof navigator !== "undefined" && navigator.onLine === false ? "fallback" : "yandex");
        return;
      }
      const { map } = res;
      const ml = await loadMapLibre();
      if (flag.cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      mlRef.current = ml as unknown as typeof import("maplibre-gl");
      setProvider(res.provider);
      track("map_ready", { provider: res.provider, tried: res.tried.join(",") });
      const ready = () => {
        if (res.vector) applyKidStyle(map);
        if (planPlaces.length > 1 && !isSet) {
          map.addSource("plan-route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: planPlaces.map((p) => [p.longitude, p.latitude]) } },
          });
          map.addLayer({ id: "plan-route-casing", type: "line", source: "plan-route", paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
          map.addLayer({ id: "plan-route", type: "line", source: "plan-route", paint: { "line-color": "#FF2E88", "line-width": 4, "line-dasharray": [1.5, 1.2] }, layout: { "line-cap": "round", "line-join": "round" } });
        }
        // кадр: маршрут целиком; «вся Москва» — город в пределах МКАД над панелью; иначе — точка выезда и ближайшие места
        const pad = { top: 150, bottom: (sheetRef.current?.offsetHeight ?? 236) + 24, left: 28, right: 28 };
        if (!planPlaces.length && anywhereRef.current) {
          map.fitBounds(geoScope === "moscow-region" ? MOSCOW_REGION_BOX : MKAD_BOX, { padding: pad, duration: 0, maxZoom: 11 });
          setZoom(map.getZoom());
          setMode("map");
          setMapReady(true);
          return;
        }
        const bounds = new ml.LngLatBounds([start.lng, start.lat], [start.lng, start.lat]);
        const near = planPlaces.length
          ? planPlaces
          : [...poolRef.current]
              .filter((p) => !okrugRef.current || tierOf(p, okrugRef.current) <= 1)
              .sort((a, b) => travelToPlace(start, a, "car").minutes - travelToPlace(start, b, "car").minutes)
              .slice(0, 12);
        near.forEach((p) => bounds.extend([p.longitude, p.latitude]));
        if (planPlaces.length && !isSet) bounds.extend([start.lng, start.lat]);
        map.fitBounds(bounds, { padding: pad, duration: 0, maxZoom: 14 });
        setZoom(map.getZoom());
        setMode("map");
        setMapReady(true);
      };
      if (map.isStyleLoaded()) ready();
      else map.once("load", ready);
      map.on("zoomend", () => setZoom(map.getZoom()));
      map.on("moveend", () => setViewTick((t) => t + 1));
      map.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).closest(".kg-marker")) return;
        setSelected(null);
      });
    })().catch((err) => {
      console.warn("[map] ошибка инициализации", err);
      if (!flag.cancelled) setMode(typeof navigator !== "undefined" && navigator.onLine === false ? "fallback" : "yandex");
    });
    return () => {
      flag.cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      markersRef.current.clear();
      mlRef.current = null;
      setMapReady(false);
      setEls({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, attempt, geoScope]);

  // «Долго грузится» — через 6 секунд предлагаем не ждать; вернулась сеть — пробуем снова сами
  useEffect(() => {
    if (mode !== "loading") {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [mode, attempt]);
  const retry = useCallback(() => {
    setManual(false);
    if (mapRef.current) {
      setMode("map");
      return;
    }
    setMode("loading");
    setStatus("Загружаем карту…");
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    const on = () => mode !== "map" && retry();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [mode, retry]);

  /* Маркеры мест: добавляем/убираем при смене набора (места рядом подгружаются позже карты) */
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !mapReady) return;
    const have = markersRef.current;
    const want = new Set(pool.map((p) => p.slug));
    const gone: string[] = [];
    for (const [slug, m] of have) {
      if (!want.has(slug)) {
        m.remove();
        have.delete(slug);
        gone.push(slug);
      }
    }
    const created: Record<string, HTMLElement> = {};
    for (const p of pool) {
      if (have.has(p.slug)) continue;
      const el = document.createElement("div");
      el.className = "kg-marker";
      created[p.slug] = el;
      have.set(p.slug, new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([p.longitude, p.latitude]).addTo(map));
    }
    if (gone.length || Object.keys(created).length)
      setEls((prev) => {
        const n = { ...prev, ...created };
        for (const g of gone) delete n[g];
        return n;
      });
  }, [pool, mapReady]);

  /* Точка выезда («я») — всегда на карте */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "map") return;
    // «я» рисуем только для точного места (GPS, адрес, «Дом»): центр округа — условность, а не геопозиция
    if (locationMode(origin) !== "exact") {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    (async () => {
      const ml = await loadMapLibre();
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.innerHTML = '<span class="kg-user-dot"></span>';
        userMarkerRef.current = new ml.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
      } else userMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    })();
  }, [mode, origin]);

  /* сменили «где ищем» при открытой карте — летим туда */
  const seenOrigin = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const key = `${origin.source}:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}`;
    const prev = seenOrigin.current;
    seenOrigin.current = key;
    const map = mapRef.current;
    if (!prev || prev === key || !map || mode !== "map" || planSlugs.length) return;
    const m = locationMode(origin);
    if (m === "any") map.fitBounds(geoScope === "moscow-region" ? MOSCOW_REGION_BOX : MKAD_BOX, { padding: { top: 150, bottom: (sheetRef.current?.offsetHeight ?? 236) + 24, left: 28, right: 28 }, maxZoom: 11, duration: 700 });
    else map.flyTo({ center: [origin.lng, origin.lat], zoom: m === "area" ? 11.2 : 12.8, offset: [0, -(sheetRef.current?.offsetHeight ?? 236) / 3] });
  }, [origin, hydrated, mode, planSlugs.length, geoScope]);

  /* раскладка без наложений: пересчёт при фильтрах, выборе, зуме и сдвиге карты */
  useEffect(() => {
    const map = mapRef.current;
    const items = visible.map((p) => {
      if (mode === "map" && map) {
        const pt2 = map.project([p.longitude, p.latitude]);
        return { place: p, x: pt2.x, y: pt2.y };
      }
      const { x, y } = fbProject(p.latitude, p.longitude);
      return { place: p, x: x + 200, y: y + 330 };
    });
    const z = mode === "map" ? zoom : fz >= 2.2 ? 13.3 : fz >= 1.5 ? 12.4 : 11.8;
    setLayout(
      declutter(items, {
        selected,
        cardsAllowed: (p) => z >= 13.2 || (z >= 11.4 && !!p.is_hit),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selected, zoom, viewTick, mode, fz]);

  useEffect(() => {
    for (const [slug, el] of Object.entries(els)) {
      const l = layout[slug];
      el.style.display = visibleIds.has(slug) && l && !l.hidden ? "" : "none";
      el.style.zIndex = slug === selected ? "10" : l?.variant === "card" ? "3" : "1";
    }
  }, [els, visibleIds, selected, layout]);

  /* выбор маркера → плавно центрируем над шитом */
  const select = useCallback((slug: string) => {
    setSelected(slug);
    track("map_marker_click", { slug });
    const p = poolRef.current.find((x) => x.slug === slug) ?? getPlaceSync(slug);
    const map = mapRef.current;
    if (p && map) map.easeTo({ center: [p.longitude, p.latitude], zoom: Math.max(map.getZoom(), 12.4), offset: [0, -90], duration: 500 });
  }, []);

  useEffect(() => {
    if (initialFocus && mode === "map") select(initialFocus);
  }, [initialFocus, mode, select]);

  /* геолокация */
  const locate = (thenNear = false) => {
    if (!navigator.geolocation) return setGeo("denied");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUser(loc);
        setGeo("ok");
        if (thenNear) setToggles((t) => new Set(t).add("near"));
        setOrigin({ ...loc, label: nearestAreaLabel(loc), source: "gps" });
        const map = mapRef.current;
        if (map) map.flyTo({ center: [loc.lng, loc.lat], zoom: 13, offset: [0, -60] });
        track("map_locate", {});
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const toggle = (t: Toggle) => {
    // «Рядом сейчас» нужна точка: пока выбрана вся Москва — спрашиваем геопозицию и только потом включаем фильтр
    if (t === "near" && anywhere && !toggles.has("near")) return locate(true);
    setToggles((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      if (t === "indoor") n.delete("outdoor");
      if (t === "outdoor") n.delete("indoor");
      return n;
    });
  };

  const activeCount = toggles.size + (age ? 1 : 0) + (price ? 1 : 0) + (category ? 1 : 0);
  const reset = () => {
    setToggles(new Set());
    setAge(null);
    setPrice(null);
    setCategory(undefined);
    setQuery("");
  };

  return (
    <IntentSourceProvider value={{ source_type: "MAP", creator_id: initialSet?.creator_id, collection_id: initialSet?.collection_id }}>
    <main
      className="fixed inset-0 mx-auto max-w-[480px] overflow-hidden bg-[#efebe3]"
      style={{ ["--sheet-h" as string]: `${sheetH}px` }}
    >
      <h1 className="sr-only">Карта мест</h1>
      {/* карта */}
      {/* position задан inline: maplibre-gl.css (без @layer) иначе перебивает tailwind-класс и карта схлопывается до 300px */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} className={cn(mode === "fallback" && "invisible")} />
      {mode === "fallback" && (
        <StylizedMap center={fbCenter} zoom={fz} origin={locationMode(origin) === "exact" ? origin : undefined}>
          {visible.map((p) => {
            const l = layout[p.slug];
            if (!l || l.hidden) return null;
            const { x, y } = fbProject(p.latitude, p.longitude);
            return (
              <div key={p.slug} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: x, top: y, zIndex: p.slug === selected ? 10 : l.variant === "card" ? 3 : 1 }}>
                <MapMarker
                  place={p}
                  variant={l.variant}
                  extra={l.extra}
                  selected={p.slug === selected}
                  onClick={() => {
                    setSelected(p.slug);
                    if (l.extra > 0) setFz((z) => Math.min(4, z * 1.6));
                  }}
                />
              </div>
            );
          })}
          {planPlaces.length > 1 && !isSet && (
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
              <polyline
                points={planPlaces.map((p) => `${fbProject(p.latitude, p.longitude).x},${fbProject(p.latitude, p.longitude).y}`).join(" ")}
                fill="none"
                stroke="#FF2E88"
                strokeWidth={3}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            </svg>
          )}
          {locationMode(origin) === "exact" && <span className="kg-user-dot absolute" style={{ left: fbProject(user.lat, user.lng).x, top: fbProject(user.lat, user.lng).y }} />}
        </StylizedMap>
      )}
      {mode === "yandex" && (
        <iframe
          key={ySrc}
          src={ySrc}
          title="Карта (Яндекс)"
          className="absolute inset-0 h-full w-full border-0 bg-[#efebe3]"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation"
        />
      )}
      {mode === "loading" && (
        <div className="absolute inset-0 skeleton opacity-60">
          <span className="absolute left-1/2 top-[38%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[14px] font-medium text-ink-2 shadow-card">
            <Loader2 size={16} className="animate-spin" /> {status}
          </span>
        </div>
      )}
      {Object.entries(els).map(([slug, el]) => {
        const p = poolBySlug.get(slug);
        if (!p) return null;
        const l = layout[slug];
        return createPortal(
          <MapMarker place={p} variant={l?.variant ?? "dot"} extra={l?.extra ?? 0} selected={slug === selected} onClick={() => select(slug)} />,
          el,
          slug
        );
      })}

      {/* поиск и фильтры */}
      <div className="absolute inset-x-0 top-0 z-20 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 px-4">
          <TabBackButton tone="float" />
          {planSlugs.length ? (
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-float">
              <MapPin size={20} className="shrink-0 text-pink-ink" />
              <span className="truncate text-[17px] font-semibold">{isSet ? (initialSet?.title ?? "Подборка") : "Маршрут дня"}</span>
              <span className="ml-auto shrink-0 text-[14px] text-muted">{planSlugs.length}</span>
            </div>
          ) : (
            <>
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-float">
            <Search size={24} strokeWidth={2} className="text-ink-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск мест"
              aria-label="Поиск мест на карте"
              className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Очистить" className="text-muted">
                <X size={20} />
              </button>
            )}
          </label>
          <button
            onClick={() => (activeCount ? reset() : setSheet("age"))}
            aria-label={activeCount ? "Сбросить фильтры" : "Фильтры"}
            className="press relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white shadow-float"
          >
            <SlidersHorizontal size={20} strokeWidth={2} />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink-ink px-1 text-[11px] font-bold text-white">{activeCount}</span>
            )}
          </button>
            </>
          )}
        </div>
        {!planSlugs.length && (
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4 pb-2">
          {category && (
            <FilterChip active size="sm" onClick={() => setCategory(undefined)}>
              {categoryDef(category).label} <X size={14} />
            </FilterChip>
          )}
          {anywhere && <GeoScope where="map" size="sm" className="shrink-0" />}
          <FilterChip size="sm" active={!!age} onClick={() => setSheet("age")}>
            {age ? AGES.find((a) => a.id === age)!.label : "Возраст"} <ChevronDown size={14} />
          </FilterChip>
          <FilterChip size="sm" active={!!price} onClick={() => setSheet("price")}>
            {price ? PRICES.find((a) => a.id === price)!.label : "Цена"} <ChevronDown size={14} />
          </FilterChip>
          {TOGGLES.map((t) => (
            <FilterChip key={t.id} size="sm" active={toggles.has(t.id)} onClick={() => toggle(t.id)}>
              {t.label}
            </FilterChip>
          ))}
        </div>
        )}
        {(mode === "fallback" || mode === "yandex" || (mode === "loading" && slow)) && (
          <div className="mx-4 mt-1 rounded-[16px] bg-white/95 p-2 shadow-card animate-rise" role="status">
            <p className="px-1.5 text-[13px] leading-snug text-ink-2">
              {mode === "loading"
                ? "Карта грузится дольше обычного."
                : manual
                  ? "Другой вид карты. Места — в списке ниже; вернуться к основной карте — «Основная»."
                  : "Карта не загрузилась — возможно, слабый интернет. Откройте другой вид или повторите."}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {manual && (
                <button onClick={retry} className="press hit relative h-10 rounded-full bg-ink px-4 text-[14px] font-semibold text-white">
                  Основная
                </button>
              )}
              <button onClick={() => setMode("yandex")} className={cn("press hit relative h-10 rounded-full px-4 text-[14px] font-semibold", mode === "yandex" ? "bg-ink text-white" : "bg-fill")}>
                Карта Яндекса
              </button>
              <button onClick={() => setMode("fallback")} className={cn("press hit relative h-10 rounded-full px-4 text-[14px] font-semibold", mode === "fallback" ? "bg-ink text-white" : "bg-fill")}>
                Схема
              </button>
              {!manual && (
                <button onClick={retry} className="press hit relative inline-flex h-10 items-center gap-1.5 rounded-full bg-fill px-4 text-[14px] font-semibold">
                  <RefreshCw size={14} /> Повторить
                </button>
              )}
              <a href={yLink} target="_blank" rel="noopener noreferrer" className="press hit relative inline-flex h-10 items-center gap-1.5 rounded-full bg-fill px-4 text-[14px] font-semibold text-blue-ink">
                <ExternalLink size={14} /> В приложении
              </a>
            </div>
          </div>
        )}
        {geo === "denied" && (
          <div className="mx-4 mt-1 flex items-center gap-2 rounded-[16px] bg-white/95 px-3 py-2 text-[13px] shadow-card animate-rise">
            <LocateOff size={16} className="shrink-0 text-red-ink" />
            <span className="flex-1">Геолокация выключена. {origin.source === "default" ? (withRegion ? "Показываем Москву и Подмосковье." : "Показываем Москву — Подмосковье можно добавить фильтром.") : `Считаем дорогу от «${origin.label}».`}</span>
            <button onClick={() => setGeo("idle")} aria-label="Скрыть" className="text-muted">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {mode === "fallback" && (
        <div className="absolute right-4 z-20 flex flex-col overflow-hidden rounded-[20px] bg-white shadow-float" style={{ bottom: "calc(var(--sheet-h) + 80px)" }}>
          <button onClick={() => setFz((z) => Math.min(4, z * 1.5))} aria-label="Приблизить" className="press grid h-11 w-12 place-items-center border-b border-line">
            <Plus size={20} />
          </button>
          <button onClick={() => setFz((z) => Math.max(0.5, z / 1.5))} aria-label="Отдалить" className="press grid h-11 w-12 place-items-center rounded-[20px]">
            <Minus size={20} />
          </button>
        </div>
      )}

      {/* другой вид карты: если подложка выглядит странно или не открывается */}
      {mode === "map" && (
        <button
          onClick={() => {
            setManual(true);
            setMode("yandex");
          }}
          aria-label="Сменить карту"
          className="press absolute right-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-white text-ink-2 shadow-float"
          style={{ bottom: "calc(var(--sheet-h) + 78px)" }}
        >
          <Layers size={20} strokeWidth={2} />
        </button>
      )}

      {/* моя геопозиция */}
      <button
        onClick={() => locate()}
        aria-label="Где я"
        className="press absolute right-4 z-20 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-blue-ink shadow-float"
        style={{ bottom: "calc(var(--sheet-h) + 16px)" }}
      >
        <Navigation size={24} strokeWidth={2} className={cn(geo === "ok" && "fill-blue")} />
      </button>

      {/* нижняя панель */}
      <section
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-white pt-1 shadow-[0_-10px_30px_rgba(17,18,26,0.08)]"
        style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Показать список мест" : "Свернуть список, чтобы видеть карту"}
          aria-expanded={!collapsed}
          className="hit relative mx-auto grid h-6 w-24 place-items-center"
        >
          <span className="h-[5px] w-10 rounded-full bg-[#dcdad4]" />
        </button>
        {selectedPlace ? (
          <div className="px-4 pt-3">
            <PlaceBottomSheet key={selectedPlace.slug} place={selectedPlace} minutes={anywhere ? undefined : travelToPlace(user, selectedPlace, transport).minutes} onClose={() => setSelected(null)} />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between px-4 pt-1">
              <h2 className="tight text-[22px] font-[800]">
                {planSlugs.length
                  ? isSet
                    ? (initialSet?.title ?? "Подборка")
                    : "Маршрут дня"
                  : activeCount === 0 && !query.trim()
                    ? anywhere
                      ? withRegion ? "Москва + Подмосковье" : "Лучшее в Москве"
                      : okrug
                        ? `Лучшее ${okrug.prep}`
                        : "Рядом с вами"
                    : `Нашли ${nearby.length}`}
              </h2>
              <Link href="/search" className="press hit relative flex items-center gap-1 text-[16px] font-medium text-blue-ink">
                Все <ArrowRight size={20} />
              </Link>
            </div>
            {collapsed ? null : nearby.length ? (
              <div className="no-scrollbar snap-x-pad mt-2 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 pt-1">
                {nearby.slice(0, 14).map(({ p }, i) => (
                  <MapPlaceChip key={p.id} place={p} caption={planSlugs.length && !isSet ? `Шаг ${i + 1}` : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState
                className="py-3"
                art="map"
                title="Здесь ничего не нашлось"
                text="Попробуйте убрать часть фильтров"
                secondary={
                  <button onClick={reset} className="press mt-3 rounded-full bg-pink-50 px-5 py-2.5 text-[15px] font-semibold text-pink-ink">
                    Сбросить фильтры
                  </button>
                }
              />
            )}
          </>
        )}
      </section>

      <BottomSheet open={sheet === "age"} onClose={() => setSheet(null)} title="Возраст детей">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {kids.length > 0 && (
            <button
              onClick={() => {
                const min = Math.min(...kids.map((k) => k.age));
                const g = AGES.find((a) => min >= a.range[0] && min <= a.range[1]);
                setAge(g?.id ?? null);
                setSheet(null);
              }}
              className="press col-span-2 h-14 rounded-[20px] bg-pink-50 text-[16px] font-semibold text-pink-ink"
            >
              Как у наших: {kids.map((k) => (k.name?.trim() ? `${k.name.trim()}, ${ageWord(k.age)}` : ageWord(k.age))).join(" · ")}
            </button>
          )}
          {AGES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAge(age === a.id ? null : a.id);
                setSheet(null);
              }}
              className={cn("press h-14 rounded-[20px] text-[16px] font-semibold", age === a.id ? "bg-ink text-white" : "bg-fill")}
            >
              {a.label}
            </button>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === "price"} onClose={() => setSheet(null)} title="Цена входа">
        <div className="grid grid-cols-2 gap-2 pb-2">
          <button
            onClick={() => {
              toggle("free");
              setSheet(null);
            }}
            className={cn("press h-14 rounded-[20px] text-[16px] font-semibold", toggles.has("free") ? "bg-ink text-white" : "bg-green-50 text-green-ink")}
          >
            Бесплатно
          </button>
          {PRICES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setPrice(price === a.id ? null : a.id);
                setSheet(null);
              }}
              className={cn("press h-14 rounded-[20px] text-[16px] font-semibold", price === a.id ? "bg-ink text-white" : "bg-fill")}
            >
              {a.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </main>
    </IntentSourceProvider>
  );
}
