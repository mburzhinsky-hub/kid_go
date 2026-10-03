import { NextResponse } from "next/server";
import { repo } from "@/lib/data/repository";

export async function GET(_req: Request, ctx: RouteContext<"/api/places/[slug]">) {
  const { slug } = await ctx.params;
  const place = await repo.getPlace(slug);
  if (!place) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const nearby = await repo.nearby(place, { limit: 6 });
  return NextResponse.json({ data: place, nearby: nearby.map((p) => ({ slug: p.slug, title: p.title, km: p.km })) });
}
