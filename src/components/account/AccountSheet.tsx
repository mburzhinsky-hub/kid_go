"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Check, AlertTriangle } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CreatorAvatar } from "@/components/social/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useSocialUi } from "@/lib/social/ui-store";
import { ApiError, checkHandle, login, register } from "@/lib/account";
import { cn } from "@/lib/cn";

export const ACCOUNT_AVATARS = ["🧸", "🦊", "🐼", "🦁", "🐰", "🐸", "🦄", "🌈", "🐯", "🐻", "🐨", "🐵", "🦉", "🐙", "🚀", "⭐"];
export const ACCOUNT_TINTS = ["#FFE4F1", "#EEE5FE", "#E2EEFF", "#E4F4DD", "#FFF3D6", "#FFE3D4"];

const field = "mt-1.5 h-12 w-full rounded-[16px] bg-fill px-4 text-[16px] outline-none focus:ring-2 focus:ring-pink/40";

/** Понятные сообщения вместо технических кодов. */
function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.offline) return e.message;
    if (e.status === 429) return e.retryAfter ? `Слишком много попыток. Подождите ${Math.max(1, Math.ceil(e.retryAfter / 60))} мин и повторите.` : "Слишком много попыток. Попробуйте позже.";
    if (e.status === 404 || e.status >= 500) return "Сейчас не получается. Попробуйте чуть позже.";
    return e.message;
  }
  return "Что-то пошло не так. Попробуйте ещё раз.";
}

export function AccountSheet() {
  const acc = useSocialUi((s) => s.account);
  const close = useSocialUi((s) => s.closeAccount);
  const toast = useToast((s) => s.show);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [avatar, setAvatar] = useState(ACCOUNT_AVATARS[0]);
  const [tint, setTint] = useState(ACCOUNT_TINTS[0]);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<{ state: "idle" | "wait" | "ok" | "bad"; text?: string }>({ state: "idle" });
  const openedAt = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    if (acc.open) {
      setMode(acc.mode);
      setError("");
      setPassword("");
      openedAt.current = Date.now();
    }
  }, [acc.open, acc.mode]);

  const h = handle.trim().toLowerCase();
  // ник проверяем на лету: формат — сразу на устройстве, занятость — у сервера
  useEffect(() => {
    if (mode !== "register") return;
    if (!h) return setCheck({ state: "idle" });
    if (!/^[a-z0-9._-]{3,30}$/.test(h)) return setCheck({ state: "bad", text: h.length < 3 ? "Минимум 3 символа" : "Латиница, цифры, точка, дефис, подчёркивание" });
    setCheck({ state: "wait" });
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await checkHandle(h);
        if (my === seq.current) setCheck(r.available ? { state: "ok", text: "Ник свободен" } : { state: "bad", text: r.reason ?? "Этот ник занят" });
      } catch {
        if (my === seq.current) setCheck({ state: "idle" });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [h, mode]);

  const pwOk = password.length >= 8;
  const canRegister = check.state !== "bad" && h.length >= 3 && pwOk && consent && !busy;
  const canLogin = h.length >= 3 && password.length >= 1 && !busy;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        // бот заполняет скрытое поле или отправляет форму мгновенно — сервер всё равно проверит
        if (trap || Date.now() - openedAt.current < 1500) throw new ApiError(400, "rejected", "Не удалось создать кабинет");
        await register({ handle: h, password, display_name: name.trim() || undefined, avatar, tint, consent, website: trap });
        toast("Кабинет создан ✨");
      } else {
        await login(h, password);
        toast("С возвращением!");
      }
      const done = acc.onDone;
      close();
      setPassword("");
      done?.();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={acc.open} onClose={close} title={mode === "register" ? "Создать кабинет" : "Войти в кабинет"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "register" ? canRegister : canLogin) void submit();
        }}
        autoComplete="on"
      >
        <p className="-mt-1 text-[15px] leading-snug text-muted">
          {mode === "register" ? "Только ник и пароль — без почты и телефона. Подборки, «Хочу сюда» и «Были» будут на любом вашем телефоне." : "Введите ник и пароль, которые придумали при создании кабинета."}
        </p>

        {mode === "register" && (
          <div className="mt-4 flex items-center gap-3">
            <CreatorAvatar author={{ avatar, tint, name: name || h || "Вы" }} size={64} ring />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                {ACCOUNT_AVATARS.map((a) => (
                  <button type="button" key={a} aria-label={`Аватар ${a}`} aria-pressed={avatar === a} onClick={() => setAvatar(a)} className={cn("press hit relative grid h-9 w-9 place-items-center rounded-full text-[20px]", avatar === a ? "bg-ink/10 ring-2 ring-inset ring-ink" : "bg-fill")}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                {ACCOUNT_TINTS.map((t) => (
                  <button type="button" key={t} aria-label="Цвет" aria-pressed={tint === t} onClick={() => setTint(t)} className={cn("press h-6 w-6 rounded-full", tint === t && "ring-2 ring-ink ring-offset-2")} style={{ background: t }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-[14px] font-semibold text-ink-2">Ник</span>
          <div className="mt-1.5 flex h-12 items-center rounded-[16px] bg-fill px-4 focus-within:ring-2 focus-within:ring-pink/40">
            <span className="text-muted">@</span>
            <input
              value={handle}
              maxLength={30}
              onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              aria-label="Ник"
              className="min-w-0 flex-1 bg-transparent pl-1 text-[16px] outline-none"
            />
            {mode === "register" && check.state === "wait" && <Loader2 size={18} className="animate-spin text-muted" />}
            {mode === "register" && check.state === "ok" && <Check size={18} className="text-green-ink" />}
          </div>
          {mode === "register" && check.text && check.state !== "wait" && <span className={cn("mt-1 block text-[13px]", check.state === "bad" ? "text-red-ink" : "text-green-ink")}>{check.text}</span>}
        </label>

        {mode === "register" && (
          <label className="mt-3 block">
            <span className="text-[14px] font-semibold text-ink-2">Имя для подписи (необязательно)</span>
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Например: Мама Маша" autoComplete="nickname" className={field} />
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-[14px] font-semibold text-ink-2">Пароль</span>
          <div className="mt-1.5 flex h-12 items-center rounded-[16px] bg-fill pl-4 pr-1 focus-within:ring-2 focus-within:ring-pink/40">
            <input
              type={show ? "text" : "password"}
              value={password}
              maxLength={64}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              aria-label="Пароль"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="press hit relative grid h-10 w-10 place-items-center text-muted">
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {mode === "register" && <span className={cn("mt-1 block text-[13px]", password && !pwOk ? "text-red-ink" : "text-muted")}>От 8 символов. Не используйте пароль от почты или банка.</span>}
        </label>

        {mode === "register" && (
          <>
            <div className="mt-4 flex gap-2.5 rounded-[18px] bg-yellow-50 p-3 text-[14px] leading-snug text-yellow-ink">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <p>
                <b>Запомните или запишите пароль.</b> Почту мы не просим, поэтому восстановить забытый пароль нельзя.
              </p>
            </div>
            {/* ловушка для ботов: человек это поле не видит */}
            <input value={trap} onChange={(e) => setTrap(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <label className="mt-4 flex items-start gap-3 text-[14px] leading-snug text-ink-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#ff2e88]" />
              <span>
                Соглашаюсь с{" "}
                <Link href="/rules/" target="_blank" className="font-semibold text-pink-ink underline">
                  правилами сообщества
                </Link>{" "}
                и{" "}
                <Link href="/privacy/" target="_blank" className="font-semibold text-pink-ink underline">
                  политикой конфиденциальности
                </Link>
                . Фото детей и их данные в подборки не добавляю.
              </span>
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-[14px] font-medium text-red-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={mode === "register" ? !canRegister : !canLogin}
          className="press mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-40 disabled:shadow-none"
        >
          {busy && <Loader2 size={20} className="animate-spin" />}
          {mode === "register" ? "Создать кабинет" : "Войти"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "register" ? "login" : "register");
            setError("");
          }}
          className="press mt-3 h-12 w-full rounded-full text-[16px] font-semibold text-ink-2"
        >
          {mode === "register" ? "Уже есть кабинет? Войти" : "Нет кабинета? Создать"}
        </button>
      </form>
    </BottomSheet>
  );
}
