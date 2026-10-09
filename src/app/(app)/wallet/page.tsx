import type { Metadata } from "next";
import { WalletScreen } from "@/components/app/WalletScreen";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Testnet wallet address, live balances, and top up.",
};

export default function WalletPage() {
  return <WalletScreen />;
}
