import type { Metadata } from "next";
import { Suspense } from "react";
import { SendScreen } from "@/components/app/SendScreen";

export const metadata: Metadata = {
  title: "Send",
  description: "Quote a locked rate, pass adaptive compliance, settle onchain.",
};

/**
 * Scenario prefills arrive via query string, so useSearchParams needs a
 * Suspense boundary for prerendering.
 */
export default function SendPage() {
  return (
    <Suspense>
      <SendScreen />
    </Suspense>
  );
}
