"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    // фокус внутрь листа (если поле уже в фокусе через autoFocus — не трогаем), Tab не уходит под лист
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (n) => n.getClientRects().length > 0
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeRef.current();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return e.preventDefault();
      const first = f[0];
      const last = f[f.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] mx-auto max-w-[480px]" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <button aria-label="Закрыть" tabIndex={-1} className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-surface pb-[max(20px,env(safe-area-inset-bottom))] shadow-float outline-none animate-sheet",
          className
        )}
      >
        <div className="sticky top-0 z-10 bg-surface px-5 pb-2 pt-2.5">
          <div className="mx-auto h-[5px] w-10 rounded-full bg-[#dcdad4]" />
          {title && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <h2 id={titleId} className="tight text-[22px] font-[800] leading-tight">{title}</h2>
              <button onClick={onClose} aria-label="Закрыть" className="press hit relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill">
                <X size={20} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
        <div className="px-5 pt-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
