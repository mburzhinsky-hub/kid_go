import type { Metadata } from "next";
import { SharedCollectionPage } from "@/components/social/SharedCollectionPage";

/** Подборка из ссылки (/c/?d=…) или с этого устройства (/c/?id=…). Не индексируется: у каждой ссылки свой снимок. */
export const metadata: Metadata = {
  title: "Подборка мест для детей",
  description: "Подборка мест для детей от родителей — откройте и добавьте понравившиеся в «Хочу сюда».",
  robots: { index: false, follow: false },
};

export default function SharedPage() {
  return <SharedCollectionPage />;
}
