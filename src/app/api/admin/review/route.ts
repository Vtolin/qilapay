import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireAdmin } from "@/lib/qila/session";
import { assertTransferTransition } from "@/lib/qila/validation";
import { addTransferEvent, runExecution } from "@/lib/qila/transfer-engine";
import { explorerTx } from "@/lib/qila/tempo";

/**
 * POST: admin review actions.
 *  - verification: approve (tier upgrade incl. tier 3) | reject | needs_more_info
 *  - transfer: approve (execute on-chain) | reject (block)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      type: "verification" | "transfer";
      id: string;
      action: "approve" | "reject" | "needs_more_info";
      note?: string;
    };

    if (body.type === "verification") {
      const v = await db.kycVerification.findUnique({ where: { id: body.id } });
      if (!v) return fail("Verification not found", 404);
      const statusMap = {
        approve: "approved",
        reject: "rejected",
        needs_more_info: "needs_more_info",
      } as const;
      const updated = await db.kycVerification.update({
        where: { id: body.id },
        data: { status: statusMap[body.action], reviewedAt: new Date(), reviewedBy: admin.email },
      });
      if (body.action === "approve") {
        const approved = await db.kycVerification.findMany({
          where: { userId: v.userId, status: "approved" },
        });
        const bestTier = Math.max(...approved.map((x) => x.targetTier), 0);
        const target = await db.user.findUnique({ where: { id: v.userId } });
        if (target && bestTier > target.currentTier) {
          await db.user.update({
            where: { id: v.userId },
            data: { currentTier: bestTier },
          });
        }
      }
      await db.auditLog.create({
        data: {
          actor: admin.email,
          action: `admin.verification.${body.action}`,
          entity: "kyc_verification",
          entityId: body.id,
          meta: JSON.stringify({ note: body.note || null }),
        },
      });
      return ok(jsonSafe({ verification: updated }));
    }

    if (body.type === "transfer") {
      const t = await db.transfer.findUnique({ where: { id: body.id } });
      if (!t) return fail("Transfer tidak ditemukan", 404);
      if (t.status !== "pending_review") {
        return fail(`Transfer is in status ${t.status}, not pending_review`, 409);
      }
      if (body.action === "approve") {
        const result = await runExecution(body.id);
        // Fix F14: log approval only on success; refusals get their own trail
        // (previously every attempt logged admin.transfer.approve, even refused ones).
        await db.auditLog.create({
          data: {
            actor: admin.email,
            action: result.status === "settled" ? "admin.transfer.approve" : "admin.transfer.approve_failed",
            entity: "transfer",
            entityId: body.id,
            meta: JSON.stringify({
              txHash: result.txHash || result.outTxHash || null,
              ...(result.error ? { error: result.error } : {}),
            }),
          },
        });
        return ok(
          jsonSafe({
            transfer: { id: body.id, status: result.status },
            explorerUrl: (result.txHash || result.outTxHash) ? explorerTx((result.txHash || result.outTxHash)!) : null,
          }),
        );
      }
      // reject
      // Fix F5: allowlisted state transition (was implicit).
      assertTransferTransition("pending_review", "blocked");
      await db.transfer.update({ where: { id: body.id }, data: { status: "blocked" } });
      await addTransferEvent(body.id, "blocked", {
        by: admin.email,
        note: body.note || "Ditolak oleh admin",
      });
      await db.auditLog.create({
        data: {
          actor: admin.email,
          action: "admin.transfer.reject",
          entity: "transfer",
          entityId: body.id,
          meta: JSON.stringify({ note: body.note || null }),
        },
      });
      return ok(jsonSafe({ transfer: { id: body.id, status: "blocked" } }));
    }

    return fail("Unknown type");
  } catch (e) {
    return handleError(e);
  }
}
