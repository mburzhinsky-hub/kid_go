import type { Metadata } from "next";
import { FavoritesScreen } from "@/components/favorites/FavoritesScreen";

export const metadata: Metadata = { title: "Наши хотелки", robots: { index: false } };

export default async function FavoritesPage({ searchParams }: PageProps<"/favorites">) {
  const sp = await searchParams;
  const tab = sp.tab === "plans" || sp.tab === "visited" ? sp.tab : "want";
  return <FavoritesScreen initialTab={tab} />;
}
