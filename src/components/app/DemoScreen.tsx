"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import { api, type SessionData } from "@/lib/qila/client";
import { DemoView, SCENARIOS } from "@/components/qila/Demo";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";
import { ROUTES } from "@/lib/site";

/**
 * /demo. One click personas plus scripted scenarios. A scenario signs in
 * as its persona, seeds what the story needs (velocity history, screening
 * recipient), then lands on /send with the setup encoded in the query
 * string, so no global client store is required.
 */
export function DemoScreen() {
  const { session, refresh } = useSession();
  const router = useRouter();

  if (session === undefined) return <LoadingScreen />;

  async function loginPersona(persona: string) {
    await api("/api/auth", { body: { action: "persona", persona } });
    await refresh();
    const s = await api<SessionData>("/api/session");
    if (s.ok && s.data.authenticated) {
      router.push(s.data.user?.role === "admin" ? ROUTES.admin : ROUTES.dashboard);
    }
  }

  async function runScenario(scenario: (typeof SCENARIOS)[number]) {
    await api("/api/auth", { body: { action: "persona", persona: scenario.persona } });
    if (scenario.needsSetup === "velocity") {
      await api("/api/demo", { body: { action: "velocity", persona: scenario.persona } });
    }
    if (scenario.prefill.recipientName) {
      const existing = await api<{ recipients: { id: string; name: string }[] }>("/api/recipients");
      if (existing.ok && !existing.data.recipients.some((r) => r.name === scenario.prefill.recipientName)) {
        await api("/api/recipients", {
          body: { name: scenario.prefill.recipientName, country: "AF" },
        });
      }
    }
    await refresh();
    const q = new URLSearchParams();
    if (scenario.prefill.fromCcy) q.set("fromCcy", scenario.prefill.fromCcy);
    if (scenario.prefill.toCcy) q.set("toCcy", scenario.prefill.toCcy);
    if (scenario.prefill.amount) q.set("amount", scenario.prefill.amount);
    if (scenario.prefill.recipientName) q.set("recipientName", scenario.prefill.recipientName);
    if (scenario.prefill.scenarioLabel) q.set("scenarioLabel", scenario.prefill.scenarioLabel);
    const qs = q.toString();
    router.push(qs ? `${ROUTES.send}?${qs}` : ROUTES.send);
  }

  // Demo content is public (tech summary, script). Persona actions work
  // signed out too, since they sign in first.
  return <DemoView onPersona={loginPersona} onScenario={runScenario} />;
}
