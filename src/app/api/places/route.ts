import { NextResponse } from "next/server";
import { repo } from "@/lib/data/repository";
import type { CategoryId } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as CategoryId | null;
  const places = await repo.listPlaces(category ? { category } : undefined);
  return NextResponse.json({ data: places, count: places.length }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } });
}
