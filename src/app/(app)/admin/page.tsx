import type { Metadata } from "next";
import { AdminScreen } from "@/components/app/AdminScreen";

export const metadata: Metadata = {
  title: "Admin",
  description: "Compliance console: review queues, transfer monitor, risk decisions, config.",
};

export default function AdminPage() {
  return <AdminScreen />;
}
