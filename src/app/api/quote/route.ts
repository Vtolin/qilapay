import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { getFxSnapshot, convert, toUsd } from "@/lib/qila/fx";
import { getConfig, getConfigNumber } from "@/lib/qila/config";
import { SUPPORTED_CCY } from "@/lib/qila/fx";
import { getTokenBalance } from "@/lib/qila/tempo";

/** Create an FX quote (locked 60s). */

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as {
      fromCcy: string;
      toCcy: string;
      amount: number;
    };

    const { fromCcy, toCcy } = body;
    const amount = Number(body.amount);
    if (!SUPPORTED_CCY.includes(fromCcy as never) || !SUPPORTED_CCY.includes(toCcy as never)) {
      return fail("Mata uang tidak didukung");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Nominal harus lebih dari 0");
    }

    // on-chain balance check (amount + fee buffer)
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    const sourceCcy = await db.currency.findUnique({ where: { code: fromCcy } });
    if (wallet && sourceCcy) {
      const bal = await getTokenBalance(sourceCcy.tokenAddress, wallet.address);
      const balNum = Number(bal) / 1e6;
      if (balNum < amount + 1) {
        return fail(
          `Saldo ${fromCcy} tidak cukup (${balNum.toLocaleString("id-ID")} tersedia). Gunakan tombol top up di dashboard.`,
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
      const q = await tryDexQuote(source.tokenAddress, dest.tokenAddress, BigInt(Math.round(amount * 1e6)));
      executionMode = q.available ? "dex" : "treasury";
    } else if (fromCcy === toCcy) {
      executionMode = "direct";
    }

    const quote = await db.quote.create({
      data: {
        userId: user.id,
        fromCcy,
        toCcy,
        amountIn: String(Math.round(amount * 1e6)),
        amountOut: String(Math.round(amountOut * 1e6)),
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
