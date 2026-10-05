"use client";

import { useMemo } from "react";
import { useFamily } from "@/lib/store";
import { okrugOfOrigin } from "@/lib/moscow";

/** Округ, выбранный как «где ищем» (undefined — «вся Москва», точный адрес, GPS или город области; до гидрации — тоже undefined). */
export function useOkrug() {
  const origin = useFamily((s) => s.origin);
  const hydrated = useFamily((s) => s.hydrated);
  return useMemo(() => (hydrated ? okrugOfOrigin(origin) : undefined), [hydrated, origin]);
}
