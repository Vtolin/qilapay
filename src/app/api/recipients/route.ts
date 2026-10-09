import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { checkRateLimit } from "@/lib/qila/rate-limit";
import { isValidWalletAddress, requireEnvSecret } from "@/lib/qila/validation";
import { getAddress } from "viem";

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
    // Unbounded recipient rows otherwise (one row per POST, no throttle).
    if (
      !checkRateLimit(`recipients:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }).allowed ||
      !checkRateLimit("recipients:global", { limit: 300, windowMs: 60 * 60 * 1000 }).allowed
    ) {
      return fail("Too many recipients. Try again later", 429);
    }
    const body = (await req.json()) as {
      name: string;
      country: string;
      walletAddress?: string;
      linkedEmail?: string;
    };
    if (!body.name?.trim()) return fail("Recipient name is required");

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
        // Audit M2: generic message — do not oracle registered emails.
        return fail("QilaPay recipient cannot be added (check email or wallet)");
      }
    }

    // Audit M2: user-supplied addresses must be well-formed; normalize checksum.
    if (walletAddress && !linkedUserId) {
      if (!isValidWalletAddress(walletAddress)) {
        return fail("Invalid wallet address (0x plus 40 hex chars)");
      }
      walletAddress = getAddress(walletAddress);
    }

    if (!walletAddress) {
      // internal recipient: deterministic demo address (name+user derived)
      const crypto = await import("crypto");
      // Audit L3: fail closed in production instead of a public default.
      const secret = requireEnvSecret("WALLET_ENCRYPTION_KEY", { fallback: "qilapay" });
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
