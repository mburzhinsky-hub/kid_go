import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
