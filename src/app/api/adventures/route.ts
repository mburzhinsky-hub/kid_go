import { NextResponse } from "next/server";
import { repo } from "@/lib/data/repository";

export async function GET() {
  const data = await repo.listAdventures();
  return NextResponse.json({ data, count: data.length }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } });
}
