"use client";

import { useFamily } from "@/lib/store";
import { isSuburban } from "@/lib/location";

/**
 * Что показывать по выбранной географии. «Москва» — только город; «Москва + область» — ещё и выезды за город.
 * Если человек живёт за городом (точка выезда за МКАД), область нужна ему всегда.
 */
export function useGeoVisible() {
  const geoScope = useFamily((s) => s.geoScope);
  const origin = useFamily((s) => s.origin);
  const regionOk = geoScope === "moscow-region" || (origin.source !== "default" && isSuburban(origin));
  return { regionOk, geoScope };
}
