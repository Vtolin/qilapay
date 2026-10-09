"use client";

import { useSession } from "@/lib/auth/useSession";
import { VerifyView } from "@/components/qila/Verify";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";

/** /verification. Tier ladder plus simulated provider methods. */
export function VerificationScreen() {
  const { session, refresh } = useSession();

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to verify your identity." />;

  return (
    <VerifyView
      session={session}
      refresh={async () => {
        await refresh();
      }}
    />
  );
}
