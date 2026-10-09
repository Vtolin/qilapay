import crypto from "crypto";

/**
 * Password hashing (fixes audit C3).
 *
 * Format: `scrypt$v1$<saltHex>$<hashHex>` (scrypt N=16384, r=8, p=1, 32-byte key,
 * per-user random 16-byte salt, app pepper folded into the input).
 * Legacy `sha256(email:password:qilapay)` hashes still verify (migration grace)
 * but are never produced anymore. All comparisons are constant-time.
 */

const CURRENT_VERSION = "scrypt$v1";
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/;

function pepper(): string {
  return process.env.PASSWORD_PEPPER || "qilapay";
}

function scryptInput(email: string, password: string): Buffer {
  return Buffer.from(`${email.toLowerCase()}:${password}:${pepper()}`, "utf8");
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Hash a password for storage. Always produces the current scrypt format. */
export function hashPasswordSync(email: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(scryptInput(email, password), salt, 32);
  return `${CURRENT_VERSION}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** True when `stored` already uses the current format (no re-hash needed). */
export function isModernHash(stored: string): boolean {
  return stored.startsWith(`${CURRENT_VERSION}$`);
}

/**
 * Verify a password against a stored hash. Accepts current scrypt hashes and
 * legacy sha256 hashes. Returns false (never throws) on malformed input.
 */
export function verifyPasswordSync(
  email: string,
  password: string,
  stored: string,
): boolean {
  if (!email || !password || !stored) return false;
  if (isModernHash(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const saltHex = parts[2];
    const expected = parts[3];
    if (!/^[0-9a-f]{64}$/.test(expected) || !/^[0-9a-f]{32}$/.test(saltHex)) {
      return false;
    }
    const salt = Buffer.from(saltHex, "hex");
    const actual = crypto
      .scryptSync(scryptInput(email, password), salt, 32)
      .toString("hex");
    return safeEqualHex(actual, expected);
  }
  if (LEGACY_SHA256_RE.test(stored)) {
    const legacy = crypto
      .createHash("sha256")
      .update(`${email.toLowerCase()}:${password}:qilapay`)
      .digest("hex");
    return safeEqualHex(legacy, stored);
  }
  return false;
}
