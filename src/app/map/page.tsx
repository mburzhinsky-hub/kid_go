import type { Metadata } from "next";
import { MapPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Карта детских мест", description: "Парки, музеи, игровые и кафе для детей на карте Москвы.", alternates: { canonical: "/map" } };

export default function MapPage() {
  return <MapPageClient />;
}
