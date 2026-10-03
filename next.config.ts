import type { NextConfig } from "next";

const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Статическая выгрузка для GitHub Pages (workflow задаёт GITHUB_PAGES и NEXT_PUBLIC_BASE_PATH)
  ...(pages ? { output: "export" as const, trailingSlash: true, basePath: process.env.NEXT_PUBLIC_BASE_PATH } : {}),
  reactStrictMode: true,
  devIndicators: false,
  images: {
    // Фото отдаются через CDN (imgix у Unsplash / S3 + resize в проде):
    // свой loader формирует responsive-варианты без нагрузки на сервер Next.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
