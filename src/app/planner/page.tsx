import type { Metadata } from "next";
import { PlannerWizard } from "@/components/planner/PlannerWizard";

export const metadata: Metadata = {
  title: "Придумаем ваш день",
  description: "Возраст, настроение, время и бюджет — и готовый семейный маршрут на сегодня.",
};

export default function PlannerPage() {
  return <PlannerWizard />;
}
