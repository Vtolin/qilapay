import { db } from "@/lib/db";
import { ok, handleError, jsonSafe } from "@/lib/qila/api";
import { requireAdmin } from "@/lib/qila/session";
import { getAllConfig } from "@/lib/qila/config";
import { getFxSnapshot } from "@/lib/qila/fx";

/** GET: admin console data — review queues, transfers, risk decisions, config. */
export async function GET() {
  try {
    await requireAdmin();
    const [pendingVerifications, pendingReviewTransfers, transfers, riskDecisions, tiers, screening, config, rates] =
      await Promise.all([
        db.kycVerification.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          include: { user: true },
        }),
        db.transfer.findMany({
          where: { status: "pending_review" },
          orderBy: { createdAt: "asc" },
          include: { user: true, recipient: true, quote: true },
        }),
        db.transfer.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { user: true, recipient: true, quote: true },
        }),
        db.riskDecision.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { user: true },
        }),
        db.kycTierConfig.findMany({ orderBy: { tier: "asc" } }),
        db.screeningEntry.findMany(),
        getAllConfig(),
        getFxSnapshot(),
      ]);
    return ok(
      jsonSafe({
        pendingVerifications,
        pendingReviewTransfers,
        transfers,
        riskDecisions,
        tiers,
        screening,
        config,
        rates,
      }),
    );
  } catch (e) {
    return handleError(e);
  }
}
