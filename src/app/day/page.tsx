import type { Metadata } from "next";
import { DayView } from "@/components/adventure/DayView";

export const metadata: Metadata = { title: "Наш день", robots: { index: false } };

export default async function DayPage({ searchParams }: PageProps<"/day">) {
  const q = await searchParams;
  const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const steps = str("steps")?.split(",").filter(Boolean);
  return (
    <DayView
      steps={steps}
      title={str("title")}
      start={str("start")}
      emoji={str("emoji")}
      explanation={str("why")}
      why={str("chips")?.split("|").filter(Boolean)}
      durations={str("d")?.split(",").map(Number)}
    />
  );
}
