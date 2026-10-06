import type { Metadata } from "next";
import { ImportScreen } from "@/components/social/ImportScreen";

export const metadata: Metadata = { title: "Перенос хотелок", robots: { index: false, follow: false } };

export default function ImportPage() {
  return <ImportScreen />;
}
