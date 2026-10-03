import type { Metadata } from "next";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = { title: "Профиль семьи", robots: { index: false } };

export default function ProfilePage() {
  return <ProfileScreen />;
}
