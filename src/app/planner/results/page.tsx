import type { Metadata } from "next";
import { PlannerResults } from "@/components/planner/PlannerResults";

export const metadata: Metadata = { title: "Ваш день готов", robots: { index: false } };

export default async function ResultsPage({ searchParams }: PageProps<"/planner/results">) {
  const sp = await searchParams;
  const query = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return <PlannerResults query={query} />;
}
