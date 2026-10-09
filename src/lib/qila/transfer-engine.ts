import { db } from "@/lib/db";
import { decryptSecret } from "./crypto";
import {
  buildPartialFailureDetail,
  isQuoteAmountCovered,
  isValidWalletAddress,
} from "./validation";
import {
  encodeMemo,
  getTreasuryAccount,
  getTreasuryClient,
  getTokenBalance,
  micro,
  transferWithMemo,
  tryDexQuote,
} from "./tempo";

/**
 * Transfer execution (spec section 6, step 4-5).
 *
 * Same currency:  single TIP-20 transfer user -> recipient (with memo).
 * Cross currency: try Tempo Stablecoin DEX first (spec 4.2 primary mode);
 *                 on PairDoesNotExist / InsufficientLiquidity fall back to
 *                 the treasury swap at the quoted rate (spec 4.2 fallback).
 *                 Every leg is a real on-chain transaction; each hash is
 *                 recorded in transfer_events.
 */

export type ExecutionResult = {
  status: "settled" | "failed";
  executionMode: "dex" | "treasury" | "direct";
  submitTxHash?: string;
  swapTxHash?: string;
  outTxHash?: string;
  txHash?: string;
  settledAt?: Date;
  settlementSeconds?: number;
  error?: string;
  /** Audit H3: set when a later leg failed after an earlier leg landed. */
  partial?: boolean;
  refundRequired?: boolean;
};

export async function executeTransferOnChain(transferId: string): Promise<ExecutionResult> {
  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: { quote: true, recipient: true, user: { include: { wallet: true } } },
  });
  if (!transfer || !transfer.user.wallet) throw new Error("Transfer or wallet not found");

  const quote = transfer.quote;
  const privateKey = decryptSecret(transfer.user.wallet.encryptedKey) as `0x${string}`;
  // Audit M2: strict format check (creation already validates; this is the
  // last line of defense before moving funds).
  const recipientAddress = transfer.recipient.walletAddress;
  if (!isValidWalletAddress(recipientAddress)) {
    throw new Error("Recipient has no valid Tempo wallet address");
  }

  const source = await db.currency.findUnique({ where: { code: quote.fromCcy } });
  const dest = await db.currency.findUnique({ where: { code: quote.toCcy } });
  if (!source || !dest) throw new Error("Currency not configured");

  const amountIn = BigInt(quote.amountIn);
  const amountOut = BigInt(quote.amountOut);
  const memo = encodeMemo(transfer.id);

  const startedAt = new Date();

  try {
    // same-currency: one atomic transfer
    if (quote.fromCcy === quote.toCcy) {
      const receipt = await transferWithMemo({
        privateKey,
        tokenAddress: source.tokenAddress,
        to: recipientAddress,
        amount: amountIn,
        memo,
      });
      return finish("direct", {
        txHash: receipt.transactionHash,
        submitTxHash: receipt.transactionHash,
      });
    }

    // cross-currency: try DEX first, but only when the LIVE quote covers the
    // stale off-chain quote (audit L1). Otherwise fall through to treasury —
    // forwarding quote.amountOut after an adverse move would under-collateralize.
    const dex = await tryDexQuote(source.tokenAddress, dest.tokenAddress, amountIn);
    if (dex.available && isQuoteAmountCovered(dex.amountOut, amountOut)) {
      const userClient = (await import("./tempo")).createTempoClient(privateKey);
      const { getAddress } = await import("viem");
      // swap in the user's wallet, then forward to the recipient
      const swap = await userClient.dex.sellSync({
        tokenIn: getAddress(source.tokenAddress),
        tokenOut: getAddress(dest.tokenAddress),
        amountIn,
        minAmountOut: amountOut,
      });
      try {
        const out = await userClient.token.transferSync({
          token: getAddress(dest.tokenAddress),
          to: getAddress(recipientAddress),
          amount: amountOut,
          memo,
        });
        return finish("dex", {
          swapTxHash: swap.receipt.transactionHash,
          outTxHash: out.receipt.transactionHash,
        });
      } catch (e) {
        // Audit H3: swap landed, forward failed — user holds dest tokens in
        // their own wallet; preserve evidence for the operator.
        const failed: ExecutionResult = {
          status: "failed",
          executionMode: "dex",
          swapTxHash: swap.receipt.transactionHash,
          error: e instanceof Error ? e.message : String(e),
          ...buildPartialFailureDetail({
            stage: "forward",
            swapTxHash: swap.receipt.transactionHash,
            error: e instanceof Error ? e.message : String(e),
          }),
        };
        return failed;
      }
    }

    // treasury fallback (spec 4.2)
    const treasury = getTreasuryAccount();
    // ensure treasury has destination inventory (it is the issuer of q-tokens)
    if (quote.toCcy !== "USD") {
      const inv = await getTokenBalance(dest.tokenAddress, treasury.address);
      if (inv < amountOut) {
        const client = getTreasuryClient();
        await client.token.mintSync({
          token: dest.tokenAddress as `0x${string}`,
          to: treasury.address,
          amount: amountOut - inv + micro(1000),
        });
      }
    }

    const debit = await transferWithMemo({
      privateKey,
      tokenAddress: source.tokenAddress,
      to: treasury.address,
      amount: amountIn,
      memo,
    });

    // Audit H3: debit is final at this point. A credit failure must preserve
    // the debit hash and flag operator refund instead of vanishing.
    try {
      const credit = await transferWithMemo({
        privateKey: (process.env.TREASURY_PRIVATE_KEY || "0x00") as `0x${string}`,
        tokenAddress: dest.tokenAddress,
        to: recipientAddress,
        amount: amountOut,
        memo,
      });

      return finish("treasury", {
        submitTxHash: debit.transactionHash,
        outTxHash: credit.transactionHash,
      });
    } catch (e) {
      const failed: ExecutionResult = {
        status: "failed",
        executionMode: "treasury",
        submitTxHash: debit.transactionHash,
        error: e instanceof Error ? e.message : String(e),
        ...buildPartialFailureDetail({
          stage: "credit",
          debitTxHash: debit.transactionHash,
          error: e instanceof Error ? e.message : String(e),
        }),
      };
      return failed;
    }
  } catch (e) {
    const failed: ExecutionResult = {
      status: "failed",
      executionMode: "direct",
      error: e instanceof Error ? e.message : String(e),
    };
    return failed;
  }

  function finish(mode: "dex" | "treasury" | "direct", hashes: Partial<ExecutionResult>): ExecutionResult {
    const settledAt = new Date();
    return {
      status: "settled",
      executionMode: mode,
      settledAt,
      settlementSeconds: (settledAt.getTime() - startedAt.getTime()) / 1000,
      ...hashes,
    };
  }
}

export async function addTransferEvent(
  transferId: string,
  status: string,
  detail: Record<string, unknown> = {},
) {
  await db.transferEvent.create({
    data: { transferId, status, detail: JSON.stringify(detail) },
  });
}

/** Orchestrate: submitted -> on-chain -> settled | failed, with event log. */
export async function runExecution(transferId: string) {
  // Audit H2: atomic state claim — concurrent/retried executions of the same
  // transfer collapse to exactly one on-chain run.
  const claimed = await db.transfer.updateMany({
    where: {
      id: transferId,
      status: { in: ["compliance_check", "awaiting_verification", "pending_review"] },
    },
    data: { status: "submitted", submittedAt: new Date() },
  });
  if (claimed.count === 0) {
    const cur = await db.transfer.findUnique({ where: { id: transferId } });
    return {
      status: "failed" as const,
      executionMode: "direct" as const,
      error: `Transfer ${cur?.status ?? "?"} cannot be executed`,
    };
  }
  await addTransferEvent(transferId, "submitted", {});

  // Audit M4: pre-flight balance check in micro-units (the quote-time check
  // is stale by execution time). Abort before touching the chain.
  const preflight = await db.transfer.findUnique({
    where: { id: transferId },
    include: { quote: true, user: { include: { wallet: true } } },
  });
  if (preflight?.user.wallet) {
    const source = await db.currency.findUnique({ where: { code: preflight.quote.fromCcy } });
    if (source) {
      const bal = await getTokenBalance(source.tokenAddress, preflight.user.wallet.address);
      if (bal < BigInt(preflight.quote.amountIn)) {
        await db.transfer.update({ where: { id: transferId }, data: { status: "failed" } });
        await addTransferEvent(transferId, "failed", {
          error: "Insufficient balance at execution",
          insufficientBalance: true,
        });
        return {
          status: "failed" as const,
          executionMode: "direct" as const,
          error: "Insufficient balance at execution",
        };
      }
    }
  }

  const result = await executeTransferOnChain(transferId);
  if (result.status === "settled") {
    await db.transfer.update({
      where: { id: transferId },
      data: {
        status: "settled",
        settledAt: result.settledAt || new Date(),
        txHash: result.txHash || result.outTxHash || result.swapTxHash || null,
        submitTxHash: result.submitTxHash || null,
        swapTxHash: result.swapTxHash || null,
        outTxHash: result.outTxHash || null,
        executionMode: result.executionMode,
      },
    });
    await addTransferEvent(transferId, "settled", {
      settlementSeconds: result.settlementSeconds,
      executionMode: result.executionMode,
      txHash: result.txHash || result.outTxHash,
    });
  } else {
    // Audit H3: persist any landed leg + partial/refund flags so a failed
    // debit-then-credit leaves an operator-actionable trail, not a bare "failed".
    await db.transfer.update({
      where: { id: transferId },
      data: {
        status: "failed",
        submitTxHash: result.submitTxHash || null,
        swapTxHash: result.swapTxHash || null,
        outTxHash: result.outTxHash || null,
      },
    });
    await addTransferEvent(transferId, "failed", {
      error: result.error,
      ...(result.partial ? { partial: true } : {}),
      ...(result.refundRequired ? { refundRequired: true } : {}),
      ...(result.submitTxHash ? { debitTxHash: result.submitTxHash } : {}),
      ...(result.swapTxHash ? { swapTxHash: result.swapTxHash } : {}),
    });
  }
  return result;
}
