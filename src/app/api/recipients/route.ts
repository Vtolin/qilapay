import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";

/** GET: recipients of current user. */
export async function GET() {
  try {
    const user = await requireUser();
    const recipients = await db.recipient.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok(jsonSafe({ recipients }));
  } catch (e) {
    return handleError(e);
  }
}

/** POST: add a recipient (QilaPay user via email, or external wallet address). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as {
      name: string;
      country: string;
      walletAddress?: string;
      linkedEmail?: string;
    };
    if (!body.name?.trim()) return fail("Nama penerima wajib diisi");

    let linkedUserId: string | null = null;
    let walletAddress = body.walletAddress?.trim() || null;

    if (body.linkedEmail) {
      const linked = await db.user.findUnique({
        where: { email: body.linkedEmail.trim().toLowerCase() },
        include: { wallet: true },
      });
      if (linked?.wallet) {
        linkedUserId = linked.id;
        walletAddress = linked.wallet.address;
      } else {
        return fail("Email QilaPay tidak ditemukan (cari user terdaftar)");
      }
    }

    if (!walletAddress) {
      // internal recipient: deterministic demo address (name+user derived)
      const crypto = await import("crypto");
      const secret = process.env.WALLET_ENCRYPTION_KEY || "qilapay";
      const hash = crypto
        .createHash("sha256")
        .update(`qilapay-recipient:${user.id}:${body.name}:${secret}`)
        .digest();
      walletAddress = `0x${hash.toString("hex").slice(0, 40)}`;
    }

    const recipient = await db.recipient.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        country: body.country || "ID",
        walletAddress,
        linkedUserId,
      },
    });
    return ok(jsonSafe({ recipient }));
  } catch (e) {
    return handleError(e);
  }
}
