import { Baby, Car, Utensils, Bath, Shirt, CalendarCheck, House, Trees, Check, X, Hourglass, Wallet } from "lucide-react";
import type { Place, Level } from "@/lib/types";
import { formatBudget, formatDuration, formatAgeRange } from "@/lib/format";
import { cn } from "@/lib/cn";

const STROLLER = (p: { className?: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    <path d="M4 5h2l1.6 9.5a2 2 0 0 0 2 1.5h7.2a2 2 0 0 0 2-1.6L20 9H8.2" />
    <path d="M11 9V3.5a6 6 0 0 1 8.5 5.5" />
    <circle cx="9.5" cy="19.5" r="1.6" />
    <circle cx="17" cy="19.5" r="1.6" />
  </svg>
);

/** Самый важный блок для родителей: удобства, темп и сколько обычно стоит. */
export function ParentInfo({ place }: { place: Place }) {
  const facts: { label: string; ok: boolean; Icon: React.ComponentType<{ size?: number; className?: string }>; hint?: string }[] = [
    { label: "С коляской", ok: place.stroller_friendly, Icon: STROLLER, hint: place.stroller_friendly ? "пандусы, лифт" : "лучше слинг" },
    { label: "Парковка", ok: place.parking, Icon: Car },
    { label: "Детское меню", ok: place.kids_menu, Icon: Utensils },
    { label: "Туалет", ok: place.toilets, Icon: Bath },
    { label: "Пеленальная", ok: place.baby_room, Icon: Baby },
    { label: "Гардероб", ok: place.wardrobe, Icon: Shirt },
    { label: place.booking_required ? "Нужна запись" : "Без записи", ok: !place.booking_required, Icon: CalendarCheck },
    {
      label: place.indoor && place.outdoor ? "Внутри и снаружи" : place.indoor ? "Под крышей" : "На улице",
      ok: true,
      Icon: place.indoor ? House : Trees,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {facts.map(({ label, ok, Icon, hint }) => (
          <div key={label} className={cn("flex items-center gap-2.5 rounded-[16px] px-3 py-2.5", ok ? "bg-green-50" : "bg-fill")}>
            <Icon size={20} className={ok ? "text-green" : "text-muted"} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13.5px] font-semibold leading-tight", !ok && "text-muted")}>{label}</p>
              {hint && <p className="text-[12px] leading-tight text-muted">{hint}</p>}
            </div>
            {ok ? (
              <Check size={17} strokeWidth={3} className="shrink-0 text-green" />
            ) : (
              <X size={17} strokeWidth={3} className="shrink-0 text-muted-2" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Meter label="Активность" level={place.activity_level} words={["спокойно", "умеренно", "очень активно"]} color="#FF7A2E" />
        <Meter label="Шум" level={place.noise_level} words={["тихо", "умеренно", "шумно"]} color="#8B3DF0" />
        <Stat Icon={Hourglass} label="Обычно проводят" value={formatDuration(place.average_duration)} />
        <Stat Icon={Wallet} label="На семью из 4" value={formatBudget(place.family_budget)} />
      </div>
      <p className="mt-2.5 text-[12.5px] text-muted">
        Возраст: {formatAgeRange(place.age_min, place.age_max)}. Данные от родителей и заведения, обновлены в этом месяце.
      </p>
    </div>
  );
}

function Meter({ label, level, words, color }: { label: string; level: Level; words: string[]; color: string }) {
  return (
    <div className="rounded-[16px] bg-fill-2 px-3 py-2.5 ring-1 ring-line">
      <p className="text-[12.5px] text-muted">{label}</p>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i <= level ? color : "#e9e7e2" }} />
        ))}
      </div>
      <p className="mt-1 text-[14px] font-semibold">{words[level - 1]}</p>
    </div>
  );
}

function Stat({ Icon, label, value }: { Icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-fill-2 px-3 py-2.5 ring-1 ring-line">
      <p className="flex items-center gap-1 text-[12.5px] text-muted">
        <Icon size={13} /> {label}
      </p>
      <p className="mt-1 text-[16px] font-bold">{value}</p>
    </div>
  );
}
