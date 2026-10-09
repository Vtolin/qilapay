/**
 * Crash recovery for transfers orphaned in `submitted` (fix F3).
 *
 * runExecution() claims compliance_check|awaiting_verification|pending_review
 * -> submitted, then settles on-chain. A crash between claim and the final
 * update leaves a row no endpoint will touch again. This sweeper marks
 * STALE submitted rows (older than timeoutMs) as failed with an
 * operator-actionable event. It NEVER re-executes: a crash may have
 * happened after the on-chain debit landed, so retrying could double-spend.
 *
 * Takes the Prisma client (or a structural subset) as a parameter so the
 * logic is unit-testable without Next.js module aliases.
 */

type TransferRow = { id: string };

interface ReclaimClient {
  transfer: {
    findMany(args: unknown): Promise<TransferRow[]>;
    update(args: unknown): Promise<unknown>;
  };
  transferEvent: {
    create(args: unknown): Promise<unknown>;
  };
}

export async function reclaimStuckSubmitted(
  client: ReclaimClient,
  opts?: { timeoutMs?: number; now?: number; limit?: number },
): Promise<number> {
  const timeoutMs = opts?.timeoutMs ?? 5 * 60 * 1000;
  const now = opts?.now ?? Date.now();
  const limit = opts?.limit ?? 20;
  const cutoff = new Date(now - timeoutMs);
  const stuck = await client.transfer.findMany({
    where: { status: "submitted", submittedAt: { lt: cutoff } },
    orderBy: { submittedAt: "asc" },
    take: limit,
  });
  for (const t of stuck) {
    await client.transfer.update({
      where: { id: t.id },
      data: { status: "failed" },
    });
    await client.transferEvent.create({
      data: {
        transferId: t.id,
        status: "failed",
        detail: JSON.stringify({
          error: "Recovered from stuck submitted (crash suspected)",
          needsReview: true,
        }),
      },
    });
  }
  return stuck.length;
}
