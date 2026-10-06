"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, CheckCircle2, Layers } from "lucide-react";
import { parseTransfer, summarize, applyTransfer } from "@/lib/social/transfer";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/social/events";
import { plural } from "@/lib/format";

/** Приём хотелок и подборок, перенесённых с другого устройства (например, из Safari в приложение на домашнем экране). */
function ImportInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const payload = useMemo(() => parseTransfer(sp.get("d")), [sp]);
  const [busy, setBusy] = useState(false);

  if (!payload)
    return (
      <main className="min-h-dvh px-4 pt-[max(18px,env(safe-area-inset-top))]">
        <BackButton fallback="/favorites" />
        <EmptyState art="error" title="Ссылка не открывается" text="Похоже, ссылка для переноса обрезалась. Откройте «Наши хотелки» на старом устройстве и скопируйте её ещё раз." action={{ href: "/favorites", label: "К хотелкам" }} />
      </main>
    );

  const sum = summarize(payload);
  const rows = [
    { Icon: Heart, tone: "bg-pink-50 text-pink", n: sum.wants, label: plural(sum.wants, "хотелка", "хотелки", "хотелок") },
    { Icon: CheckCircle2, tone: "bg-green-50 text-green", n: sum.visited, label: plural(sum.visited, "место, где были", "места, где были", "мест, где были") },
    { Icon: Layers, tone: "bg-blue-50 text-blue", n: sum.collections, label: plural(sum.collections, "подборка", "подборки", "подборок") },
  ].filter((r) => r.n > 0);

  return (
    <main className="min-h-dvh px-4 pb-10 pt-[max(18px,env(safe-area-inset-top))]">
      <BackButton fallback="/favorites" />
      <h1 className="tight mt-4 text-[30px] font-[850] leading-tight">Перенесём ваши хотелки ❤️</h1>
      <p className="mt-1 text-[15.5px] text-muted">Всё, что вы добавили на другом устройстве. То, что уже есть здесь, не затрём.</p>
      <ul className="mt-5 space-y-2.5">
        {rows.map(({ Icon, tone, n, label }) => (
          <li key={label} className="flex items-center gap-3 rounded-[20px] bg-surface p-3.5 shadow-card">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${tone}`}>
              <Icon size={21} />
            </span>
            <span className="text-[17px] font-bold">
              {n} <span className="font-semibold text-ink-2">{label}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          const done = applyTransfer(payload);
          trackEvent("share_channel", { channel: "transfer_applied", ...done });
          const total = done.wants + done.visited + done.collections;
          useToast.getState().show(total ? "Всё на месте ✅" : "Всё это уже у вас есть");
          router.replace("/favorites/");
        }}
        className="press mt-6 h-[58px] w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-60"
      >
        Добавить сюда
      </button>
    </main>
  );
}

export function ImportScreen() {
  return (
    <Suspense fallback={null}>
      <ImportInner />
    </Suspense>
  );
}
