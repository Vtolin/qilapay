import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Cookie-based session (stands in for Supabase Auth in this demo).
 * Cookie value: <userId>.<hmac(userId)>
 */

export const SESSION_COOKIE = "qila_session";
export const SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000;
const TOKEN_VERSION = "v1";

/**
 * Audit H1: fail closed when SESSION_SECRET is missing in production.
 * Development keeps a warned fallback so local demos boot without secrets.
 */
function getSecret(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (secret) return Buffer.from(secret, "utf8");
  if ((process.env.NODE_ENV || "development") === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  console.warn("[security] SESSION_SECRET missing — using insecure dev fallback");
  return Buffer.from("qilapay-dev-secret", "utf8");
}

function sign(userId: string, issuedAt: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${userId}.${issuedAt}`)
    .digest("hex")
    .slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function makeSessionToken(userId: string): string {
  const issuedAt = String(Date.now());
  return `${TOKEN_VERSION}.${userId}.${issuedAt}.${sign(userId, issuedAt)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  // Current format: v1.<userId>.<issuedAt>.<sig> (7-day expiry).
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === TOKEN_VERSION) {
    const [, userId, issuedAt, sig] = parts;
    if (!/^\d+$/.test(issuedAt)) return null;
    if (Date.now() - Number(issuedAt) > SESSION_TTL_MS) return null;
    if (!safeEqual(sign(userId, issuedAt), sig)) return null;
    return userId;
  }
  // Legacy format: <userId>.<sig(userId)> — accepted during migration,
  // issued without expiry. Do not mint these anymore.
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const legacy = crypto
    .createHmac("sha256", getSecret())
    .update(userId)
    .digest("hex")
    .slice(0, 32);
  if (!safeEqual(legacy, sig)) return null;
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
    secure: (process.env.NODE_ENV || "development") === "production",
    sameSite: "lax",
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
