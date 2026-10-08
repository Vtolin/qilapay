import { db } from "@/lib/db";
import { decryptSecret } from "./crypto";
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
};

export async function executeTransferOnChain(transferId: string): Promise<ExecutionResult> {
  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: { quote: true, recipient: true, user: { include: { wallet: true } } },
  });
  if (!transfer || !transfer.user.wallet) throw new Error("Transfer or wallet not found");

  const quote = transfer.quote;
  const privateKey = decryptSecret(transfer.user.wallet.encryptedKey) as `0x${string}`;
  const recipientAddress = transfer.recipient.walletAddress as string;
  if (!recipientAddress || !recipientAddress.startsWith("0x")) {
    throw new Error("Penerima tidak memiliki alamat wallet Tempo yang valid");
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

    // cross-currency: try DEX first
    const dex = await tryDexQuote(source.tokenAddress, dest.tokenAddress, amountIn);
    if (dex.available) {
      const userClient = (await import("./tempo")).createTempoClient(privateKey);
      const { getAddress } = await import("viem");
      // swap in the user's wallet, then forward to the recipient
      const swap = await userClient.dex.sellSync({
        tokenIn: getAddress(source.tokenAddress),
        tokenOut: getAddress(dest.tokenAddress),
        amountIn,
        minAmountOut: amountOut,
      });
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
  await db.transfer.update({
    where: { id: transferId },
    data: { status: "submitted", submittedAt: new Date() },
  });
  await addTransferEvent(transferId, "submitted", {});
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
    await db.transfer.update({
      where: { id: transferId },
      data: { status: "failed" },
    });
    await addTransferEvent(transferId, "failed", { error: result.error });
  }
  return result;
}
