import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/site";
import { Card } from "@/components/brand/Card";
import { LoginForm } from "@/components/auth/LoginForm";
import { PersonaBox } from "@/components/auth/PersonaBox";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a QilaPay account to send and track transfers.",
};

/**
 * Register route. Shares LoginForm in signup mode with /login?mode=signup
 * so both URLs work. The navbar stays visible (root layout).
 */
export default function RegisterPage() {
  return (
    <section className="py-12" aria-labelledby="register-title">
      <div className="qila-container max-w-[460px]">
        <Card className="p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h1
              id="register-title"
              className="text-2xl font-extrabold tracking-tight"
            >
              Create account
            </h1>
            <Link
              href={ROUTES.home}
              className="text-sm font-semibold text-muted hover:text-ink"
            >
              ← Back
            </Link>
          </div>

          <PersonaBox />

          <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" />
            or create your account
            <span className="h-px flex-1 bg-line" />
          </div>

          <LoginForm mode="signup" />

          <p className="mt-4 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href={ROUTES.login} className="font-bold text-primary-dark">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </section>
  );
}
