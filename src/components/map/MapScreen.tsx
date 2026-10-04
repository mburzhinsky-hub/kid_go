"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, Navigation, ArrowRight, X, ChevronDown, LocateOff, Plus, Minus } from "lucide-react";
import type { Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import type { CategoryId, GeoPoint, Place } from "@/lib/types";
import { allPlaces, getPlaceSync } from "@/lib/data/repository";
import { useNearbyExtras } from "@/lib/nearby";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { travelToPlace, nearestAreaLabel } from "@/lib/location";
import { openState } from "@/lib/format";
import { categoryDef } from "@/lib/catalog";
import { useFamily } from "@/lib/store";
import { MapMarker } from "./MapMarker";
import { declutter, type MarkerLayout } from "./declutter";
import { PlaceBottomSheet } from "./PlaceBottomSheet";
import { StylizedMap, makeProjector } from "./StylizedMap";
import { createBaseMap, applyKidStyle, type ProviderId } from "./base-map";
import { PlaceCard } from "@/components/cards/PlaceCard";
import { FilterChip } from "@/components/ui/FilterChip";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

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

export function MapScreen({ initialCategory, initialFocus, initialPlan }: { initialCategory?: CategoryId; initialFocus?: string; initialPlan?: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, MLMarker>>(new Map());
  const userMarkerRef = useRef<MLMarker | null>(null);
  const [els, setEls] = useState<Record<string, HTMLElement>>({});
  const [mode, setMode] = useState<"loading" | "map" | "fallback">("loading");
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
  // каталог + места рядом из OpenStreetMap (для тех, у кого каталог редкий)
  const { places: extra } = useNearbyExtras();
  const pool = useMemo(() => (extra.length ? [...allPlaces, ...extra] : allPlaces), [extra]);
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const poolBySlug = useMemo(() => new Map(pool.map((p) => [p.slug, p])), [pool]);
  const planPlaces = useMemo(() => (initialPlan ?? []).map((x) => poolBySlug.get(x) ?? getPlaceSync(x)).filter(Boolean) as Place[], [initialPlan, poolBySlug]);
  const planSlugs = useMemo(() => planPlaces.map((p) => p.slug), [planPlaces]);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // точка выезда семьи — она же «я» на карте
  useEffect(() => {
    if (hydrated && origin.source !== "default") setUser({ lat: origin.lat, lng: origin.lng });
  }, [hydrated, origin]);
  // схема без подложки: кадр = точка выезда + ближайшие места (влезают в экран)
  const fbFrame = useMemo(() => {
    const me: GeoPoint = origin.source !== "default" ? { lat: origin.lat, lng: origin.lng } : DEFAULT_LOCATION;
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
  }, [origin, planPlaces, pool]);
  const fbCenter = fbFrame.center;
  useEffect(() => {
    if (mode === "fallback") setFz(fbFrame.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const fbProject = useMemo(() => makeProjector(fbCenter, fz).project, [fbCenter, fz]);
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetH, setSheetH] = useState(300);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight + 66));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ───── фильтрация ───── */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    if (planSlugs.length) return planPlaces;
    return pool.filter((p) => {
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
      if (toggles.has("free") && p.price_min !== 0) return false;
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
  }, [query, toggles, age, price, category, user, transport, maxTravelMin, planSlugs, planPlaces, pool]);
  const visibleIds = useMemo(() => new Set(visible.map((p) => p.slug)), [visible]);
  const nearby = useMemo(
    () =>
      planSlugs.length
        ? visible.map((p) => ({ p, min: 0 }))
        : visible.map((p) => ({ p, min: travelToPlace(user, p, transport).minutes })).sort((a, b) => a.min - b.min),
    [visible, user, transport, planSlugs]
  );
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
      const res = await createBaseMap({ container: containerRef.current!, center: [start.lng, start.lat], zoom: 10.6, signal: flag });
      if (flag.cancelled) return;
      if (!res) {
        setMode("fallback");
        return;
      }
      const { map } = res;
      const ml = (await import("maplibre-gl")).default;
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
        if (planPlaces.length > 1) {
          map.addSource("plan-route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: planPlaces.map((p) => [p.longitude, p.latitude]) } },
          });
          map.addLayer({ id: "plan-route-casing", type: "line", source: "plan-route", paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
          map.addLayer({ id: "plan-route", type: "line", source: "plan-route", paint: { "line-color": "#FF2E88", "line-width": 4, "line-dasharray": [1.5, 1.2] }, layout: { "line-cap": "round", "line-join": "round" } });
        }
        // кадр: маршрут целиком, иначе — точка выезда и ближайшие места
        const bounds = new ml.LngLatBounds([start.lng, start.lat], [start.lng, start.lat]);
        const near = planPlaces.length
          ? planPlaces
          : [...poolRef.current].sort((a, b) => travelToPlace(start, a, "car").minutes - travelToPlace(start, b, "car").minutes).slice(0, 12);
        near.forEach((p) => bounds.extend([p.longitude, p.latitude]));
        if (planPlaces.length) bounds.extend([start.lng, start.lat]);
        map.fitBounds(bounds, { padding: { top: 150, bottom: 300, left: 30, right: 30 }, duration: 0, maxZoom: 14 });
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
      if (!flag.cancelled) setMode("fallback");
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
  }, [start]);

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
    if (!map || mode !== "map" || origin.source === "default") return;
    (async () => {
      const ml = (await import("maplibre-gl")).default;
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.innerHTML = '<span class="kg-user-dot"></span>';
        userMarkerRef.current = new ml.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
      } else userMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    })();
  }, [mode, origin]);

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
  const locate = () => {
    if (!navigator.geolocation) return setGeo("denied");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUser(loc);
        setGeo("ok");
        setOrigin({ ...loc, label: nearestAreaLabel(loc), source: "gps" });
        const map = mapRef.current;
        if (map) map.flyTo({ center: [loc.lng, loc.lat], zoom: 13, offset: [0, -60] });
        track("map_locate", {});
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const toggle = (t: Toggle) =>
    setToggles((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      if (t === "indoor") n.delete("outdoor");
      if (t === "outdoor") n.delete("indoor");
      return n;
    });

  const activeCount = toggles.size + (age ? 1 : 0) + (price ? 1 : 0) + (category ? 1 : 0);
  const reset = () => {
    setToggles(new Set());
    setAge(null);
    setPrice(null);
    setCategory(undefined);
    setQuery("");
  };

  return (
    <main
      className="fixed inset-0 mx-auto max-w-[480px] overflow-hidden bg-[#efebe3]"
      style={{ ["--sheet-h" as string]: `calc(${sheetH}px + env(safe-area-inset-bottom))` }}
    >
      {/* карта */}
      {/* position задан inline: maplibre-gl.css (без @layer) иначе перебивает tailwind-класс и карта схлопывается до 300px */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} className={cn(mode === "fallback" && "invisible")} />
      {mode === "fallback" && (
        <StylizedMap center={fbCenter} zoom={fz} origin={origin.source !== "default" ? origin : undefined}>
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
          {planPlaces.length > 1 && (
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
              <polyline
                points={planPlaces.map((p) => `${fbProject(p.latitude, p.longitude).x},${fbProject(p.latitude, p.longitude).y}`).join(" ")}
                fill="none"
                stroke="#FF2E88"
                strokeWidth={4}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span className="kg-user-dot absolute" style={{ left: fbProject(user.lat, user.lng).x, top: fbProject(user.lat, user.lng).y }} />
        </StylizedMap>
      )}
      {mode === "loading" && <div className="absolute inset-0 skeleton opacity-60" />}
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
          <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-float">
            <Search size={22} strokeWidth={2.1} className="text-ink-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск мест"
              aria-label="Поиск мест на карте"
              className="min-w-0 flex-1 bg-transparent text-[16.5px] outline-none placeholder:text-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Очистить" className="text-muted">
                <X size={18} />
              </button>
            )}
          </label>
          <button
            onClick={() => (activeCount ? reset() : setSheet("age"))}
            aria-label={activeCount ? "Сбросить фильтры" : "Фильтры"}
            className="press relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white shadow-float"
          >
            <SlidersHorizontal size={21} strokeWidth={2.1} />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-white">{activeCount}</span>
            )}
          </button>
        </div>
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4 pb-2">
          {category && (
            <FilterChip active size="sm" onClick={() => setCategory(undefined)}>
              {categoryDef(category).label} <X size={14} />
            </FilterChip>
          )}
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
        {geo === "denied" && (
          <div className="mx-4 mt-1 flex items-center gap-2 rounded-[16px] bg-white/95 px-3 py-2 text-[13px] shadow-card animate-rise">
            <LocateOff size={16} className="shrink-0 text-red" />
            <span className="flex-1">Геолокация выключена — считаем дорогу от «{origin.source === "default" ? "центр" : origin.label}». Точку можно поменять в шапке главной</span>
            <button onClick={() => setGeo("idle")} aria-label="Скрыть" className="text-muted">
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {mode === "fallback" && (
        <div className="absolute right-4 z-20 flex flex-col overflow-hidden rounded-[18px] bg-white shadow-float" style={{ bottom: "calc(var(--sheet-h) + 80px)" }}>
          <button onClick={() => setFz((z) => Math.min(4, z * 1.5))} aria-label="Приблизить" className="press grid h-11 w-[52px] place-items-center border-b border-line">
            <Plus size={20} />
          </button>
          <button onClick={() => setFz((z) => Math.max(0.5, z / 1.5))} aria-label="Отдалить" className="press grid h-11 w-[52px] place-items-center">
            <Minus size={20} />
          </button>
        </div>
      )}

      {/* моя геопозиция */}
      <button
        onClick={locate}
        aria-label="Где я"
        className="press absolute right-4 z-20 grid h-[52px] w-[52px] place-items-center rounded-full bg-white text-blue shadow-float"
        style={{ bottom: "calc(var(--sheet-h) + 16px)" }}
      >
        <Navigation size={23} strokeWidth={2.2} className={cn(geo === "ok" && "fill-blue")} />
      </button>

      {/* нижняя панель */}
      <section
        ref={sheetRef}
        className="absolute inset-x-0 z-20 rounded-t-[28px] bg-white pb-3 pt-2 shadow-[0_-10px_30px_rgba(17,18,26,0.08)]"
        style={{ bottom: "calc(66px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto h-[5px] w-10 rounded-full bg-[#dcdad4]" />
        {selectedPlace ? (
          <div className="px-4 pt-3">
            <PlaceBottomSheet key={selectedPlace.slug} place={selectedPlace} minutes={travelToPlace(user, selectedPlace, transport).minutes} onClose={() => setSelected(null)} />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between px-4 pt-3">
              <h2 className="tight text-[23px] font-[800]">
                {planSlugs.length ? "Маршрут дня" : activeCount === 0 && !query.trim() ? "Рядом с вами" : `Нашли ${visible.length}`}
              </h2>
              <Link href="/search" className="press flex items-center gap-1 text-[16px] font-medium text-blue">
                Все <ArrowRight size={18} />
              </Link>
            </div>
            {nearby.length ? (
              <div className="no-scrollbar snap-x-pad mt-2.5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 pt-1">
                {nearby.slice(0, 12).map(({ p }, i) => (
                  <PlaceCard key={p.id} place={p} width="w-[196px]" caption={planSlugs.length ? `Шаг ${i + 1}` : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState
                className="py-3"
                art="map"
                title="Здесь ничего не нашлось"
                text="Попробуйте убрать часть фильтров"
                secondary={
                  <button onClick={reset} className="press mt-3 rounded-full bg-pink-50 px-5 py-2.5 text-[15px] font-semibold text-pink">
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
              className="press col-span-2 h-14 rounded-[18px] bg-pink-50 text-[15.5px] font-semibold text-pink"
            >
              Как у наших: {kids.map((k) => (k.name ? `${k.name} ${k.age}` : `${k.age} ${k.age === 1 ? "год" : "лет"}`)).join(", ")}
            </button>
          )}
          {AGES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAge(age === a.id ? null : a.id);
                setSheet(null);
              }}
              className={cn("press h-14 rounded-[18px] text-[16px] font-semibold", age === a.id ? "bg-ink text-white" : "bg-fill")}
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
            className={cn("press h-14 rounded-[18px] text-[16px] font-semibold", toggles.has("free") ? "bg-ink text-white" : "bg-green-50 text-green")}
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
              className={cn("press h-14 rounded-[18px] text-[16px] font-semibold", price === a.id ? "bg-ink text-white" : "bg-fill")}
            >
              {a.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}
