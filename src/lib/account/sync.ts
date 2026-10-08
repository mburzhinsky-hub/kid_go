"use client";

/**
 * Движок синхронизации: документы (намерения, выходы, планы, сохранённое) + подборки.
 * Принцип «сначала на устройстве»: интерфейс всегда работает с локальным состоянием, сервер — копия и мост между устройствами.
 *  - при входе данные устройства и аккаунта объединяются;
 *  - дальше изменения уходят на сервер с задержкой, чужие изменения подтягиваются при открытии приложения;
 *  - нет связи — ничего не теряется, отправим при первой возможности.
 */
import { useFamily } from "@/lib/store";
import { useSocial } from "@/lib/social/store";
import { setUserId } from "@/lib/social/identity";
import type { Collection, ResolvedCollection } from "@/lib/social/types";
import { api, ApiError, type ApiAuthor } from "./api";
import { useAccount } from "./store";
import { DOCS, fingerprint, type DocSpec } from "./docs";

const ID_RE = /^[a-z0-9]{10}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Случайный несоседний адрес подборки (как на сервере): нельзя угадать перебором. */
export function newCollectionId(): string {
  const b = new Uint8Array(10);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

const loggedIn = () => !!useAccount.getState().user;

/* ───────── документы ───────── */

interface ServerDoc {
  version: number;
  body: unknown;
}

let applying = false; // запись чужих данных в стор не должна запускать отправку
let chain: Promise<unknown> = Promise.resolve();
/** Все обмены с сервером идут по одному: так версии не расходятся. */
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

function remember(spec: DocSpec, version: number) {
  const st = useAccount.getState();
  useAccount.setState({ versions: { ...st.versions, [spec.name]: version }, hashes: { ...st.hashes, [spec.name]: fingerprint(spec.read()) } });
}

function writeLocal(spec: DocSpec, body: unknown) {
  applying = true;
  try {
    spec.write(body);
  } finally {
    applying = false;
  }
}

async function pushDoc(spec: DocSpec, base: number, retry = true): Promise<void> {
  const body = spec.read();
  try {
    const r = await api<{ version: number }>("PUT", `/me/docs/${spec.name}`, { base_version: base, body });
    // пока ждали ответ, данные могли измениться — отпечаток берём от того, что реально отправили
    const st = useAccount.getState();
    useAccount.setState({ versions: { ...st.versions, [spec.name]: r.version }, hashes: { ...st.hashes, [spec.name]: fingerprint(body) } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && retry) {
      const cur = (e.body as { current?: ServerDoc } | undefined)?.current;
      if (!cur) throw e;
      const merged = spec.merge(spec.read(), spec.sanitize(cur.body));
      writeLocal(spec, merged);
      return pushDoc(spec, cur.version, false);
    }
    throw e;
  }
}

/** Подтянуть всё с сервера и свести с устройством. */
export async function pullAll(): Promise<void> {
  const { docs } = await api<{ docs: Record<string, ServerDoc> }>("GET", "/me/docs");
  for (const spec of DOCS) {
    const remote = docs[spec.name];
    const st = useAccount.getState();
    const local = spec.read();
    if (!remote) {
      if (!spec.isEmpty(local)) await pushDoc(spec, 0);
      continue;
    }
    const rbody = spec.sanitize(remote.body);
    const known = st.versions[spec.name];
    if (known === undefined) {
      // первое знакомство устройства с аккаунтом: объединяем
      const merged = spec.merge(local, rbody);
      writeLocal(spec, merged);
      if (fingerprint(merged) !== fingerprint(rbody)) await pushDoc(spec, remote.version);
      else remember(spec, remote.version);
    } else if (remote.version === known) {
      if (fingerprint(local) !== st.hashes[spec.name]) await pushDoc(spec, known);
    } else if (fingerprint(local) === st.hashes[spec.name]) {
      // на устройстве ничего нового — просто берём версию с сервера
      writeLocal(spec, rbody);
      remember(spec, remote.version);
    } else {
      const merged = spec.merge(local, rbody);
      writeLocal(spec, merged);
      await pushDoc(spec, remote.version);
    }
  }
}

/** Отправить то, что изменилось на устройстве. */
export async function flushDocs(): Promise<void> {
  for (const spec of DOCS) {
    const st = useAccount.getState();
    const h = fingerprint(spec.read());
    if (h === st.hashes[spec.name]) continue;
    await pushDoc(spec, st.versions[spec.name] ?? 0);
  }
}

/** Есть ли на устройстве то, чего нет на сервере. */
export function hasUnsynced(): boolean {
  const st = useAccount.getState();
  if (readOutbox().length) return true;
  return DOCS.some((spec) => {
    const h = fingerprint(spec.read());
    return h !== st.hashes[spec.name] && !(st.hashes[spec.name] === undefined && spec.isEmpty(spec.read()));
  });
}

/* ───────── подборки ───────── */

interface ApiCollection extends Collection {
  author?: ApiAuthor;
}
interface CollectionResp {
  collection: Collection;
  author: ApiAuthor;
}

const payloadOf = (c: Collection) => ({
  title: c.title,
  description: c.description,
  cover: c.cover,
  city: c.city,
  visibility: c.visibility,
  age_min: c.age_min,
  age_max: c.age_max,
  items: [...c.items].sort((a, b) => a.position - b.position).map((i) => ({ place_id: i.place_id, creator_note: i.creator_note })),
  // скрытую модерацией подборку не трогаем: «publish: false» вернул бы её в черновик, когда модератор уже её вернул
  ...(c.status === "HIDDEN" ? {} : { publish: c.status === "PUBLISHED" }),
});

/** Подборки, которыми владеет этот кабинет: созданные здесь, не «от имени автора» и не демо. */
function ownLocal(): Collection[] {
  const st = useSocial.getState();
  return st.collections.filter((c) => !st.authors[c.id]);
}

export function renameCollection(oldId: string, newId: string) {
  useSocial.setState((s) => ({
    collections: s.collections.map((c) => (c.id === oldId ? { ...c, id: newId, items: c.items.map((i) => ({ ...i, id: i.id.replace(oldId, newId), collection_id: newId })) } : c)),
    saved: s.saved.map((x) => (x.id === oldId ? { ...x, id: newId } : x)),
  }));
  // очередь отправки помнит старый id
  writeOutbox(readOutbox().map((o) => (o.id === oldId ? { ...o, id: newId } : o)));
}

/** Создаёт подборку на сервере; если id занят или старого вида — берёт новый. Возвращает итоговый id. */
async function createOnServer(c: Collection): Promise<string> {
  let id = ID_RE.test(c.id) ? c.id : newCollectionId();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await api<CollectionResp>("POST", "/collections", { ...payloadOf(c), id });
      if (r.collection.id !== c.id) renameCollection(c.id, r.collection.id);
      patchLocal(r.collection.id, { slug: r.collection.slug, published_at: r.collection.published_at });
      return r.collection.id;
    } catch (e) {
      if (e instanceof ApiError && e.code === "id_taken") {
        id = newCollectionId();
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(409, "id_taken", "Не удалось создать подборку, попробуйте ещё раз");
}

function patchLocal(id: string, p: Partial<Collection>) {
  useSocial.setState((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
}

/** Подборки устройства переезжают в кабинет, подборки кабинета приходят на устройство. */
export async function linkCollections(): Promise<void> {
  const user = useAccount.getState().user;
  if (!user) return;
  const { collections: remote } = await api<{ collections: ApiCollection[] }>("GET", "/collections?mine=1");
  const byId = new Map(remote.map((c) => [c.id, c]));
  for (const c of ownLocal()) {
    const r = byId.get(c.id);
    try {
      if (!r) {
        if (c.items.length || c.status === "DRAFT") await createOnServer({ ...c, status: c.items.length ? c.status : "DRAFT" });
      } else if (c.updated_at > r.updated_at) {
        await api("PUT", `/collections/${c.id}`, payloadOf(c));
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status >= 500)) throw e;
      // лимит или невалидная подборка: оставляем на устройстве, остальные едут дальше
    }
  }
  const { collections: fresh } = await api<{ collections: ApiCollection[] }>("GET", "/collections?mine=1");
  const serverIds = new Set(fresh.map((c) => c.id));
  useSocial.setState((s) => {
    const rest = s.collections.filter((c) => s.authors[c.id] || !serverIds.has(c.id));
    const mine = fresh.map(({ author: _a, ...c }) => ({ ...c, user_id: user.id }));
    // не отправленное (лимит и т. п.) остаётся на устройстве под новым владельцем
    return { collections: [...mine, ...rest.map((c) => (s.authors[c.id] ? c : { ...c, user_id: user.id }))] };
  });
}

/**
 * Модерация могла скрыть или вернуть подборку, пока устройство было закрыто: подтягиваем только эту разницу
 * (остальное устройство и так знает лучше, у него могут быть неотправленные правки).
 */
export async function refreshModeration(): Promise<void> {
  if (!loggedIn() || ownLocal().length === 0) return;
  const { collections: remote } = await api<{ collections: ApiCollection[] }>("GET", "/collections?mine=1");
  const status = new Map(remote.map((c) => [c.id, c.status]));
  useSocial.setState((s) => {
    let changed = false;
    const collections = s.collections.map((c) => {
      const server = status.get(c.id);
      if (!server || s.authors[c.id] || (c.status === "HIDDEN") === (server === "HIDDEN")) return c;
      changed = true;
      return { ...c, status: server };
    });
    return changed ? { collections } : s;
  });
}

/* ───────── очередь отправки подборок ───────── */

interface Op {
  id: string;
  op: "upsert" | "delete";
}
const OUTBOX = "kidgo-outbox";

function readOutbox(): Op[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeOutbox(v: Op[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

let outboxTimer: ReturnType<typeof setTimeout> | undefined;

function enqueue(op: Op) {
  if (!loggedIn()) return;
  // более свежая операция над той же подборкой заменяет прежнюю
  writeOutbox([...readOutbox().filter((o) => o.id !== op.id), op]);
  clearTimeout(outboxTimer);
  outboxTimer = setTimeout(() => void runOutbox(), 800);
}

/** Репозиторий зовёт это после каждого локального изменения подборки. */
export const mirrorUpsert = (id: string) => enqueue({ id, op: "upsert" });
export const mirrorDelete = (id: string) => enqueue({ id, op: "delete" });

export type OutboxProblem = (message: string) => void;
let onProblem: OutboxProblem = () => {};
export const setOutboxProblemHandler = (h: OutboxProblem) => {
  onProblem = h;
};

export function runOutbox(): Promise<void> {
  return serial(async () => {
    if (!loggedIn()) return;
    for (let guard = 0; guard < 100; guard++) {
      const [op] = readOutbox();
      if (!op) return;
      const done = () => writeOutbox(readOutbox().filter((o) => !(o.id === op.id && o.op === op.op)));
      try {
        if (op.op === "delete") {
          await api("DELETE", `/collections/${op.id}`).catch((e) => {
            if (!(e instanceof ApiError && e.status === 404)) throw e;
          });
        } else {
          const c = useSocial.getState().collections.find((x) => x.id === op.id);
          if (c && !useSocial.getState().authors[c.id]) {
            try {
              const r = await api<CollectionResp>("PUT", `/collections/${c.id}`, payloadOf(c));
              patchLocal(c.id, { slug: r.collection.slug, published_at: r.collection.published_at });
            } catch (e) {
              if (e instanceof ApiError && e.status === 404) await createOnServer(c);
              else throw e;
            }
          }
        }
        done();
      } catch (e) {
        if (e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status === 429 || e.status >= 500)) {
          // нет связи или вход слетел — оставляем в очереди, попробуем позже
          if (e.status === 401) useAccount.setState({ expired: true });
          else outboxTimer = setTimeout(() => void runOutbox(), 20000);
          return;
        }
        // сервер отклонил содержимое (лимит, пустая публикация…): сообщаем и не зацикливаемся
        done();
        onProblem(e instanceof ApiError ? e.message : "Не удалось сохранить подборку на сервере");
      }
    }
  });
}

/* ───────── общий цикл ───────── */

let started = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

async function syncNow(opts: { pull: boolean }) {
  if (!loggedIn()) return;
  await serial(async () => {
    useAccount.setState({ sync: "syncing" });
    try {
      if (opts.pull) {
        await pullAll();
        await refreshModeration().catch(() => {}); // не критично: статус подтянется при следующем открытии
      } else await flushDocs();
      useAccount.setState({ sync: "idle", lastSyncAt: Date.now(), expired: false });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) useAccount.setState({ sync: "idle", expired: true });
      else useAccount.setState({ sync: "error" });
    }
  });
  void runOutbox();
}

const schedulePush = () => {
  if (applying || !loggedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncNow({ pull: false }), 1800);
};

/** Один раз за жизнь страницы: следим за изменениями и возвращением в приложение. */
export function startSync() {
  if (started) return;
  started = true;
  useFamily.subscribe(schedulePush);
  useSocial.subscribe(schedulePush);
  window.addEventListener("online", () => void syncNow({ pull: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow({ pull: true });
  });
}

export const syncAfterLogin = async () => {
  await serial(async () => {
    useAccount.setState({ sync: "syncing" });
    try {
      await linkCollections();
      await pullAll();
      useAccount.setState({ sync: "idle", lastSyncAt: Date.now(), expired: false });
    } catch (e) {
      useAccount.setState({ sync: "error" });
      throw e;
    }
  });
  void runOutbox();
  void hydrateSavedCollections();
};

export const syncOnOpen = () => syncNow({ pull: true });

/** Сохранённые подборки с другого устройства: id пришли с сервера, сами подборки подтягиваем, когда их ещё нет. */
export async function hydrateSavedCollections() {
  const st = useSocial.getState();
  const known = new Set(st.collections.map((c) => c.id));
  const need = st.saved.filter((s) => !s.snapshot && !known.has(s.id) && /^[a-z0-9]{10}$/.test(s.id)).slice(0, 20);
  for (const s of need) {
    try {
      const r = await api<CollectionResp>("GET", `/collections/${s.id}`);
      const resolved: ResolvedCollection = { collection: r.collection, author: { ...r.author, hasPage: false }, source: "snapshot" };
      useSocial.setState((x) => ({ saved: x.saved.map((y) => (y.id === s.id ? { ...y, snapshot: resolved } : y)) }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) continue; // подборку удалили или спрятали
      return;
    }
  }
}

/* ───────── выход и очистка ───────── */

/** Убирает с устройства личное, что живёт в кабинете (оно остаётся на сервере). Семейный профиль и настройки не трогаем. */
export function wipeSyncedData() {
  applying = true;
  try {
    useFamily.setState({ intents: {}, wantPlaces: [], visitedPlaces: [], loved: [], disliked: [], trips: [], savedPlans: [] });
    useSocial.setState({ me: undefined, collections: [], authors: {}, saved: [], follows: [] });
  } finally {
    applying = false;
  }
  writeOutbox([]);
  setUserId(undefined);
}
