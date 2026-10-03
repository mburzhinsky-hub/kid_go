import type { Metadata } from "next";
import { SearchPageClient } from "@/components/route-params";

export const metadata: Metadata = { title: "Поиск мест для детей", alternates: { canonical: "/search" } };

export default function SearchPage() {
  return <SearchPageClient />;
}
