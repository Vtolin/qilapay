import type { Metadata } from "next";
import { DashboardScreen } from "@/components/app/DashboardScreen";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live onchain balances, tier limits, and recent transfers.",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
