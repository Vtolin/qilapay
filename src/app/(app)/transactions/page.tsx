import type { Metadata } from "next";
import { TransactionsScreen } from "@/components/app/TransactionsScreen";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Transfer history with onchain receipts and timelines.",
};

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
