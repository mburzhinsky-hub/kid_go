import type { Metadata } from "next";
import { CabinetScreen } from "@/components/account/CabinetScreen";

export const metadata: Metadata = { title: "Мой кабинет", robots: { index: false } };

export default function CabinetPage() {
  return <CabinetScreen />;
}
