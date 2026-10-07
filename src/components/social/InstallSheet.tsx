"use client";

import { useState } from "react";
import { Share, SquarePlus, Smartphone, Download, ExternalLink, Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { promptInstall, useAppEnv } from "@/lib/social/app";
import { copyText } from "@/lib/social/share";
import { trackEvent } from "@/lib/social/events";
import { useSocialUi } from "@/lib/social/ui-store";

/**
 * «Открыть в приложении» / «Сохранить в приложении». Здесь же — запасные пути, если не открылось:
 * приложение не установлено, встроенный браузер соцсети, iPhone без системного запроса, компьютер.
 * Ничего не блокируем: «Продолжить в браузере» всегда рядом.
 */
export function InstallSheet({ open, onClose, link, ids }: { open: boolean; onClose: () => void; link: string; ids?: { creator_id?: string; collection_id?: string } }) {
  const env = useAppEnv();
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const copy = async () => toast((await copyText(link)) ? "Ссылка скопирована 💌" : "Не получилось скопировать");

  return (
    <BottomSheet open={open} onClose={onClose} title={env.standalone ? "Вы уже в приложении" : "Приложение Kids Go"}>
      {env.standalone ? (
        <p className="text-[16px] leading-snug text-ink-2">Всё сохранено здесь: хотелки и подборки лежат во вкладке «Избранное».</p>
      ) : (
        <>
          <p className="-mt-1 text-[15px] leading-snug text-muted">Значок на экране «Домой», быстрый запуск и всё сохранённое — без регистрации и магазина приложений.</p>

          {env.inApp ? (
            <Steps
              items={[
                [<ExternalLink key="a" size={20} />, <>Нажмите <b>⋯</b> в углу и выберите <b>«Открыть в {env.ios ? "Safari" : "Chrome"}»</b></>],
                [<SquarePlus key="b" size={20} />, env.ios ? <>В Safari: <b>Поделиться → На экран «Домой»</b></> : <>В Chrome: <b>⋮ → Установить приложение</b></>],
              ]}
            />
          ) : env.ios ? (
            <Steps
              items={[
                [<Share key="a" size={20} />, <>Нажмите <b>«Поделиться»</b> внизу Safari</>],
                [<SquarePlus key="b" size={20} />, <>Выберите <b>«На экран “Домой”»</b> и «Добавить»</>],
              ]}
            />
          ) : env.canPrompt ? (
            <button
              disabled={busy || done}
              onClick={async () => {
                setBusy(true);
                trackEvent("collection_app_install_click", { ...ids, via: "prompt" });
                const r = await promptInstall();
                setBusy(false);
                if (r === "accepted") {
                  setDone(true);
                  toast("Готово — значок Kids Go на вашем экране 🎉");
                }
              }}
              className="press mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-60"
            >
              {done ? <Check size={20} /> : <Download size={20} />} {done ? "Установлено" : "Установить приложение"}
            </button>
          ) : env.android ? (
            <Steps
              items={[
                [<SquarePlus key="a" size={20} />, <>Откройте меню <b>⋮</b> в Chrome и выберите <b>«Установить приложение»</b></>],
                [<Smartphone key="b" size={20} />, <>Если значок Kids Go уже есть на экране — откройте его: ссылка откроется внутри приложения</>],
              ]}
            />
          ) : (
            <Steps
              items={[
                [<Smartphone key="a" size={20} />, <>Откройте эту ссылку на телефоне и добавьте Kids Go на экран «Домой»</>],
              ]}
            />
          )}

          <div className="mt-3 flex gap-2">
            <button onClick={copy} className="press h-12 flex-1 rounded-full bg-fill text-[15px] font-semibold">
              Скопировать ссылку
            </button>
            <button onClick={onClose} className="press h-12 flex-1 rounded-full bg-fill text-[15px] font-semibold">
              Продолжить в браузере
            </button>
          </div>
          <p className="mt-3 text-center text-[13px] leading-snug text-muted">Ваши «Хочу сюда» уже сохранены на этом устройстве.</p>
          {env.ios && (
            <button
              onClick={() => {
                onClose();
                useSocialUi.getState().openTransfer();
              }}
              className="press mt-2 h-11 w-full rounded-full bg-blue-50 text-[15px] font-semibold text-blue-ink"
            >
              Перенести хотелки в приложение
            </button>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function Steps({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <ol className="mt-4 space-y-2.5">
      {items.map(([icon, text], i) => (
        <li key={i} className="flex items-center gap-3 rounded-[20px] bg-fill-2 p-3 ring-1 ring-line">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-blue-ink shadow-card">{icon}</span>
          <span className="text-[15px] leading-snug">{text}</span>
        </li>
      ))}
    </ol>
  );
}
