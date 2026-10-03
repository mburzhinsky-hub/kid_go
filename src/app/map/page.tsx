import type { Metadata } from "next";
import { MapScreen } from "@/components/map/MapScreen";
import type { CategoryId } from "@/lib/types";

export const metadata: Metadata = { title: "Карта детских мест", description: "Парки, музеи, игровые и кафе для детей на карте Москвы." };

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const sp = await searchParams;
  return <MapScreen initialCategory={(sp.category as CategoryId) || undefined} initialFocus={(sp.place as string) || undefined} />;
}
