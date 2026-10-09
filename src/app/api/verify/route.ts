import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { kycProvider, isDemoMode } from "@/lib/qila/kyc-provider";
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
    const body = (await req.json()) as { method: string; targetTier: number; transferId?: string };
    const method = body.method;
    const validMethods = Object.keys(METHOD_LABELS);
    if (!validMethods.includes(method)) return fail("Unknown verification method");
    const result = await kycProvider.submit({
      userId: user.id,
      method: method as never,
      targetTier: body.targetTier ?? user.currentTier + 1,
      payload: { transferId: body.transferId },
    });
    return ok(jsonSafe(result));
  } catch (e) {
    return handleError(e);
  }
}
