import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kids-go.fun";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/favorites", "/profile", "/day", "/planner/results", "/collections", "/c/", "/import"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
