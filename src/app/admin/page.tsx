import type { Metadata } from "next";
import { repo } from "@/lib/data/repository";
import { AdminScreen } from "@/components/admin/AdminScreen";

export const metadata: Metadata = { title: "Кабинет контента", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const [places, adventures, events] = await Promise.all([repo.listPlaces(), repo.listAdventures(), repo.listEvents()]);
  return <AdminScreen places={places} adventures={adventures} events={events} />;
}
