import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { checkRateLimit } from "@/lib/qila/rate-limit";
import { kycProvider, isDemoMode } from "@/lib/qila/kyc-provider";
import { validateTargetTier } from "@/lib/qila/validation";
import { METHOD_LABELS } from "@/lib/qila/risk";

/** GET: verifications for the current user. */
export async function GET() {
  try {
    const user = await requireUser();
    const verifications = await db.kycVerification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok(jsonSafe({ verifications, demoMode: isDemoMode() }));
  } catch (e) {
    return handleError(e);
  }
}

/** POST: submit a verification via the (mock) provider. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    // Unbounded verification rows otherwise (one row per POST, no throttle).
    if (
      !checkRateLimit(`verify:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }).allowed ||
      !checkRateLimit("verify:global", { limit: 300, windowMs: 60 * 60 * 1000 }).allowed
    ) {
      return fail("Too many verification requests. Try again later", 429);
    }
    const body = (await req.json()) as { method: string; targetTier: number; transferId?: string };
    const method = body.method;
    const validMethods = Object.keys(METHOD_LABELS);
    if (!validMethods.includes(method)) return fail("Unknown verification method");
    // Fix F16: targetTier was unvalidated — arbitrary integers (e.g. 999)
    // persisted and flowed into tier upgrades on approval.
    let targetTier: number;
    try {
      targetTier = body.targetTier === undefined ? user.currentTier + 1 : validateTargetTier(body.targetTier);
    } catch {
      return fail("targetTier must be an integer 0..3");
    }
    const result = await kycProvider.submit({
      userId: user.id,
      method: method as never,
      targetTier,
      payload: { transferId: body.transferId },
    });
    return ok(jsonSafe(result));
  } catch (e) {
    return handleError(e);
  }
}
