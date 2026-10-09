"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/brand/Button";
import { api, type SessionData } from "@/lib/qila/client";
import { ROUTES } from "@/lib/site";

const PERSONAS = ["sari", "budi", "dewi", "admin"] as const;

/**
 * Demo sign-in path, kept visually separate from the password form.
 * One click persona sign-in. Works only when the server runs in demo
 * mode (DEMO_MODE=true); otherwise the API returns 403, shown as-is.
 */
export function PersonaBox({ demoUnavailable = false }: { demoUnavailable?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loginPersona(persona: string) {
    setBusy(persona);
    setError(null);
    const res = await api("/api/auth", { body: { action: "persona", persona } });
    if (!res.ok) {
      setError(res.status ? `${res.status}: ${res.error}` : res.error);
      setBusy(null);
      return;
    }
    const session = await api<SessionData>("/api/session");
    setBusy(null);
    if (session.ok && session.data.authenticated) {
      router.push(session.data.user?.role === "admin" ? ROUTES.admin : ROUTES.dashboard);
    } else {
      setError("Sign in failed. Please try again.");
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-dashed border-line bg-background px-3 py-3 text-sm">
      <p className="font-bold">Try the demo</p>
      <p className="mt-0.5 text-muted">
        One-click sign in as a demo persona, no password needed. Needs the server in demo mode.
      </p>
      {demoUnavailable ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800"
        >
          Demo sign-in unavailable (403).
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {PERSONAS.map((p) => (
          <Button
            key={p}
            variant="secondary"
            size="sm"
            onClick={() => loginPersona(p)}
            disabled={busy !== null}
          >
            {busy === p ? "Signing in..." : `Sign in as ${p}`}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
