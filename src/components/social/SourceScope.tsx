"use client";

import { IntentSourceProvider } from "@/lib/social/intent-source";
import type { IntentSource } from "@/lib/social/types";

/** Говорит всем «Хочу сюда» внутри, с какого экрана пришло намерение (для аналитики и подписи в Избранном). */
export function SourceScope({ source, id, children }: { source: IntentSource; id?: string; children: React.ReactNode }) {
  return <IntentSourceProvider value={{ source_type: source, source_id: id }}>{children}</IntentSourceProvider>;
}
