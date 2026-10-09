import type { Metadata } from "next";
import { RecipientsScreen } from "@/components/app/RecipientsScreen";

export const metadata: Metadata = {
  title: "Recipients",
  description: "Saved QilaPay users and external Tempo wallets.",
};

export default function RecipientsPage() {
  return <RecipientsScreen />;
}
