import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { runExecution } from "@/lib/qila/transfer-engine";

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
    if (!transfer) return fail("Transfer tidak ditemukan", 404);
    if (transfer.userId !== user.id && user.role?.role !== "admin") {
      return fail("Tidak berhak melihat transfer ini", 403);
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
    const transfer = await db.transfer.findUnique({ where: { id }, include: { quote: true } });
    if (!transfer) return fail("Transfer tidak ditemukan", 404);
    if (transfer.userId !== user.id) return fail("Bukan transfer kamu", 403);

    const allowed =
      transfer.status === "compliance_check" || transfer.status === "awaiting_verification";
    if (!allowed) {
      return fail(`Status ${transfer.status} tidak bisa dieksekusi`, 409);
    }
    if (transfer.quote.expiresAt.getTime() < Date.now()) {
      return fail("Quote kedaluwarsa — kembali ke langkah quote", 410);
    }

    const result = await runExecution(id);
    return ok(jsonSafe({ result }));
  } catch (e) {
    return handleError(e);
  }
}
