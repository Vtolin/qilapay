import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { getFxSnapshot, toUsd } from "@/lib/qila/fx";
import { evaluateTransfer, REASON_LABELS, REASON_METHOD_HINT, METHOD_LABELS } from "@/lib/qila/risk";
import { executeTransferOnChain, addTransferEvent, runExecution } from "@/lib/qila/transfer-engine";

/** POST: create transfer + run adaptive-KYC decision engine (spec 6 step 2). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as {
      quoteId: string;
      recipientId: string;
    };

    const quote = await db.quote.findUnique({ where: { id: body.quoteId } });
    if (!quote || quote.userId !== user.id) return fail("Quote not found", 404);
    if (quote.expiresAt.getTime() < Date.now()) {
      return fail("Quote expired. Please create a new quote", 410);
    }
    const recipient = await db.recipient.findUnique({ where: { id: body.recipientId } });
    if (!recipient || recipient.userId !== user.id) return fail("Recipient not found", 404);
    if (user.currentTier === null || user.currentTier === undefined) {
      return fail("User has no tier", 400);
    }

    // Audit H2: a quote funds at most one transfer. Pre-check for a clean
    // error today; the @unique(quoteId) constraint + P2002 handler below
    // close the race once migrated.
    const quoteUsed = await db.transfer.findFirst({ where: { quoteId: quote.id } });
    if (quoteUsed) return fail("Quote already used. Create a new quote", 409);

    // transfer record: quoted -> compliance_check
    let transfer;
    try {
      transfer = await db.transfer.create({
        data: {
          userId: user.id,
          recipientId: recipient.id,
          quoteId: quote.id,
          status: "quoted",
          memo: null,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        return fail("Quote already used. Create a new quote", 409);
      }
      throw e;
    }
    // memo must match what goes on-chain: QILA-<last10 of id uppercase>
    const memoOnChain = `QILA-${transfer.id.replace(/-/g, "").slice(-10).toUpperCase()}`;
    await db.transfer.update({ where: { id: transfer.id }, data: { memo: memoOnChain } });
    transfer.memo = memoOnChain;
    await addTransferEvent(transfer.id, "quoted", { quoteId: quote.id });
    await db.transfer.update({ where: { id: transfer.id }, data: { status: "compliance_check" } });
    await addTransferEvent(transfer.id, "compliance_check", {});

    const rates = await getFxSnapshot();
    const amountUsd = toUsd(Number(BigInt(quote.amountIn)) / 1e6, quote.fromCcy, rates);

    const decision = await evaluateTransfer({
      userId: user.id,
      userTier: user.currentTier,
      amountUsd,
      recipientName: recipient.name,
      recipientCountry: recipient.country,
      recipientCreatedAt: recipient.createdAt,
      rates,
    });

    await db.riskDecision.create({
      data: {
        transferId: transfer.id,
        userId: user.id,
        outcome: decision.outcome,
        reasonCodes: JSON.stringify(decision.reasonCodes),
        inputSnapshot: JSON.stringify(decision.snapshot),
      },
    });

    let status: string;
    if (decision.outcome === "ALLOW") {
      status = "compliance_check"; // proceeds straight to execution below
      await addTransferEvent(transfer.id, "decision", { outcome: "ALLOW" });
    } else if (decision.outcome === "STEP_UP") {
      status = "awaiting_verification";
      await addTransferEvent(transfer.id, "awaiting_verification", {
        reasonCodes: decision.reasonCodes,
        targetTier: decision.targetTier,
      });
    } else if (decision.outcome === "HOLD_REVIEW") {
      status = "pending_review";
      await addTransferEvent(transfer.id, "pending_review", {
        reasonCodes: decision.reasonCodes,
      });
    } else {
      status = "blocked";
      await addTransferEvent(transfer.id, "blocked", {
        reasonCodes: decision.reasonCodes,
      });
    }

    await db.transfer.update({ where: { id: transfer.id }, data: { status } });

    // ALLOW: execute immediately
    if (decision.outcome === "ALLOW") {
      const exec = await runExecution(transfer.id);
      return ok(
        jsonSafe({
          transferId: transfer.id,
          decision: {
            ...decision,
            labels: decision.reasonCodes.map((c) => ({
              code: c,
              label: REASON_LABELS[c],
              hint: REASON_METHOD_HINT[c],
            })),
          },
          methods: [],
          executed: exec,
        }),
      );
    }

    return ok(
      jsonSafe({
        transferId: transfer.id,
        decision: {
          ...decision,
          labels: decision.reasonCodes.map((c) => ({
            code: c,
            label: REASON_LABELS[c],
            hint: REASON_METHOD_HINT[c],
          })),
        },
        methods: decision.methods.map((m) => ({ key: m, label: METHOD_LABELS[m] || m })),
        executed: null,
      }),
    );
  } catch (e) {
    return handleError(e);
  }
}

/** GET: list transfers for the current user. */
export async function GET() {
  try {
    const user = await requireUser();
    const transfers = await db.transfer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { quote: true, recipient: true },
      take: 50,
    });
    return ok(jsonSafe({ transfers }));
  } catch (e) {
    return handleError(e);
  }
}
