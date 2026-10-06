import type { Metadata } from "next";
import { BuilderRoute } from "@/components/social/BuilderRoute";

export const metadata: Metadata = { title: "Редактирование подборки", robots: { index: false, follow: false } };

export default function EditCollectionPage() {
  return <BuilderRoute />;
}
