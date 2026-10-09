import type { Metadata } from "next";
import { VerificationScreen } from "@/components/app/VerificationScreen";

export const metadata: Metadata = {
  title: "Verification",
  description: "Move up tiers with adaptive verification paths.",
};

export default function VerificationPage() {
  return <VerificationScreen />;
}
