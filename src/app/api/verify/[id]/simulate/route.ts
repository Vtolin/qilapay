import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { isDemoMode } from "@/lib/qila/kyc-provider";

/**
 * POST: simulate the provider outcome (approve | reject | needs_more_info).
 * Only available when DEMO_MODE=true — mirrors the real provider webhook.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!isDemoMode()) return fail("Simulasi hanya tersedia di DEMO_MODE", 403);
    const { id } = await params;
    const body = (await req.json()) as { result: "approve" | "reject" | "needs_more_info" };

    const verification = await db.kycVerification.findUnique({ where: { id } });
    if (!verification) return fail("Verifikasi tidak ditemukan", 404);
    if (verification.userId !== user.id && user.role?.role !== "admin") {
      return fail("Bukan verifikasi kamu", 403);
    }

    const statusMap = {
      approve: "approved",
      reject: "rejected",
      needs_more_info: "needs_more_info",
    } as const;
    const newStatus = statusMap[body.result];
    if (!newStatus) return fail("Result tidak dikenal");

    const updated = await db.kycVerification.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: user.role?.role === "admin" ? user.email : "simulated",
      },
    });

    // tier upgrade on approval (highest targetTier among approved verifications)
    if (newStatus === "approved") {
      const approved = await db.kycVerification.findMany({
        where: { userId: verification.userId, status: "approved" },
      });
      const bestTier = Math.max(...approved.map((v) => v.targetTier), 0);
      const current = await db.user.findUnique({ where: { id: verification.userId } });
      if (current && bestTier > current.currentTier) {
        // Tier 3 requires manual admin review, not just simulation
        const targetTierData = bestTier === 3 ? current.currentTier : bestTier;
        await db.user.update({
          where: { id: verification.userId },
          data: { currentTier: Math.max(targetTierData, current.currentTier) },
        });
      }
    }

    await db.auditLog.create({
      data: {
        actor: user.email,
        action: `kyc.simulate.${body.result}`,
        entity: "kyc_verification",
        entityId: id,
        meta: JSON.stringify({ newStatus }),
      },
    });

    return ok(jsonSafe({ verification: updated }));
  } catch (e) {
    return handleError(e);
  }
}
