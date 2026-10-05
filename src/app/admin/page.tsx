import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repo } from "@/lib/data/repository";
import { AdminScreen } from "@/components/admin/AdminScreen";

export const metadata: Metadata = { title: "Кабинет контента", robots: { index: false, follow: false } };

export default async function AdminPage() {
  // Internal-only route. Public/static production builds must return 404 unless explicitly enabled.
  if (process.env.ENABLE_CONTENT_ADMIN !== "true") notFound();
  const [places, adventures, events] = await Promise.all([repo.listPlaces(), repo.listAdventures(), repo.listEvents()]);
  return <AdminScreen places={places} adventures={adventures} events={events} />;
}
