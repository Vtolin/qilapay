"use client";

import Link from "next/link";
import { Card } from "@/components/brand/Card";
import { Button } from "@/components/brand/Button";
import { ROUTES } from "@/lib/site";

/** Loading state for app screens while the session resolves. */
export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

/** Signed-out guard card. Mirrors the original frontend screen guards. */
export function SignedOutCard({
  title = "Sign in first",
  body = "Please sign in to continue.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-[480px] py-10">
      <Card>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted">{body}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={ROUTES.login} size="lg">
            Go to login
          </Button>
          <Button href={ROUTES.home} variant="secondary" size="lg">
            Back to home
          </Button>
        </div>
      </Card>
    </div>
  );
}
