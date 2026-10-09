"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import { ROUTES } from "@/lib/site";

/**
 * Mirror of AppGuard for the landing page: signed-in visitors go straight
 * to /dashboard instead of seeing the pre-login page. Rendered on `/`
 * alongside the landing sections; signed-out visitors are unaffected.
 */
export function LandingGuard() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace(ROUTES.dashboard);
  }, [session, router]);

  return null;
}
