import type { Metadata } from "next";
import { DayPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Наш день", robots: { index: false } };

export default function DayPage() {
  return <DayPageClient />;
}
