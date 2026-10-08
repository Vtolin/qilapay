import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Cookie-based session (stands in for Supabase Auth in this demo).
 * Cookie value: <userId>.<hmac(userId)>
 */

export const SESSION_COOKIE = "qila_session";

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET || "qilapay-dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
}

export function makeSessionToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (sign(userId) !== sig) return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
