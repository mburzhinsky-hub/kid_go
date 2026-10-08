"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Cloud, CloudOff, Loader2, LogOut, Pencil, Trash2, KeyRound, Sparkles } from "lucide-react";
import { TabBackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CreatorAvatar } from "@/components/social/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useFamily } from "@/lib/store";
import { useSocial } from "@/lib/social/store";
import { useMyCollections, useSavedCollections } from "@/lib/social/repo";
import { useSocialUi } from "@/lib/social/ui-store";
import { ACCOUNTS_ENABLED, ApiError, changePassword, deleteAccount, logout, updateProfile, useAccount } from "@/lib/account";
import { syncOnOpen } from "@/lib/account/sync";
import { plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ACCOUNT_AVATARS, ACCOUNT_TINTS } from "./AccountSheet";

const field = "mt-1.5 h-12 w-full rounded-[16px] bg-fill px-4 text-[16px] outline-none focus:ring-2 focus:ring-pink/40";
const RATING = { 1: "😕", 2: "🙂", 3: "😍" } as const;

function msg(e: unknown) {
  if (e instanceof ApiError) return e.offline || e.status >= 500 || e.status === 404 ? "Сейчас не получается. Попробуйте чуть позже." : e.message;
  return "Что-то пошло не так. Попробуйте ещё раз.";
}

/** «Мой кабинет»: что мы уже посетили, что понравилось, подборки и настройки аккаунта. */
export function CabinetScreen() {
  const acc = useAccount();
  const fam = useFamily();
  const socialReady = useSocial((s) => s.hydrated);
  const mine = useMyCollections();
  const saved = useSavedCollections();
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState(false);
  const [del, setDel] = useState(false);
  const toast = useToast((s) => s.show);
  const openAccount = useSocialUi((s) => s.openAccount);
  const user = acc.user;
  const ready = acc.hydrated && fam.hydrated && socialReady;

  if (!ACCOUNTS_ENABLED) {
    return (
      <main className="px-5 pb-28 pt-[max(18px,env(safe-area-inset-top))]">
        <TabBackButton className="mb-2" />
        <h1 className="tight text-[30px] font-[850] leading-tight">Кабинет</h1>
        <p className="mt-2 text-[16px] text-muted">Любимые места и подборки сохраняются прямо на этом телефоне — загляните в «Профиль».</p>
      </main>
    );
  }

  if (!ready) return <main className="grid min-h-dvh place-items-center text-muted">Загружаем…</main>;

  if (!user) {
    return (
      <main className="pb-28">
        <header className="px-4 pt-[max(18px,env(safe-area-inset-top))]">
          <TabBackButton className="mb-2" />
          <h1 className="tight text-[30px] font-[850] leading-tight">Мой кабинет</h1>
        </header>
        <div className="mx-4 mt-4 rounded-[28px] p-5 shadow-card" style={{ background: "linear-gradient(135deg,#FFE9F3,#EEE5FE)" }}>
          <p className="text-[40px] leading-none">🧸</p>
          <p className="tight mt-3 text-[22px] font-[800] leading-tight">{acc.expired ? "Войдите снова" : "Всё нужное — на любом телефоне"}</p>
          <p className="mt-1.5 text-[15px] leading-snug text-ink-2">
            {acc.expired
              ? "Вход на этом устройстве закончился. Ваши данные сохранены, войдите по нику и паролю."
              : "Ник и пароль, без почты и телефона. Подборки, «Хочу сюда», «Были» и оценки сохранятся и откроются с любого устройства. Подборками можно делиться короткой ссылкой."}
          </p>
          <div className="mt-4 flex gap-2">
            {!acc.expired && (
              <button onClick={() => openAccount("register")} className="press h-12 flex-1 rounded-full bg-pink text-[16px] font-bold text-white shadow-pink">
                Создать кабинет
              </button>
            )}
            <button onClick={() => openAccount("login")} className={cn("press h-12 rounded-full text-[16px] font-bold", acc.expired ? "flex-1 bg-pink text-white shadow-pink" : "bg-white px-5 text-ink shadow-card")}>
              Войти
            </button>
          </div>
        </div>
      </main>
    );
  }

  const trips = fam.trips.filter((t) => t.rating).slice(0, 5);
  const syncLabel = acc.sync === "syncing" ? "Сохраняем…" : acc.sync === "error" || acc.expired ? "Не удалось сохранить, повторим" : "Всё сохранено";

  return (
    <main className="pb-28">
      <header className="px-4 pt-[max(18px,env(safe-area-inset-top))]">
        <TabBackButton className="mb-2" />
        <div className="flex items-center gap-3.5">
          <CreatorAvatar author={{ avatar: user.avatar.value, tint: user.tint, name: user.display_name || user.handle }} size={72} ring />
          <div className="min-w-0 flex-1">
            <h1 className="tight truncate text-[26px] font-[850] leading-tight">{user.display_name || `@${user.handle}`}</h1>
            {user.display_name && <p className="truncate text-[15px] text-muted">@{user.handle}</p>}
          </div>
          <button onClick={() => setEditing(true)} aria-label="Изменить профиль" className="press hit relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill">
            <Pencil size={18} />
          </button>
        </div>
        <button
          onClick={() => void syncOnOpen()}
          className={cn("press mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", acc.sync === "error" || acc.expired ? "bg-yellow-50 text-yellow-ink" : "bg-green-50 text-green-ink")}
        >
          {acc.sync === "syncing" ? <Loader2 size={14} className="animate-spin" /> : acc.sync === "error" || acc.expired ? <CloudOff size={14} /> : <Cloud size={14} />}
          {syncLabel}
        </button>
      </header>

      {acc.expired && (
        <button onClick={() => openAccount("login")} className="press mx-4 mt-3 w-[calc(100%-2rem)] rounded-[18px] bg-yellow-50 p-3.5 text-left text-[14px] leading-snug text-yellow-ink">
          <b>Нужно войти снова.</b> Изменения на этом устройстве сохранятся, как только вы войдёте.
        </button>
      )}

      <div className="mx-4 mt-4 grid grid-cols-2 gap-2.5">
        <Tile href="/favorites/" emoji="❤️" label="Хочу сходить" value={fam.wantPlaces.length} bg="#FFE4F1" />
        <Tile href="/favorites/?tab=visited" emoji="✅" label="Уже были" value={fam.visitedPlaces.length} bg="#E4F4DD" />
        <Tile href="/favorites/?tab=plans" emoji="🧭" label="Приключения" value={fam.savedPlans.length} bg="#EEE5FE" />
        <Tile href="/favorites/?tab=collections" emoji="📚" label="Сохранённые подборки" value={saved.length} bg="#E2EEFF" />
      </div>

      <Link href="/collections/" className="press mx-4 mt-3 flex items-center gap-3 rounded-[24px] p-3.5" style={{ background: "linear-gradient(120deg,#FFE9F3,#F4EAFF)" }}>
        <span className="text-[30px]">💌</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Мои подборки</span>
          <span className="block text-[13px] leading-snug text-ink-2">
            {mine.length ? `${mine.length} ${plural(mine.length, "подборка", "подборки", "подборок")} · поделиться или изменить` : "Соберите любимые места и отправьте друзьям"}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-pink-ink" />
      </Link>

      <section className="mt-7 px-4">
        <h2 className="tight text-[20px] font-[800]">Какие приключения были</h2>
        {trips.length ? (
          <div className="mt-3 space-y-2">
            {trips.map((t) => (
              <Link key={t.key} href={`/favorites/?tab=visited`} className="press flex items-center gap-3 rounded-[20px] bg-surface p-3 shadow-card">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-fill-2 text-[24px]">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{t.title}</span>
                  <span className="block text-[13px] text-muted">{new Date(t.goAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
                </span>
                {t.rating && <span className="text-[24px]">{RATING[t.rating]}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[15px] leading-snug text-muted">Пройдите приключение из каталога и оцените его после выхода — оно появится здесь на всех ваших устройствах.</p>
        )}
        <Link href="/adventures/" className="press mt-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-semibold">
          <Sparkles size={16} /> Выбрать приключение
        </Link>
      </section>

      <section className="mt-8 px-4">
        <h2 className="tight text-[20px] font-[800]">Настройки</h2>
        <div className="mt-3 overflow-hidden rounded-[24px] bg-surface shadow-card">
          <Row icon={<Pencil size={20} className="text-pink-ink" />} label="Имя и аватар" onClick={() => setEditing(true)} />
          <Row icon={<KeyRound size={20} className="text-blue-ink" />} label="Сменить пароль" onClick={() => setPw(true)} />
          <Row
            icon={<LogOut size={20} className="text-ink-2" />}
            label="Выйти"
            onClick={async () => {
              const r = await logout();
              if (r.ok) return toast("Вы вышли из кабинета");
              if (window.confirm("Часть изменений ещё не сохранилась — нет интернета. Если выйти сейчас, они пропадут. Выйти всё равно?")) {
                await logout({ force: true });
                toast("Вы вышли из кабинета");
              }
            }}
          />
          <Row icon={<Trash2 size={20} className="text-red-ink" />} label="Удалить кабинет" onClick={() => setDel(true)} />
        </div>
        <p className="mt-4 text-center text-[13px] text-muted">
          <Link href="/rules/" className="underline">Правила</Link> · <Link href="/privacy/" className="underline">Конфиденциальность</Link>
        </p>
      </section>

      <EditSheet open={editing} onClose={() => setEditing(false)} />
      <PasswordSheet open={pw} onClose={() => setPw(false)} />
      <DeleteSheet open={del} onClose={() => setDel(false)} />
    </main>
  );
}

function Tile({ href, emoji, label, value, bg }: { href: string; emoji: string; label: string; value: number; bg: string }) {
  return (
    <Link href={href} className="press rounded-[22px] p-3.5" style={{ background: bg }}>
      <span className="text-[26px] leading-none">{emoji}</span>
      <span className="tight mt-2 block text-[28px] font-[850] leading-none">{value}</span>
      <span className="mt-1 block text-[14px] font-semibold leading-tight text-ink-2">{label}</span>
    </Link>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press flex w-full items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-fill-2">{icon}</span>
      <span className="flex-1 text-left text-[16px] font-semibold">{label}</span>
      <ChevronRight size={20} className="text-muted-2" />
    </button>
  );
}

function EditSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAccount((s) => s.user);
  const toast = useToast((s) => s.show);
  const [name, setName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatar, setAvatar] = useState(user?.avatar.value ?? ACCOUNT_AVATARS[0]);
  const [tint, setTint] = useState(user?.tint ?? ACCOUNT_TINTS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!user) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Имя и аватар">
      <div className="flex items-center gap-3">
        <CreatorAvatar author={{ avatar, tint, name }} size={64} ring />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_AVATARS.map((a) => (
              <button key={a} aria-label={`Аватар ${a}`} aria-pressed={avatar === a} onClick={() => setAvatar(a)} className={cn("press hit relative grid h-9 w-9 place-items-center rounded-full text-[20px]", avatar === a ? "bg-ink/10 ring-2 ring-inset ring-ink" : "bg-fill")}>
                {a}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {ACCOUNT_TINTS.map((t) => (
              <button key={t} aria-label="Цвет" aria-pressed={tint === t} onClick={() => setTint(t)} className={cn("press h-6 w-6 rounded-full", tint === t && "ring-2 ring-ink ring-offset-2")} style={{ background: t }} />
            ))}
          </div>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="text-[14px] font-semibold text-ink-2">Имя для подписи</span>
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} />
      </label>
      <label className="mt-3 block">
        <span className="text-[14px] font-semibold text-ink-2">О себе (необязательно)</span>
        <input value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} placeholder="Например: мама двоих, любим музеи" className={field} />
      </label>
      {err && <p role="alert" className="mt-3 text-[14px] font-medium text-red-ink">{err}</p>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await updateProfile({ display_name: name.trim(), bio: bio.trim(), avatar, tint });
            toast("Сохранили");
            onClose();
          } catch (e) {
            setErr(msg(e));
          } finally {
            setBusy(false);
          }
        }}
        className="press mt-5 h-14 w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-40"
      >
        Сохранить
      </button>
    </BottomSheet>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <BottomSheet open={open} onClose={onClose} title="Сменить пароль">
      <p className="-mt-1 text-[14px] leading-snug text-muted">После смены на остальных устройствах нужно будет войти заново. Забытый пароль восстановить нельзя.</p>
      <label className="mt-4 block">
        <span className="text-[14px] font-semibold text-ink-2">Текущий пароль</span>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" className={field} />
      </label>
      <label className="mt-3 block">
        <span className="text-[14px] font-semibold text-ink-2">Новый пароль (от 8 символов)</span>
        <input type="password" value={next} maxLength={64} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={field} />
      </label>
      {err && <p role="alert" className="mt-3 text-[14px] font-medium text-red-ink">{err}</p>}
      <button
        disabled={busy || !cur || next.length < 8}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await changePassword(cur, next);
            toast("Пароль изменён");
            setCur("");
            setNext("");
            onClose();
          } catch (e) {
            setErr(msg(e));
          } finally {
            setBusy(false);
          }
        }}
        className="press mt-5 h-14 w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-40 disabled:shadow-none"
      >
        Сменить пароль
      </button>
    </BottomSheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <BottomSheet open={open} onClose={onClose} title="Удалить кабинет?">
      <p className="-mt-1 text-[15px] leading-snug text-muted">
        Вместе с кабинетом удалятся все ваши подборки (ссылки на них перестанут открываться), оценки и сохранённое. Отменить это нельзя. Данные на этом устройстве тоже будут очищены.
      </p>
      <label className="mt-4 block">
        <span className="text-[14px] font-semibold text-ink-2">Введите пароль для подтверждения</span>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className={field} />
      </label>
      {err && <p role="alert" className="mt-3 text-[14px] font-medium text-red-ink">{err}</p>}
      <button
        disabled={busy || !pw}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await deleteAccount(pw);
            toast("Кабинет удалён");
            setPw("");
            onClose();
          } catch (e) {
            setErr(msg(e));
          } finally {
            setBusy(false);
          }
        }}
        className="press mt-5 h-14 w-full rounded-full bg-red text-[18px] font-bold text-white disabled:opacity-40"
      >
        Удалить навсегда
      </button>
      <button onClick={onClose} className="press mt-2 h-12 w-full rounded-full text-[16px] font-semibold text-ink-2">
        Отмена
      </button>
    </BottomSheet>
  );
}
