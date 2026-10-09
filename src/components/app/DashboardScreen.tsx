"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import { DashboardView } from "@/components/qila/Dashboard";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";
import { ROUTES } from "@/lib/site";

/** /dashboard. Session-owned wrapper around the dashboard view. */
export function DashboardScreen() {
  const { session, refresh } = useSession();
  const router = useRouter();

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to see your dashboard." />;

  return (
    <DashboardView
      session={session}
      refresh={async () => {
        await refresh();
      }}
      onGoSend={() => router.push(ROUTES.send)}
      onGoVerify={() => router.push(ROUTES.verification)}
      onGoTransfers={() => router.push(ROUTES.transactions)}
    />
  );
}
