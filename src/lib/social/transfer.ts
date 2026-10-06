"use client";

/**
 * Перенос хотелок и подборок на другое устройство.
 * Домашний экран iPhone (веб-приложение) хранит данные отдельно от Safari, поэтому всё, что человек уже
 * добавил в браузере, переезжает ссылкой: открыл её в приложении — всё на месте. Без аккаунта и сервера.
 * Ссылку получает только сам человек (она содержит его хотелки), поэтому по умолчанию мы её не публикуем и не логируем.
 */
import { useFamily } from "@/lib/store";
import { useSocial } from "./store";
import { encodeSnapshot, decodeSnapshot, siteOrigin } from "./share";
import { trackEvent } from "./events";
import { resolveAll, saveCollection } from "./repo";
import type { IntentFeedback, ResolvedCollection } from "./types";

interface TransferV1 {
  v: 1;
  /** Хочу сюда: [slug, creator_id?, collection_id?] */
  w: [string, string?, string?][];
  /** Уже были: [slug, feedback?] */
  x: [string, string?][];
  /** Сохранённые подборки из каталога (по id). */
  c: string[];
  /** Остальные сохранённые подборки — снимки в формате ссылки. */
  n: string[];
}

const MAX_PLACES = 80;
const MAX_SNAPSHOTS = 6;
const SLUG = /^[\w-]{1,80}$/;
const FEEDBACK: IntentFeedback[] = ["LIKE", "OK", "DISLIKE"];

function b64urlEncode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export interface TransferSummary {
  wants: number;
  visited: number;
  collections: number;
}

/** Что именно переедет. */
export function collectTransfer(): { payload: TransferV1; summary: TransferSummary } {
  const fam = useFamily.getState();
  const soc = useSocial.getState();
  const w: TransferV1["w"] = [];
  const x: TransferV1["x"] = [];
  for (const slug of fam.wantPlaces.slice(0, MAX_PLACES)) {
    const it = fam.intents[slug];
    w.push(it?.creator_id || it?.collection_id ? [slug, it.creator_id, it.collection_id] : [slug]);
  }
  for (const slug of fam.visitedPlaces.slice(0, MAX_PLACES)) {
    const fb = fam.intents[slug]?.feedback;
    x.push(fb ? [slug, fb] : [slug]);
  }
  const all = resolveAll(soc);
  const c: string[] = [];
  const n: string[] = [];
  for (const sv of soc.saved) {
    const r: ResolvedCollection | undefined = all.find((a) => a.collection.id === sv.id) ?? sv.snapshot;
    if (!r) continue;
    if (r.source === "seed") c.push(r.collection.id);
    else if (n.length < MAX_SNAPSHOTS) n.push(encodeSnapshot(r));
  }
  return { payload: { v: 1, w, x, c, n }, summary: { wants: w.length, visited: x.length, collections: c.length + n.length } };
}

export function transferUrl(): { url: string; summary: TransferSummary } {
  const { payload, summary } = collectTransfer();
  trackEvent("share_channel", { channel: "transfer", ...summary });
  return { url: `${siteOrigin()}/import/?d=${b64urlEncode(JSON.stringify(payload))}`, summary };
}

export function parseTransfer(d: string | null | undefined): TransferV1 | null {
  if (!d) return null;
  try {
    const p = JSON.parse(b64urlDecode(d)) as Partial<TransferV1>;
    if (p.v !== 1) return null;
    const w = (Array.isArray(p.w) ? p.w : []).filter((i): i is [string, string?, string?] => Array.isArray(i) && typeof i[0] === "string" && SLUG.test(i[0])).slice(0, MAX_PLACES);
    const x = (Array.isArray(p.x) ? p.x : []).filter((i): i is [string, string?] => Array.isArray(i) && typeof i[0] === "string" && SLUG.test(i[0])).slice(0, MAX_PLACES);
    const c = (Array.isArray(p.c) ? p.c : []).filter((i): i is string => typeof i === "string" && SLUG.test(i)).slice(0, 20);
    const n = (Array.isArray(p.n) ? p.n : []).filter((i): i is string => typeof i === "string").slice(0, MAX_SNAPSHOTS);
    if (!w.length && !x.length && !c.length && !n.length) return null;
    return { v: 1, w, x, c, n };
  } catch {
    return null;
  }
}

export function summarize(p: TransferV1): TransferSummary {
  return { wants: p.w.length, visited: p.x.length, collections: p.c.length + p.n.length };
}

/** Сливает перенесённое с тем, что уже есть на устройстве: ничего не затираем. Возвращает, сколько нового добавлено. */
export function applyTransfer(p: TransferV1): TransferSummary {
  const fam = useFamily.getState();
  const items = [
    ...p.x.map(([slug, fb]) => ({ slug, status: "VISITED" as const, feedback: FEEDBACK.includes(fb as IntentFeedback) ? (fb as IntentFeedback) : undefined, ctx: { source_type: "PLACE" as const } })),
    // хотелки идут после «были»: если место уже отмечено посещённым, оно не станет хотелкой повторно
    ...p.w.map(([slug, creator_id, collection_id]) => ({ slug, status: "WANT_TO_GO" as const, ctx: { source_type: collection_id ? ("COLLECTION" as const) : ("PLACE" as const), creator_id, collection_id } })),
  ];
  const visited = fam.importIntents(items.filter((i) => i.status === "VISITED"));
  const wants = fam.importIntents(items.filter((i) => i.status === "WANT_TO_GO"));

  let collections = 0;
  const all = resolveAll();
  const have = new Set(useSocial.getState().saved.map((s) => s.id));
  for (const id of p.c) {
    const r = all.find((a) => a.collection.id === id);
    if (r && !have.has(id)) {
      saveCollection(r, "transfer");
      collections++;
    }
  }
  for (const d of p.n) {
    const r = decodeSnapshot(d);
    if (r && !have.has(r.collection.id)) {
      saveCollection(r, "transfer");
      collections++;
    }
  }
  return { wants, visited, collections };
}
