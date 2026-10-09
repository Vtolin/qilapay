"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import { ROUTES } from "@/lib/site";

/**
 * Client-side route guard for the signed-in group. Redirects signed-out
 * visitors to /login. Server APIs enforce auth independently, so this is
 * UX only, never a security boundary.
 */
export function AppGuard() {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === null) router.replace(ROUTES.login);
  }, [session, pathname, router]);

  return null;
}
