import type { Metadata } from "next";
import { TransactionsScreen } from "@/components/app/TransactionsScreen";

export const metadata: Metadata = {
  title: "Transfer detail",
  description: "Transfer receipt with timeline and explorer links.",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransactionsScreen openId={id} />;
}
