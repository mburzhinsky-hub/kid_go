"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // точка подключения Sentry: Sentry.captureException(error)
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        art="error"
        title="Ой, что-то сломалось"
        text="Мы уже чиним. Попробуйте ещё раз — обычно помогает."
        secondary={
          <button onClick={reset} className="press mt-5 h-12 rounded-full bg-pink px-6 text-[16px] font-semibold text-white shadow-pink">
            Попробовать снова
          </button>
        }
      />
    </main>
  );
}
