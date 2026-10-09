"use client";

import { useSession } from "@/lib/auth/useSession";
import { AdminView } from "@/components/qila/Admin";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";

/**
 * /admin. Console is admin-gated twice: this UX guard plus server-side
 * requireAdmin on every /api/admin route.
 */
export function AdminScreen() {
  const { session } = useSession();

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in as an admin." />;
  if (session.user?.role !== "admin") {
    return <SignedOutCard title="Admins only" body="This console needs an admin account." />;
  }

  return <AdminView />;
}
