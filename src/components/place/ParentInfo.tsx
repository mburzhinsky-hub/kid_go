import { Baby, Car, Utensils, Bath, Shirt, CalendarCheck, House, Trees, Check, X, Hourglass, Wallet, ExternalLink } from "lucide-react";
import type { ParentInfoField, Place, Level } from "@/lib/types";
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

type FactState = "yes" | "no" | "unknown";

/** Самый важный блок для родителей: удобства, темп и сколько обычно стоит. */
export function ParentInfo({ place }: { place: Place }) {
  const unknown = new Set<ParentInfoField>(place.unknown_fields ?? []);
  const verified = new Set(place.verified_fields ?? []);
  const state = (field: ParentInfoField, value: boolean): FactState => unknown.has(field) ? "unknown" : value ? "yes" : "no";

  const facts: { label: string; state: FactState; Icon: React.ComponentType<{ size?: number; className?: string }>; hint?: string }[] = [
    {
      label: "С коляской",
      state: state("stroller_friendly", place.stroller_friendly),
      Icon: STROLLER,
      hint: place.stroller_friendly ? "подходит" : "может быть неудобно",
    },
    { label: "Парковка", state: state("parking", place.parking), Icon: Car },
    { label: "Детское меню", state: state("kids_menu", place.kids_menu), Icon: Utensils },
    { label: "Туалет", state: state("toilets", place.toilets), Icon: Bath },
    { label: "Пеленальная", state: state("baby_room", place.baby_room), Icon: Baby },
    { label: "Гардероб", state: state("wardrobe", place.wardrobe), Icon: Shirt },
    {
      label: unknown.has("booking_required") ? "Запись" : place.booking_required ? "Нужна запись" : "Без записи",
      state: unknown.has("booking_required") ? "unknown" : place.booking_required ? "no" : "yes",
      Icon: CalendarCheck,
    },
    {
      label: place.indoor && place.outdoor ? "Внутри и снаружи" : place.indoor ? "Под крышей" : "На улице",
      state: "yes",
      Icon: place.indoor ? House : Trees,
    },
  ];

  const visibleFacts = facts.filter((fact) => fact.state !== "unknown");
  const checkedDate = place.verified_at
    ? new Date(`${place.verified_at}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null;
  const exactDynamic = verified.has("price") && verified.has("opening_hours");
  const trustText = checkedDate
    ? exactDynamic
      ? `Источник проверен ${checkedDate}; цена и режим работы подтверждены`
      : `Источник места проверен ${checkedDate}. Ниже показаны только подтверждённые сведения`
    : "Ниже показаны только сведения, подтверждённые указанным источником";

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {visibleFacts.map(({ label, state: factState, Icon, hint }) => {
          const yes = factState === "yes";
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-[16px] px-3 py-2.5",
                yes ? "bg-green-50" : "bg-fill"
              )}
            >
              <Icon size={20} className={yes ? "text-green" : "text-muted"} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] font-semibold leading-tight", !yes && "text-muted")}>{label}</p>
                {hint && <p className="text-[12px] leading-tight text-muted">{hint}</p>}
              </div>
              {yes ? (
                <Check size={17} strokeWidth={3} className="shrink-0 text-green" />
              ) : (
                <X size={17} strokeWidth={3} className="shrink-0 text-muted-2" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Meter label="Активность" level={place.activity_level} words={["спокойно", "умеренно", "очень активно"]} color="#FF7A2E" />
        <Meter label="Шум" level={place.noise_level} words={["тихо", "умеренно", "шумно"]} color="#8B3DF0" />
        <Stat Icon={Hourglass} label="Оценка времени" value={`≈ ${formatDuration(place.average_duration)}`} />
        {verified.has("price") && <Stat Icon={Wallet} label="Оценка на семью" value={`≈ ${formatBudget(place.family_budget)}`} />}
      </div>

      <div className="mt-2.5 rounded-[14px] bg-fill-2 px-3 py-2.5 text-[12.5px] leading-snug text-muted">
        <p>Возраст: {formatAgeRange(place.age_min, place.age_max)}. {trustText}.</p>
        {place.source && (
          <a href={place.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-ink-2 underline decoration-line underline-offset-2">
            Источник{place.source_name ? `: ${place.source_name}` : ""} <ExternalLink size={12} />
          </a>
        )}
      </div>
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
