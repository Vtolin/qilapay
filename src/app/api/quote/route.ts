import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { checkRateLimit } from "@/lib/qila/rate-limit";
import { getFxSnapshot, convert, toUsd } from "@/lib/qila/fx";
import { getConfig, getConfigNumber } from "@/lib/qila/config";
import { amountToMicro, microToMajor } from "@/lib/qila/validation";
import { SUPPORTED_CCY } from "@/lib/qila/fx";
import { getTokenBalance } from "@/lib/qila/tempo";

/** Create an FX quote (locked 60s). */

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    // Each quote fans out to chain reads + a DEX quote; throttle per user + global.
    if (
      !checkRateLimit(`quote:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }).allowed ||
      !checkRateLimit("quote:global", { limit: 300, windowMs: 60 * 60 * 1000 }).allowed
    ) {
      return fail("Too many quotes. Try again later", 429);
    }
    const body = (await req.json()) as {
      fromCcy: string;
      toCcy: string;
      amount: number;
    };

    const { fromCcy, toCcy } = body;
    const amount = Number(body.amount);
    if (!SUPPORTED_CCY.includes(fromCcy as never) || !SUPPORTED_CCY.includes(toCcy as never)) {
      return fail("Currency not supported");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Amount must be above 0");
    }

    // Audit M4: strict amount parsing (bigint micro-units, no float drift).
    let amountInMicro: bigint;
    try {
      amountInMicro = amountToMicro(body.amount);
    } catch {
      return fail("Invalid amount");
    }

    // on-chain balance check in micro-units (exact; fee comes out of amountOut)
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    const sourceCcy = await db.currency.findUnique({ where: { code: fromCcy } });
    if (wallet && sourceCcy) {
      const bal = await getTokenBalance(sourceCcy.tokenAddress, wallet.address);
      if (bal < amountInMicro) {
        const balNum = microToMajor(bal);
        return fail(
          `Saldo ${fromCcy} is insufficient (${balNum.toLocaleString("id-ID")} available). Use the top up button on the dashboard.`,
          400,
          { insufficientBalance: true },
        );
      }
    }

    const rates = await getFxSnapshot();
    const spreadBps = await getConfigNumber("fx_spread_bps") || 75;
    const feeBps = await getConfigNumber("fee_bps") || 50;
    const lockSeconds = await getConfigNumber("quote_lock_seconds") || 60;

    // mid-market rate from -> to (via USD)
    const midRate = convert(1, fromCcy, toCcy, rates);
    // customer sells source at a discount (spread)
    const customerRate = midRate * (1 - spreadBps / 10000);
    const amountOutRaw = amount * customerRate;

    // fee expressed in USD
    const usdEquivalent = toUsd(amount, fromCcy, rates);
    const feeUsd = (usdEquivalent * feeBps) / 10000;

    // amountOut reflects the fee: customer sends amount, receives amount - fee converted
    const amountAfterFee = amount * (1 - feeBps / 10000);
    const amountOut = amountAfterFee * customerRate;

    // execution mode: pre-check DEX availability (informational; re-checked at execution)
    const source = await db.currency.findUnique({ where: { code: fromCcy } });
    const dest = await db.currency.findUnique({ where: { code: toCcy } });
    let executionMode = "pending";
    if (source && dest && fromCcy !== toCcy) {
      const { tryDexQuote } = await import("@/lib/qila/tempo");
      const q = await tryDexQuote(source.tokenAddress, dest.tokenAddress, amountInMicro);
      executionMode = q.available ? "dex" : "treasury";
    } else if (fromCcy === toCcy) {
      executionMode = "direct";
    }

    const quote = await db.quote.create({
      data: {
        userId: user.id,
        fromCcy,
        toCcy,
        amountIn: String(amountInMicro),
        amountOut: String(amountToMicro(amountOut.toFixed(6))),
        rate: customerRate,
        spreadBps,
        feeUsd,
        usdEquivalent,
        executionMode,
        expiresAt: new Date(Date.now() + lockSeconds * 1000),
      },
    });

    return ok(
      jsonSafe({
        quote: {
          ...quote,
          midRate,
          feeBps,
          expiresInSeconds: lockSeconds,
        },
      }),
    );
  } catch (e) {
    return handleError(e);
  }
}
