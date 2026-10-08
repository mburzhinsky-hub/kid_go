import { api } from "./api";

/** Причины жалобы: коды те же, что принимает сервер (api/src/Moderation.php). */
export const REPORT_REASONS = [
  { id: "inappropriate", label: "Неприемлемое содержание", hint: "Грубые слова, пугающие или взрослые темы" },
  { id: "children", label: "Данные или фото детей", hint: "Имена, возраст, лица, адреса детей" },
  { id: "spam", label: "Спам или реклама", hint: "Рекламные ссылки, призывы не по теме" },
  { id: "impersonation", label: "Выдаёт себя за другого", hint: "Чужое имя, организация или команда Kids Go" },
  { id: "other", label: "Другое", hint: "Опишите, что не так" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** Жалоба на подборку. Вход не нужен; повторная жалоба с того же устройства принимается без повторного учёта. */
export async function reportCollection(id: string, reason: ReportReason, note: string): Promise<void> {
  const text = note.trim();
  await api("POST", `/collections/${encodeURIComponent(id)}/report`, { reason, ...(text ? { note: text } : {}) });
}
