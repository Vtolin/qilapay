import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { setSessionCookie, clearSessionCookie } from "@/lib/qila/session";
import { createWalletCredentials, faucetFund } from "@/lib/qila/tempo";
import { encryptSecret } from "@/lib/qila/crypto";
import { hashPassword, seedPersonas, seedBase } from "@/lib/qila/seed";
import { verifyPasswordSync } from "@/lib/qila/password";
import { checkRateLimit } from "@/lib/qila/rate-limit";

/** Auth: register | login | logout | persona-login (demo) */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: string;
      email?: string;
      password?: string;
      fullName?: string;
      country?: string;
      persona?: string;
    };

    if (body.action === "logout") {
      await clearSessionCookie();
      return ok({ loggedOut: true });
    }

    if (body.action === "persona") {
      // Demo persona login (DEMO_MODE only)
      if ((process.env.DEMO_MODE || "").toLowerCase() !== "true") {
        return fail("Persona login is only available in demo mode", 403);
      }
      await lazySeed();
      const user = await db.user.findUnique({
        where: { email: `${body.persona}@qilapay.demo` },
      });
      if (!user) return fail("Persona not found", 404);
      await setSessionCookie(user.id);
      return ok({ userId: user.id, persona: body.persona });
    }

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    if (!email || !password) return fail("Email and password are required");

    // M5: per-account + global throttling on all credential actions.
    const throttleKey = `auth:${body.action}:${email || "unknown"}`;
    if (!checkRateLimit(throttleKey, { limit: 20, windowMs: 10 * 60 * 1000 }).allowed) {
      return fail("Too many attempts. Try again later", 429);
    }
    if (!checkRateLimit("auth:global", { limit: 200, windowMs: 10 * 60 * 1000 }).allowed) {
      return fail("Too many attempts. Try again later", 429);
    }

    if (body.action === "register") {
      await lazySeed();
      if (password.length < 8) return fail("Password must be at least 8 characters");
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return fail("Email is already registered");
      const user = await db.user.create({
        data: {
          email,
          passwordHash: hashPassword(email, password),
          fullName: body.fullName || email.split("@")[0],
          country: body.country || "ID",
          currentTier: 0,
        },
      });
      await db.userRole.create({ data: { userId: user.id, role: "user" } });
      // custodial wallet, faucet-funded
      const creds = createWalletCredentials();
      await db.wallet.create({
        data: {
          userId: user.id,
          address: creds.address,
          encryptedKey: encryptSecret(creds.privateKey),
        },
      });
      try {
        await faucetFund(creds.address);
      } catch {
        // faucet hiccup; user can top up later
      }
      await setSessionCookie(user.id);
      return ok({ userId: user.id, isNew: true });
    }

    if (body.action === "login") {
      await lazySeed();
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !verifyPasswordSync(email, password, user.passwordHash)) {
        return fail("Email or password is wrong", 401);
      }
      await setSessionCookie(user.id);
      return ok({ userId: user.id });
    }

    return fail("Unknown action");
  } catch (e) {
    return handleError(e);
  }
}

let seeded = false;
async function lazySeed() {
  if (seeded) return;
  const tierCount = await db.kycTierConfig.count();
  if (tierCount === 0) {
    await seedBase();
    await seedPersonas();
  }
  seeded = true;
}
