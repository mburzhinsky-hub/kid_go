import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "КидГоу — куда пойти с детьми",
    short_name: "КидГоу",
    description: "Выберите настроение — мы соберём ваш день с ребёнком.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    lang: "ru",
    categories: ["lifestyle", "travel", "kids"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Придумать день", url: "/planner", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Карта", url: "/map" },
    ],
  };
}
