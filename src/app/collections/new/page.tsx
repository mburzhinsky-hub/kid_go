import type { Metadata } from "next";
import { BuilderRoute } from "@/components/social/BuilderRoute";

export const metadata: Metadata = { title: "Новая подборка", robots: { index: false, follow: false } };

export default function NewCollectionPage() {
  return <BuilderRoute />;
}
