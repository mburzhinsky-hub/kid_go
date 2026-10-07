import type { Metadata } from "next";
import { PlannerPageClient } from "@/components/route-params";

export const metadata: Metadata = {
  title: "Придумаем ваш день",
  description: "Дети, время и настроение — и готовые варианты семейного дня.",
};

export default function PlannerPage() {
  return <PlannerPageClient />;
}
