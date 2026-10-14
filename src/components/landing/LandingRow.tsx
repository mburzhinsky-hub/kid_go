import type { Place } from "@/lib/types";
import { PlaceRow } from "@/components/cards/PlaceCard";
import { formatAgeRange } from "@/lib/format";
import { DEFAULT_LOCATION, haversineKm, pt } from "@/lib/geo";
import { verifiedFacts } from "@/lib/landings";

const where = (p: Place) => (p.indoor && !p.outdoor ? "под крышей" : p.outdoor && !p.indoor ? "на улице" : "в помещении и на улице");

/** Строка подборки: карточка места и подтверждённые факты. Цена и часы — только если сверены с официальным сайтом. */
export function LandingRow({ place, trip }: { place: Place; trip?: boolean }) {
  const f = verifiedFacts(place);
  const away = trip && place.region === "mo";
  const km = away ? Math.round(haversineKm(DEFAULT_LOCATION, pt(place))) : null;
  const date = place.verified_at?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const checked = date ? ` (${date[3]}.${date[2]}.${date[1]})` : "";
  const facts = [f.price, f.hours ? `режим: ${f.hours}` : f.hoursByDay ? "режим по дням — в карточке" : null].filter(Boolean) as string[];
  return (
    <PlaceRow
      place={place}
      footer={
        <div className="space-y-1.5 border-t border-line pt-2.5 text-[13px] leading-snug text-ink-2">
          <p>
            <span className="font-semibold">{formatAgeRange(place.age_min, place.age_max)}</span> · {where(place)}
            {km != null && <> · за городом, ≈ {km} км от центра по прямой</>}
          </p>
          {facts.length > 0 && <p className="text-muted">Проверено на официальном сайте{checked}: {facts.join(" · ")}</p>}
        </div>
      }
    />
  );
}
