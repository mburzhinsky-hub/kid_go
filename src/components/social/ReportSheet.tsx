"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ApiError } from "@/lib/account/api";
import { REPORT_REASONS, reportCollection, type ReportReason } from "@/lib/account/report";
import { cn } from "@/lib/cn";

/** Понятные сообщения вместо технических кодов. */
function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.offline) return e.message;
    if (e.status === 429) return "Вы уже отправили несколько жалоб. Попробуйте завтра.";
    if (e.status === 404) return "Подборка уже недоступна — возможно, её скрыли или удалили.";
    if (e.status === 403) return "На свою подборку пожаловаться нельзя.";
    if (e.status >= 500) return "Сервер сейчас недоступен. Попробуйте чуть позже.";
    return e.message;
  }
  return "Что-то пошло не так. Попробуйте ещё раз.";
}

/** Жалоба на чужую подборку: причина и необязательный комментарий. Три жалобы от разных людей скрывают подборку до проверки. */
export function ReportSheet({ collectionId, open, onClose }: { collectionId: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
      setError("");
      setDone(false);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    try {
      await reportCollection(collectionId, reason, note);
      setDone(true);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={done ? "Спасибо!" : "Пожаловаться на подборку"}>
      {done ? (
        <div className="pb-2 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-50 text-green-ink">
            <Check size={28} strokeWidth={2.5} />
          </span>
          <p className="mt-3 text-[16px] leading-snug text-ink-2">Мы получили жалобу и проверим подборку. Если нарушение подтвердится, подборка будет скрыта.</p>
          <button onClick={onClose} className="press mt-5 h-12 w-full rounded-full bg-fill text-[16px] font-bold">
            Закрыть
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[15px] leading-snug text-muted">Что не так с этой подборкой? Автор не узнает, кто пожаловался.</p>
          <div role="radiogroup" aria-label="Причина жалобы" className="mt-3 space-y-2">
            {REPORT_REASONS.map((r) => {
              const on = reason === r.id;
              return (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r.id)}
                  className={cn("press flex w-full items-start gap-3 rounded-[18px] px-4 py-3 text-left ring-1", on ? "bg-pink-50 ring-2 ring-pink" : "bg-surface ring-line")}
                >
                  <span aria-hidden className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-pink" : "border-line")}>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-pink" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold leading-tight">{r.label}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{r.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-3 block text-[14px] font-semibold text-ink-2" htmlFor="report-note">
            Комментарий <span className="font-normal text-muted">(необязательно)</span>
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Например: в описании чужой телефон и реклама"
            className="mt-1.5 w-full resize-none rounded-[16px] bg-fill px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-pink/40"
          />
          {error && (
            <p role="alert" className="mt-3 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-[14px] leading-snug text-red">
              {error}
            </p>
          )}
          <button
            onClick={submit}
            disabled={!reason || busy}
            className="press mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-50"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : null} Отправить жалобу
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
