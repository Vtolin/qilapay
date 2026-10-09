import crypto from "crypto";

/**
 * Pure session-token core (no next/headers, no db) — unit-testable.
 * Cookie value: v1.<userId>.<issuedAt>.<hmac(userId.issuedAt)>
 */

export const SESSION_COOKIE = "qila_session";
// Fix F6: 24h TTL (was 7d) — bounds a stolen cookie's lifetime.
export const SESSION_TTL_MS = 60 * 60 * 24 * 1000;
export const TOKEN_VERSION = "v1";

/**
 * Fail closed when SESSION_SECRET is missing in production.
 * Development keeps a warned fallback so local demos boot without secrets.
 */
export function getSecret(): Buffer {
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
  // Current format: v1.<userId>.<issuedAt>.<sig> (24h expiry).
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === TOKEN_VERSION) {
    const [, userId, issuedAt, sig] = parts;
    if (!/^\d+$/.test(issuedAt)) return null;
    if (Date.now() - Number(issuedAt) > SESSION_TTL_MS) return null;
    if (!safeEqual(sign(userId, issuedAt), sig)) return null;
    return userId;
  }
  // Fix F6: legacy <userId>.<sig> format REMOVED — it carried no timestamp
  // and therefore never expired. Any other shape is rejected.
  return null;
}
