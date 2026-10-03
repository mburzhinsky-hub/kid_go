/**
 * Тонкая обёртка над аналитикой. При наличии NEXT_PUBLIC_POSTHOG_KEY
 * подключается posthog-js (динамический import, не раздувает бандл),
 * иначе события пишутся в console в dev-режиме.
 */
type Props = Record<string, string | number | boolean | undefined>;

export function track(event: string, props?: Props) {
  if (typeof window === "undefined") return;
  const ph = (window as unknown as { posthog?: { capture: (e: string, p?: Props) => void } }).posthog;
  if (ph) ph.capture(event, props);
  else if (process.env.NODE_ENV === "development") console.debug("[track]", event, props ?? "");
}
