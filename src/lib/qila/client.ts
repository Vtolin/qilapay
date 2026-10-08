"use client";

/** Tiny API client. All responses follow { ok, data } | { ok: false, error }. */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export async function api<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: options?.method || (options?.body ? "POST" : "GET"),
      headers: options?.body ? { "Content-Type": "application/json" } : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// ------------------------------------------------------------ shared types

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  country: string;
  currentTier: number;
  personaKey: string | null;
  role: string;
  walletAddress?: string;
};

export type TierConfig = {
  tier: number;
  name: string;
  perTxLimitUsd: number;
  rolling30dLimitUsd: number;
  requiredMethods: string;
  description: string;
};

export type Balance = { code: string; name: string; tokenAddress: string; amount: number };

export type SessionData = {
  authenticated: boolean;
  user?: SessionUser;
  tier?: TierConfig;
  tiers?: TierConfig[];
  usage30dUsd?: number;
  balances?: Balance[];
  recentTransfers?: TransferRecord[];
  pendingVerifications?: VerificationRecord[];
};

export type QuoteRecord = {
  id: string;
  fromCcy: string;
  toCcy: string;
  amountIn: string;
  amountOut: string;
  rate: number;
  spreadBps: number;
  feeUsd: number;
  usdEquivalent: number;
  expiresAt: string;
  executionMode: string;
  midRate?: number;
};

export type TransferRecord = {
  id: string;
  status: string;
  txHash: string | null;
  submitTxHash: string | null;
  swapTxHash: string | null;
  outTxHash: string | null;
  submittedAt: string | null;
  settledAt: string | null;
  memo: string | null;
  executionMode: string | null;
  createdAt: string;
  quote?: QuoteRecord;
  recipient?: RecipientRecord;
  events?: TransferEventRecord[];
};

export type RecipientRecord = {
  id: string;
  name: string;
  country: string;
  walletAddress: string | null;
  linkedUserId: string | null;
  createdAt: string;
};

export type VerificationRecord = {
  id: string;
  method: string;
  status: string;
  targetTier: number;
  providerRef: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type DecisionPayload = {
  outcome: "ALLOW" | "STEP_UP" | "HOLD_REVIEW" | "BLOCK";
  reasonCodes: string[];
  targetTier: number;
  snapshot: Record<string, unknown>;
  labels: { code: string; label: string; hint: string }[];
};

export type ExecutionPayload = {
  status: string;
  executionMode: string;
  submitTxHash?: string;
  swapTxHash?: string;
  outTxHash?: string;
  txHash?: string;
  settlementSeconds?: number;
  error?: string;
};

export type TransferEventRecord = {
  id: string;
  status: string;
  detail: string;
  createdAt: string;
};
