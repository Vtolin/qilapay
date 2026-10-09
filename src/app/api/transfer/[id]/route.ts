import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { runExecution } from "@/lib/qila/transfer-engine";
import { getFxSnapshot, toUsd } from "@/lib/qila/fx";
import { evaluateTransfer, REASON_LABELS } from "@/lib/qila/risk";

/** GET: transfer detail with timeline events and risk decision. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const transfer = await db.transfer.findUnique({
      where: { id },
      include: {
        quote: true,
        recipient: true,
        events: { orderBy: { createdAt: "asc" } },
        riskDecisions: true,
      },
    });
    if (!transfer) return fail("Transfer not found", 404);
    if (transfer.userId !== user.id && user.role?.role !== "admin") {
      return fail("You cannot view this transfer", 403);
    }
    return ok(jsonSafe({ transfer }));
  } catch (e) {
    return handleError(e);
  }
}

/** POST: execute a transfer that has passed compliance (or after step-up/review). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const transfer = await db.transfer.findUnique({
      where: { id },
      include: { quote: true, recipient: true },
    });
    if (!transfer) return fail("Transfer not found", 404);
    if (transfer.userId !== user.id) return fail("Not your transfer", 403);

    const allowed =
      transfer.status === "compliance_check" || transfer.status === "awaiting_verification";
    if (!allowed) {
      return fail(`Status ${transfer.status} cannot be executed`, 409);
    }
    if (transfer.quote.expiresAt.getTime() < Date.now()) {
      return fail("Quote expired. Back to the quote step", 410);
    }

    // Audit C1: never trust the stored status — re-run the decision engine
    // against the user's CURRENT tier. Awaiting-verification transfers that
    // still require step-up / review / block cannot be executed directly.
    const rates = await getFxSnapshot();
    const amountUsd = toUsd(
      Number(BigInt(transfer.quote.amountIn)) / 1e6,
      transfer.quote.fromCcy,
      rates,
    );
    if (user.currentTier === null || user.currentTier === undefined) {
      return fail("User has no tier", 400);
    }
    const decision = await evaluateTransfer({
      userId: user.id,
      userTier: user.currentTier,
      amountUsd,
      recipientName: transfer.recipient.name,
      recipientCountry: transfer.recipient.country,
      recipientCreatedAt: transfer.recipient.createdAt,
      rates,
    });
    await db.riskDecision.create({
      data: {
        transferId: transfer.id,
        userId: user.id,
        outcome: `EXEC_${decision.outcome}`,
        reasonCodes: JSON.stringify(decision.reasonCodes),
        inputSnapshot: JSON.stringify({ ...decision.snapshot, recheck: true }),
      },
    });
    if (decision.outcome !== "ALLOW") {
      const labels = decision.reasonCodes.map((c) => REASON_LABELS[c]).join(" ");
      return fail(
        `Transfer has not passed compliance (${decision.outcome}). ${labels}`,
        403,
        { outcome: decision.outcome, reasonCodes: decision.reasonCodes },
      );
    }

    const result = await runExecution(id);
    return ok(jsonSafe({ result }));
  } catch (e) {
    return handleError(e);
  }
}
