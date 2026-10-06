import type { Metadata } from "next";
import { MyCollectionsScreen } from "@/components/social/MyCollectionsScreen";

export const metadata: Metadata = { title: "Мои подборки", robots: { index: false, follow: false } };

export default function MyCollectionsPage() {
  return <MyCollectionsScreen />;
}
