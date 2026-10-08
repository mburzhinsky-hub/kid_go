"use client";

import { useFamily } from "@/lib/store";
import { useSocial, type MyProfile } from "@/lib/social/store";
import { setUserId } from "@/lib/social/identity";
import { api, ApiError, getToken, setToken, ACCOUNTS_ENABLED, type ApiUser } from "./api";
import { useAccount, rehydrateAccount } from "./store";
import { startSync, syncAfterLogin, syncOnOpen, wipeSyncedData, hasUnsynced, flushDocs, runOutbox, setOutboxProblemHandler } from "./sync";
import { useToast } from "@/components/ui/Toast";

export { ACCOUNTS_ENABLED, ApiError } from "./api";
export { useAccount } from "./store";
export { hasUnsynced, newCollectionId, mirrorUpsert, mirrorDelete } from "./sync";

/** Профиль автора на устройстве = профиль кабинета: подборки подписываются им. */
function toProfile(u: ApiUser): MyProfile {
  return { id: u.id, name: u.display_name || u.handle, username: u.handle, avatar: u.avatar.value, tint: u.tint, bio: u.bio ?? "", status: "APPROVED" };
}

function applyUser(u: ApiUser) {
  useAccount.setState({ user: u, linkedUserId: u.id, expired: false });
  useSocial.getState().setMe(toProfile(u));
  setUserId(u.id);
  useFamily.getState().claimIntents(u.id);
}

/** После входа или регистрации: чужие данные на устройстве убираем, свои объединяем с кабинетом. */
async function signedIn(u: ApiUser, token: string) {
  setToken(token);
  const prev = useAccount.getState().linkedUserId;
  if (prev && prev !== u.id) {
    wipeSyncedData();
    useAccount.setState({ versions: {}, hashes: {} });
  } else if (!prev) {
    // устройство только знакомится с кабинетом: версии начинаем с нуля, данные объединятся
    useAccount.setState({ versions: {}, hashes: {} });
  }
  applyUser(u);
  startSync();
  try {
    await syncAfterLogin();
  } catch {
    // вход выполнен, синхронизация повторится при следующем открытии
  }
}

export interface RegisterInput {
  handle: string;
  password: string;
  display_name?: string;
  avatar: string;
  tint: string;
  consent: boolean;
  website?: string;
}

export async function register(input: RegisterInput): Promise<void> {
  const r = await api<{ user: ApiUser; token: string }>("POST", "/accounts", input);
  await signedIn(r.user, r.token);
}

export async function login(handle: string, password: string): Promise<void> {
  const r = await api<{ user: ApiUser; token: string }>("POST", "/sessions", { handle, password });
  await signedIn(r.user, r.token);
}

export async function checkHandle(handle: string): Promise<{ available: boolean; reason: string | null }> {
  return api("GET", `/handles/check?h=${encodeURIComponent(handle)}`);
}

export async function updateProfile(p: { display_name: string; bio?: string; avatar: string; tint: string }): Promise<void> {
  const r = await api<{ user: ApiUser }>("PATCH", "/me", p);
  applyUser(r.user);
}

export async function changePassword(current: string, next: string): Promise<void> {
  await api("POST", "/me/password", { current, new: next });
}

/** Выход: сначала отправляем всё, что накопилось; данные кабинета с устройства убираем (на сервере они остаются). */
export async function logout(opts: { force?: boolean } = {}): Promise<{ ok: boolean; unsynced?: boolean }> {
  if (!opts.force) {
    try {
      await flushDocs();
      await runOutbox();
    } catch {
      /* проверим ниже */
    }
    if (hasUnsynced()) return { ok: false, unsynced: true };
  }
  try {
    await api("DELETE", "/sessions/current");
  } catch {
    /* токен мог уже протухнуть — выходим локально в любом случае */
  }
  setToken(undefined);
  wipeSyncedData();
  useAccount.setState({ user: null, linkedUserId: undefined, versions: {}, hashes: {}, expired: false, sync: "idle" });
  return { ok: true };
}

export async function deleteAccount(password: string): Promise<void> {
  await api("DELETE", "/me", { password });
  setToken(undefined);
  wipeSyncedData();
  useAccount.setState({ user: null, linkedUserId: undefined, versions: {}, hashes: {}, expired: false, sync: "idle" });
}

/* ───────── запуск ───────── */

const hydrated = () => useFamily.getState().hydrated && useSocial.getState().hydrated;

function whenHydrated(): Promise<void> {
  if (hydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (hydrated()) {
        unsubA();
        unsubB();
        resolve();
      }
    };
    const unsubA = useFamily.subscribe(check);
    const unsubB = useSocial.subscribe(check);
  });
}

/** Вызывается один раз при старте приложения (Providers). */
export async function initAccount() {
  if (!ACCOUNTS_ENABLED) return;
  await Promise.all([rehydrateAccount(), whenHydrated()]);
  setOutboxProblemHandler((m) => useToast.getState().show(m));
  const st = useAccount.getState();
  if (!st.user && !getToken()) return;
  startSync();
  try {
    const r = await api<{ user: ApiUser }>("GET", "/me");
    applyUser(r.user);
    await syncOnOpen();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // вход слетел: данные остаются на устройстве, предложим войти снова
      setToken(undefined);
      useAccount.setState({ expired: true });
    }
  }
}
