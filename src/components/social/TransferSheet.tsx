"use client";

import { useEffect, useState } from "react";
import { Copy, Send } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { transferUrl, type TransferSummary } from "@/lib/social/transfer";
import { canNativeShare, copyText, nativeShare } from "@/lib/social/share";
import { plural } from "@/lib/format";

/**
 * «Перенести на другое устройство». На iPhone приложение с домашнего экрана хранит данные отдельно от Safari:
 * ссылка из этого окна открывается в приложении и возвращает хотелки и подборки на место. Аккаунт не нужен.
 */
export function TransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [data, setData] = useState<{ url: string; summary: TransferSummary } | null>(null);

  useEffect(() => {
    if (open) setData(transferUrl());
  }, [open]);

  const s = data?.summary;
  const empty = !!s && !s.wants && !s.visited && !s.collections;
  const parts = s
    ? [
        s.wants ? `${s.wants} ${plural(s.wants, "хотелка", "хотелки", "хотелок")}` : "",
        s.visited ? `${s.visited} ${plural(s.visited, "посещённое место", "посещённых места", "посещённых мест")}` : "",
        s.collections ? `${s.collections} ${plural(s.collections, "подборка", "подборки", "подборок")}` : "",
      ].filter(Boolean)
    : [];

  return (
    <BottomSheet open={open} onClose={onClose} title="Перенести на другое устройство">
      {!data ? null : empty ? (
        <p className="text-[16px] leading-snug text-ink-2">Пока переносить нечего: добавьте места в «Хочу сюда» или сохраните подборку — и вернитесь сюда.</p>
      ) : (
        <>
          <p className="-mt-1 text-[15px] leading-snug text-muted">
            Откройте эту ссылку в приложении КидГоу (с экрана «Домой») или на другом телефоне — всё окажется на месте. Переедет: <b className="text-ink-2">{parts.join(", ")}</b>.
          </p>
          <input readOnly value={data.url} onFocus={(e) => e.currentTarget.select()} aria-label="Ссылка для переноса" className="mt-3 h-12 w-full truncate rounded-[16px] bg-fill px-3.5 text-[14px] text-ink-2 outline-none" />
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => toast((await copyText(data.url)) ? "Ссылка скопирована 💌" : "Не получилось скопировать")}
              className="press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-pink text-[16px] font-bold text-white shadow-pink"
            >
              <Copy size={20} /> Скопировать
            </button>
            {canNativeShare() && (
              <button
                onClick={async () => {
                  if (await nativeShare({ title: "Мои хотелки в КидГоу", text: "Мои хотелки и подборки в КидГоу", url: data.url })) onClose();
                }}
                className="press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fill text-[16px] font-semibold"
              >
                <Send size={16} /> Отправить себе
              </button>
            )}
          </div>
          <p className="mt-3 text-center text-[13px] leading-snug text-muted">В ссылке — только ваши хотелки и подборки. Никому, кроме себя, её лучше не отправлять.</p>
        </>
      )}
    </BottomSheet>
  );
}
