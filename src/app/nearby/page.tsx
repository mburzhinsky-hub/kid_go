import type { Metadata } from "next";
import { NearbyPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Место рядом", robots: { index: false } };

export default function NearbyPage() {
  return <NearbyPageClient />;
}
