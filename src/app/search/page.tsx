import type { Metadata } from "next";
import { SearchScreen } from "@/components/search/SearchScreen";
import type { CategoryId } from "@/lib/types";
import { categoryDef } from "@/lib/catalog";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const sp = await searchParams;
  const cat = typeof sp.category === "string" ? categoryDef(sp.category) : null;
  return {
    title: cat && cat.id !== "all" ? `${cat.label} для детей в Москве` : "Поиск мест для детей",
    alternates: { canonical: cat && cat.id !== "all" ? `/search?category=${cat.id}` : "/search" },
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const sort = sp.sort === "popular" ? "best" : (sp.sort as "near" | "cheap" | undefined);
  return <SearchScreen initialQ={typeof sp.q === "string" ? sp.q : ""} initialCategory={sp.category as CategoryId | undefined} initialSort={sort} />;
}
