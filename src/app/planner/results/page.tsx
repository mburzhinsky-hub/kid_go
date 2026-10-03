import type { Metadata } from "next";
import { ResultsPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Ваш день готов", robots: { index: false } };

export default function ResultsPage() {
  return <ResultsPageClient />;
}
