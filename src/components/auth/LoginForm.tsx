"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/brand/Button";
import { api, type SessionData } from "@/lib/qila/client";
import { ROUTES } from "@/lib/site";

type LoginFormProps = {
  mode: "login" | "signup";
};

/**
 * Auth form backed by the QilaPay backend (POST /api/auth).
 * Same layout and contract as the original frontend form: email plus
 * password, name on signup. On success it lands on the dashboard
 * (admins land on the console, resolved by role).
 */
export function LoginForm({ mode }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "").trim();

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api("/api/auth", {
        body:
          mode === "signup"
            ? { action: "register", email, password, fullName: name || email.split("@")[0] }
            : { action: "login", email, password },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const session = await api<SessionData>("/api/session");
      if (session.ok && session.data.authenticated) {
        router.push(session.data.user?.role === "admin" ? ROUTES.admin : ROUTES.dashboard);
      } else {
        setError("Sign in failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" aria-label={`${mode} form`}>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      ) : null}

      {mode === "signup" ? (
        <div>
          <label htmlFor="name" className="mb-2 block font-bold">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Maria Santos"
            className="min-h-12 w-full rounded-[14px] border border-line bg-surface px-3.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-2 block font-bold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="min-h-12 w-full rounded-[14px] border border-line bg-surface px-3.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block font-bold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="••••••••"
          className="min-h-12 w-full rounded-[14px] border border-line bg-surface px-3.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : "Log in"}
      </Button>
    </form>
  );
}
