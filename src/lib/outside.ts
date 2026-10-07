import type { Place } from "@/lib/types";
import { inMoscow } from "@/lib/moscow";
import { isSuburban } from "@/lib/location";
import { pt } from "@/lib/geo";

type P = Pick<Place, "id" | "slug" | "latitude" | "longitude" | "region">;

/** Место за пределами города: Московская область или окраина за ~24 км от центра. Лёгкий модуль — без движка рекомендаций. */
export const isOutside = (p: P): boolean => !inMoscow(p) || isSuburban(pt(p));
