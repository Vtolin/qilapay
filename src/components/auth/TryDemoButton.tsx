"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/brand/Button";
import { api, type SessionData } from "@/lib/qila/client";
import { ROUTES } from "@/lib/site";

/**
 * One click demo entry. Signs in as the Sari persona (requires DEMO_MODE
 * on the server) and lands on the dashboard. On failure it falls back to
 * the login page with ?demo=unavailable, where the page explains that
 * persona sign-in returns 403 by design when demo mode is off.
 */
export function TryDemoButton({
  variant = "secondary",
  size = "lg",
  className = "",
  label = "Try demo",
}: {
  variant?: "primary" | "secondary" | "accent" | "dark" | "ghostLight";
  size?: "md" | "lg" | "sm";
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onTryDemo() {
    setBusy(true);
    try {
      const res = await api("/api/auth", { body: { action: "persona", persona: "sari" } });
      if (!res.ok) {
        router.push(`${ROUTES.login}?demo=unavailable`);
        return;
      }
      const session = await api<SessionData>("/api/session");
      if (session.ok && session.data.authenticated) {
        router.push(ROUTES.dashboard);
      } else {
        router.push(`${ROUTES.login}?demo=unavailable`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={onTryDemo} disabled={busy}>
      {busy ? "Signing in..." : label}
    </Button>
  );
}
