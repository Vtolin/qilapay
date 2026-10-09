import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/site";
import { Card } from "@/components/brand/Card";
import { LoginForm } from "@/components/auth/LoginForm";
import { PersonaBox } from "@/components/auth/PersonaBox";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to QilaPay to see live rates and track transfers.",
};

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; demo?: string }>;
};

/**
 * Auth entry. `?mode=signup` toggles copy so Header "Get started" and
 * "Log in" share one route. `?demo=unavailable` (set by the Try demo
 * button when persona login 403s) shows why demo sign-in is off.
 * The navbar stays visible (root layout).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const isSignup = params.mode === "signup";
  const demoUnavailable = params.demo === "unavailable";

  return (
    <section className="py-12" aria-labelledby="login-title">
      <div className="qila-container max-w-[460px]">
        <Card className="p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h1
              id="login-title"
              className="text-2xl font-extrabold tracking-tight"
            >
              {isSignup ? "Create account" : "Welcome back"}
            </h1>
            <Link
              href={ROUTES.home}
              className="text-sm font-semibold text-muted hover:text-ink"
            >
              ← Back
            </Link>
          </div>

          <PersonaBox demoUnavailable={demoUnavailable} />

          <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" />
            or sign in with your account
            <span className="h-px flex-1 bg-line" />
          </div>

          <LoginForm mode={isSignup ? "signup" : "login"} />

          <p className="mt-4 text-center text-sm text-muted">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link
                  href={ROUTES.login}
                  className="font-bold text-primary-dark"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                New to QilaPay?{" "}
                <Link
                  href={ROUTES.signup}
                  className="font-bold text-primary-dark"
                >
                  Get started
                </Link>
              </>
            )}
          </p>
        </Card>
      </div>
    </section>
  );
}
