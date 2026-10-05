import type { ParentInfoField, PlaceVerifiedField } from "@/lib/types";
import rawAudit from "./source-audit.generated.json";

export type SourceAuditStatus = "pending" | "reviewed" | "needs_source" | "source_unreachable";

export interface SourceAuditEntry {
  source: string;
  checked_at: string | null;
  status: SourceAuditStatus;
  identity: boolean;
  address: boolean;
  verified_fields: PlaceVerifiedField[];
  verified_family_fields: ParentInfoField[];
  /** Конкретная страница-доказательство для каждого подтверждённого поля. */
  field_sources?: Partial<Record<PlaceVerifiedField, string>>;
}

const AUDIT = rawAudit as unknown as Record<string, SourceAuditEntry>;

export function auditForPlace(slug: string): SourceAuditEntry | undefined {
  const item = AUDIT[slug];
  return item && typeof item === "object" && "status" in item ? item : undefined;
}

export function isAuditedPublicPlace(slug: string): boolean {
  const item = auditForPlace(slug);
  return !!item && item.status === "reviewed" && item.identity === true;
}

export function trustedPlaceTags(
  tags: string[],
  fields: readonly PlaceVerifiedField[],
  familyFields: readonly ParentInfoField[]
): string[] {
  const verified = new Set(fields);
  const family = new Set(familyFields);
  return tags.filter((tag) => {
    const t = tag.toLowerCase();
    if (/бесплат|₽|руб\.?/.test(t) && !verified.has("price")) return false;
    if (/парков/.test(t) && !family.has("parking")) return false;
    if (/коляск/.test(t) && !family.has("stroller_friendly")) return false;
    if (/пелен|комнат.{0,10}матер/.test(t) && !family.has("baby_room")) return false;
    if (/детск.{0,10}меню/.test(t) && !family.has("kids_menu")) return false;
    if (/по записи|нужна запись|запись/.test(t) && !family.has("booking_required")) return false;
    return true;
  });
}
