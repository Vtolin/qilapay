"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, type SessionData } from "@/lib/qila/client";

/**
 * Session state for chrome components (header, footer) and route guards.
 * Source of truth is GET /api/session (httpOnly HMAC cookie, server verified).
 * Returns undefined while loading so callers can avoid flashing the wrong
 * chrome. Returns null when signed out, SessionData when signed in.
 * Revalidates on every route change.
 */
export function useSession() {
  const [session, setSession] = useState<SessionData | null | undefined>(undefined);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await api<SessionData>("/api/session");
      if (res.ok && res.data.authenticated) {
        setSession(res.data);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return { session, refresh };
}
