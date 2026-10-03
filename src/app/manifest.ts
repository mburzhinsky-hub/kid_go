import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "КидГоу — куда пойти с детьми",
    short_name: "КидГоу",
    description: "Выберите настроение — мы соберём ваш день с ребёнком.",
    start_url: `${B}/`, scope: `${B}/`, id: `${B}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    lang: "ru",
    categories: ["lifestyle", "travel", "kids"],
    icons: [
      { src: `${B}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${B}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${B}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Придумать день", url: `${B}/planner/`, icons: [{ src: `${B}/icons/icon-192.png`, sizes: "192x192" }] },
      { name: "Карта", url: `${B}/map/` },
    ],
  };
}
