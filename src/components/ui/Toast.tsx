"use client";

import { create } from "zustand";
import { useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

interface ToastState {
  msg: string | null;
  link?: { href: string; label: string };
  key: number;
  show: (msg: string, link?: { href: string; label: string }) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  msg: null,
  key: 0,
  show: (msg, link) => set((s) => ({ msg, link, key: s.key + 1 })),
  hide: () => set({ msg: null }),
}));

export function ToastHost({ bottom = 104 }: { bottom?: number }) {
  const { msg, link, key, hide } = useToast();
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [msg, key, hide]);
  if (!msg || typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[80] mx-auto flex max-w-[480px] justify-center px-4" style={{ bottom }}>
      <div key={key} role="status" className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-[14.5px] font-medium text-white shadow-float animate-rise">
        <span>{msg}</span>
        {link && (
          <Link href={link.href} onClick={hide} className="rounded-full bg-white/15 px-3 py-1.5 text-[13.5px] font-semibold text-white">
            {link.label}
          </Link>
        )}
      </div>
    </div>,
    document.body
  );
}
