"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] mx-auto max-w-[480px]" role="dialog" aria-modal="true">
      <button aria-label="Закрыть" className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-surface pb-[max(20px,env(safe-area-inset-bottom))] shadow-float animate-sheet",
          className
        )}
      >
        <div className="sticky top-0 z-10 bg-surface px-5 pb-2 pt-2.5">
          <div className="mx-auto h-[5px] w-10 rounded-full bg-[#dcdad4]" />
          {title && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <h2 className="tight text-[22px] font-[800] leading-tight">{title}</h2>
              <button onClick={onClose} aria-label="Закрыть" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill">
                <X size={19} strokeWidth={2.3} />
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
