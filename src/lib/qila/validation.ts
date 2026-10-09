/**
 * Pure input-validation + money helpers (audit M1/M2/M3/M4/L1 fixes).
 *
 * No server imports, no path aliases, erasable TypeScript only — importable
 * from dependency-free `node:test` suites.
 */

export const KNOWN_METHODS = [
  "selfie_liveness",
  "age_estimation",
  "id_face_match",
  "bank_micro_deposit",
  "proof_of_address",
  "source_of_funds",
  "video_call",
] as const;

export const SCREENING_ACTIONS = ["HOLD_REVIEW", "BLOCK"] as const;

// ------------------------------------------------------------ env secrets

/**
 * Fail-closed secret lookup (audit H1/L3).
 * Production without the variable throws; development falls back with a
 * warning so local demos keep working without silently shipping insecure
 * defaults to prod.
 */
export function requireEnvSecret(
  name: string,
  opts?: { fallback?: string; nodeEnv?: string },
): string {
  const direct = process.env[name];
  if (direct) return direct;
  const env = opts?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (env === "production") {
    throw new Error(`${name} is not set`);
  }
  if (opts?.fallback !== undefined) {
    console.warn(`[security] ${name} missing — using insecure dev fallback`);
    return opts.fallback;
  }
  throw new Error(`${name} is not set`);
}

// ------------------------------------------------------------ money (bigint)

/** Strict decimal (max 6 fraction digits) major-units -> micro-unit bigint. */
export function amountToMicro(amount: number | string): bigint {
  const raw = typeof amount === "number" ? String(amount) : amount.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(raw)) {
    throw new Error(`Invalid amount: ${String(amount)}`);
  }
  const [whole, frac = ""] = raw.split(".");
  const MICRO = BigInt(1000000);
  const value = BigInt(whole) * MICRO + BigInt(frac.padEnd(6, "0") || "0");
  if (value <= BigInt(0)) throw new Error(`Amount must be greater than 0`);
  return value;
}

/** Micro-unit bigint -> float major units (display only, never for authz). */
export function microToMajor(micro: bigint | string): number {
  const v = typeof micro === "string" ? BigInt(micro) : micro;
  const MICRO = BigInt(1000000);
  const neg = v < BigInt(0) ? -1 : 1;
  const abs = v < BigInt(0) ? -v : v;
  return neg * (Number(abs / MICRO) + Number(abs % MICRO) / 1e6);
}

// ------------------------------------------------------------ addresses

export function isValidWalletAddress(addr: unknown): addr is `0x${string}` {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ------------------------------------------------------------ screening

/** Normalize a name for watchlist comparison (audit M3). */
export function normalizeScreeningName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function screeningMatches(entryName: string, inputName: string): boolean {
  return normalizeScreeningName(entryName) === normalizeScreeningName(inputName);
}

// ------------------------------------------------------------ config (M1)

type ConfigValidator = (raw: string) => string;

function intRange(field: string, min: number, max: number): ConfigValidator {
  return (raw: string) => {
    if (!/^-?\d+$/.test(raw.trim())) throw new Error(`${field} must be an integer`);
    const n = Number(raw);
    if (n < min || n > max) throw new Error(`${field} must be between ${min} and ${max}`);
    return String(n);
  };
}

const CONFIG_VALIDATORS: Record<string, ConfigValidator> = {
  fx_spread_bps: intRange("fx_spread_bps", 0, 10000),
  fee_bps: intRange("fee_bps", 0, 10000),
  quote_lock_seconds: intRange("quote_lock_seconds", 5, 3600),
  velocity_window_minutes: intRange("velocity_window_minutes", 1, 1440),
  velocity_max_transfers: intRange("velocity_max_transfers", 1, 1000),
  new_recipient_minutes: intRange("new_recipient_minutes", 0, 14400),
  new_recipient_large_usd: intRange("new_recipient_large_usd", 0, 10000000),
  risk_corridors: (raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("risk_corridors must be valid JSON");
    }
    if (!Array.isArray(parsed)) throw new Error("risk_corridors must be an array");
    for (const c of parsed) {
      if (typeof c !== "string" || !/^[A-Z]{2}$/.test(c)) {
        throw new Error("risk_corridors must be ISO-3166 alpha-2 codes");
      }
    }
    return JSON.stringify(parsed);
  },
};

/** Validate an admin config patch; rejects unknown keys and bad values. */
export function validateConfigPatch(patch: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    const validator = CONFIG_VALIDATORS[key];
    if (!validator) throw new Error(`Unknown config key: ${key}`);
    if (typeof value !== "string") throw new Error(`${key} must be a string`);
    out[key] = validator(value);
  }
  return out;
}

export type TierPatch = {
  tier: number;
  perTxLimitUsd: number;
  rolling30dLimitUsd: number;
  requiredMethods?: string[];
};

/** Validate admin tier updates; rejects negative/inverted/unknown values. */
export function validateTierUpdates(tiers: TierPatch[]): TierPatch[] {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error("tiers must be a non-empty array");
  }
  return tiers.map((t) => {
    if (!Number.isInteger(t.tier) || t.tier < 0 || t.tier > 3) {
      throw new Error(`Invalid tier: ${t.tier}`);
    }
    for (const f of ["perTxLimitUsd", "rolling30dLimitUsd"] as const) {
      const v = t[f];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        throw new Error(`tier ${t.tier}: ${f} must be a positive number`);
      }
    }
    if (t.rolling30dLimitUsd < t.perTxLimitUsd) {
      throw new Error(`tier ${t.tier}: rolling30dLimitUsd must be >= perTxLimitUsd`);
    }
    let requiredMethods: string[] | undefined;
    if (t.requiredMethods !== undefined) {
      if (
        !Array.isArray(t.requiredMethods) ||
        t.requiredMethods.length === 0 ||
        t.requiredMethods.some((m) => !(KNOWN_METHODS as readonly string[]).includes(m))
      ) {
        throw new Error(`tier ${t.tier}: requiredMethods contains unknown methods`);
      }
      requiredMethods = [...t.requiredMethods];
    }
    return {
      tier: t.tier,
      perTxLimitUsd: t.perTxLimitUsd,
      rolling30dLimitUsd: t.rolling30dLimitUsd,
      ...(requiredMethods ? { requiredMethods } : {}),
    };
  });
}

export function validateScreeningAction(action: unknown): "HOLD_REVIEW" | "BLOCK" {
  if (action === "HOLD_REVIEW" || action === "BLOCK") return action;
  throw new Error("screening action must be HOLD_REVIEW or BLOCK");
}

// ------------------------------------------------------------ dex (L1)

/** Slippage floor on a live DEX quote: out * (10000 - bps) / 10000. */
export function computeMinAmountOut(liveDexOut: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
    throw new Error("slippageBps must be an integer 0..10000");
  }
  return (liveDexOut * BigInt(10000 - slippageBps)) / BigInt(10000);
}

/** The stale quote is only usable when the live DEX quote covers it. */
export function isQuoteAmountCovered(liveDexOut: bigint, quoteOut: bigint): boolean {
  return liveDexOut >= quoteOut;
}

/** True when the amount exceeds every tier ceiling (must BLOCK, audit M3). */
export function isOverTopTier(
  amountUsd: number,
  usageUsd: number,
  topTier: { perTxLimitUsd: number; rolling30dLimitUsd: number },
): { overPerTx: boolean; overRolling: boolean } {
  return {
    overPerTx: amountUsd > topTier.perTxLimitUsd,
    overRolling: usageUsd + amountUsd > topTier.rolling30dLimitUsd,
  };
}

// ------------------------------------------------------------ transfers (F5/F16)

export const TRANSFER_STATUSES = [
  "quoted",
  "compliance_check",
  "awaiting_verification",
  "pending_review",
  "submitted",
  "settled",
  "failed",
  "blocked",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/**
 * Allowlisted Transfer status transitions (fix F5: the state machine was
 * previously enforced only by scattered predicates with no single source
 * of truth and no DB CHECK possible on SQLite/Prisma).
 */
const TRANSFER_TRANSITIONS: Record<string, readonly string[]> = {
  quoted: ["compliance_check"],
  compliance_check: ["compliance_check", "awaiting_verification", "pending_review", "blocked", "submitted"],
  awaiting_verification: ["submitted"],
  pending_review: ["submitted", "blocked"],
  submitted: ["settled", "failed"],
  settled: [],
  failed: [],
  blocked: [],
};

export function canTransitionTransferStatus(from: string, to: string): boolean {
  return TRANSFER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Fail-closed transition guard — throws on any unlisted (from -> to). */
export function assertTransferTransition(from: string, to: string): void {
  if (!canTransitionTransferStatus(from, to)) {
    throw new Error(`Illegal transfer status transition: ${from} -> ${to}`);
  }
}

/** Validate user-supplied KYC targetTier (fix F16: was unvalidated). */
export function validateTargetTier(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) {
    throw new Error("targetTier must be an integer 0..3");
  }
  return v;
}

// ------------------------------------------------------------ failures (H3)

export type PartialFailureDetail = {
  partial: true;
  refundRequired: true;
  stage: "credit" | "forward";
  debitTxHash?: string;
  swapTxHash?: string;
  error?: string;
};

export function buildPartialFailureDetail(input: {
  stage: "credit" | "forward";
  debitTxHash?: string;
  swapTxHash?: string;
  error?: string;
}): PartialFailureDetail {
  return {
    partial: true,
    refundRequired: true,
    stage: input.stage,
    ...(input.debitTxHash ? { debitTxHash: input.debitTxHash } : {}),
    ...(input.swapTxHash ? { swapTxHash: input.swapTxHash } : {}),
    ...(input.error ? { error: input.error } : {}),
  };
}
