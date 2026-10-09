import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { checkRateLimit } from "@/lib/qila/rate-limit";
import { faucetFund, getTreasuryClient, getTokenBalance, micro } from "@/lib/qila/tempo";

/**
 * POST: "Top up test funds" — USD via faucet, q<CCY> minted from treasury
 * (treasury is the issuer of the QilaPay test tokens).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { currency?: string };
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) return fail("Wallet not found", 404);

    const code = body.currency || "USD";

    // Audit H5: bounded test-money. Treasury mints + faucet relays are
    // captcha-free on-chain writes; cap per user/currency/day + global.
    if (
      !checkRateLimit(`fund:${user.id}:${code}`, { limit: 5, windowMs: 24 * 60 * 60 * 1000 })
        .allowed ||
      !checkRateLimit("fund:global", { limit: 200, windowMs: 60 * 60 * 1000 }).allowed
    ) {
      return fail("Top up limit reached. Try again tomorrow", 429);
    }

    if (code === "USD") {
      const hashes = await faucetFund(wallet.address);
      return ok(jsonSafe({ currency: "USD", method: "faucet", hashes }));
    }

    const cur = await db.currency.findUnique({ where: { code } });
    // Fix F13: honor the isActive flag (was ignored — disabled currencies stayed fundable).
    if (!cur || !cur.isActive) return fail("Unknown currency", 404);

    const client = getTreasuryClient();
    const amounts: Record<string, string> = {
      IDR: "10000000", // Rp10.000.000
      SGD: "5000",
      EUR: "5000",
      GBP: "5000",
    };
    const minted = await client.token.mintSync({
      token: cur.tokenAddress as `0x${string}`,
      to: wallet.address as `0x${string}`,
      amount: micro(amounts[code] || "5000"),
    });
    return ok(
      jsonSafe({
        currency: code,
        method: "treasury_mint",
        hash: minted.receipt.transactionHash,
      }),
    );
  } catch (e) {
    return handleError(e);
  }
}

/** GET: current balances (lightweight). */
export async function GET() {
  try {
    const user = await requireUser();
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) return ok(jsonSafe({ balances: [] }));
    const currencies = await db.currency.findMany({ where: { isActive: true } });
    const balances: { code: string; amount: number; tokenAddress: string }[] = [];
    for (const c of currencies) {
      try {
        const raw = await getTokenBalance(c.tokenAddress, wallet.address);
        balances.push({ code: c.code, amount: Number(raw) / 1e6, tokenAddress: c.tokenAddress });
      } catch {
        balances.push({ code: c.code, amount: 0, tokenAddress: c.tokenAddress });
      }
    }
    return ok(jsonSafe({ balances }));
  } catch (e) {
    return handleError(e);
  }
}
