import type { Metadata } from "next";
import { FavoritesPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Наши хотелки", robots: { index: false } };

export default function FavoritesPage() {
  return <FavoritesPageClient />;
}
