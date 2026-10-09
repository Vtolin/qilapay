"use client";

import { useSession } from "@/lib/auth/useSession";
import { TransfersView } from "@/components/qila/Transfers";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";

/** /transactions and /transactions/[id]. Detail opens by id when given. */
export function TransactionsScreen({ openId }: { openId?: string }) {
  const { session } = useSession();

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to see your transfers." />;

  return <TransfersView openId={openId} />;
}
