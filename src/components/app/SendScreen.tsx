"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import { SendView, type SendPrefill } from "@/components/qila/Send";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";
import { ROUTES } from "@/lib/site";

/**
 * /send. Scenario prefills arrive via query string (set by the Demo
 * screen), so sends are linkable and need no global client store.
 */
export function SendScreen() {
  const { session, refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [prefill, setPrefill] = useState<SendPrefill | null>(() => {
    const fromCcy = params.get("fromCcy");
    const toCcy = params.get("toCcy");
    const amount = params.get("amount");
    const recipientName = params.get("recipientName");
    const scenarioLabel = params.get("scenarioLabel");
    if (!fromCcy && !toCcy && !amount && !recipientName && !scenarioLabel) return null;
    return {
      ...(fromCcy ? { fromCcy } : {}),
      ...(toCcy ? { toCcy } : {}),
      ...(amount ? { amount } : {}),
      ...(recipientName ? { recipientName } : {}),
      ...(scenarioLabel ? { scenarioLabel } : {}),
    };
  });

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to send money." />;

  return (
    <SendView
      session={session}
      prefill={prefill}
      clearPrefill={() => setPrefill(null)}
      refresh={async () => {
        await refresh();
      }}
      onGoTransfers={() => router.push(ROUTES.transactions)}
    />
  );
}
