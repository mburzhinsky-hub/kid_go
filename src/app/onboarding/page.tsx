import type { Metadata } from "next";
import { Onboarding } from "@/components/profile/Onboarding";

export const metadata: Metadata = { title: "Добро пожаловать", robots: { index: false } };

export default function OnboardingPage() {
  return <Onboarding />;
}
