"use client";

/**
 * «Открыть в приложении». КидГоу — веб-приложение (PWA): «приложение» = значок на экране «Домой».
 *  - Android/Chrome: системный запрос на установку (beforeinstallprompt); у установленного приложения ссылки из других программ
 *    открываются прямо в нём (manifest.scope + launch_handler);
 *  - iPhone/Safari: установки одним нажатием нет — показываем два шага «Поделиться → На экран “Домой”»;
 *  - внутри браузера Instagram/Facebook установка невозможна — подсказываем открыть ссылку в Safari/Chrome.
 */
import { useEffect, useState } from "react";
import { platform } from "./identity";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | undefined;
let installed = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((s) => s());

export function initInstallCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = undefined;
    notify();
  });
}

export interface AppEnv {
  /** Уже внутри установленного приложения. */
  standalone: boolean;
  ios: boolean;
  android: boolean;
  /** Встроенный браузер соцсети: оттуда ничего не установить. */
  inApp: "instagram" | "facebook" | "telegram" | null;
  /** Браузер готов показать системный запрос на установку. */
  canPrompt: boolean;
  installed: boolean;
}

export function detectEnv(): AppEnv {
  if (typeof navigator === "undefined") return { standalone: false, ios: false, android: false, inApp: null, canPrompt: false, installed };
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /Instagram/i.test(ua) ? "instagram" : /FBAN|FBAV/i.test(ua) ? "facebook" : /Telegram/i.test(ua) ? "telegram" : null;
  return { standalone: platform() === "app", ios, android: /Android/i.test(ua), inApp, canPrompt: !!deferred, installed };
}

export function useAppEnv(): AppEnv {
  const [env, setEnv] = useState<AppEnv>({ standalone: false, ios: false, android: false, inApp: null, canPrompt: false, installed: false });
  useEffect(() => {
    const update = () => setEnv(detectEnv());
    update();
    subs.add(update);
    return () => {
      subs.delete(update);
    };
  }, []);
  return env;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const d = deferred;
  deferred = undefined;
  try {
    await d.prompt();
    const { outcome } = await d.userChoice;
    if (outcome === "accepted") installed = true;
    notify();
    return outcome;
  } catch {
    return "unavailable";
  }
}
