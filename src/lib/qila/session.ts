import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeSessionToken,
  parseSessionToken,
} from "./session-token";

export { SESSION_COOKIE };
export { makeSessionToken, parseSessionToken, SESSION_TTL_MS } from "./session-token";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    secure: (process.env.NODE_ENV || "development") === "production",
    // Fix F10: Strict (was Lax) — cookie-authenticated POSTs have no CSRF
    // tokens; same-origin fetch flows are unaffected.
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: true, wallet: true },
  });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role?.role !== "admin") throw new HttpError(403, "Admin only");
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
