"use client";

import { useSession } from "@/lib/auth/useSession";
import { RecipientsView } from "@/components/qila/Recipients";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";

/** /recipients. QilaPay users by email plus external Tempo wallets. */
export function RecipientsScreen() {
  const { session } = useSession();

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to manage recipients." />;

  return <RecipientsView />;
}
