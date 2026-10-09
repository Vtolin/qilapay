import { db } from "@/lib/db";
import { getConfig, getConfigNumber, getConfigJson } from "./config";
import { screeningMatches, isOverTopTier } from "./validation";
import { toUsd, type FxSnapshot } from "./fx";

/**
 * Adaptive-KYC decision engine (spec 5.3).
 *
 * evaluateTransfer(user, quote-ish input) -> ALLOW | STEP_UP | HOLD_REVIEW | BLOCK
 * with reason codes and the allowed verification methods.
 *
 * Every threshold is read from AppConfig / KycTierConfig, never hardcoded.
 */

export type ReasonCode =
  | "LIMIT_PER_TX"
  | "LIMIT_ROLLING_30D"
  | "VELOCITY_HIGH"
  | "NEW_RECIPIENT_LARGE"
  | "CORRIDOR_RISK"
  | "SCREENING_HIT"
  | "SANCTIONS_BLOCK";

export const REASON_LABELS: Record<ReasonCode, string> = {
  LIMIT_PER_TX: "Transfer amount is above your tier per transfer limit.",
  LIMIT_ROLLING_30D: "Your last 30 days of transfers are above your tier limit.",
  VELOCITY_HIGH: "Repeated fast sends detected (high velocity).",
  NEW_RECIPIENT_LARGE: "A new recipient with a relatively large amount.",
  CORRIDOR_RISK: "Destination corridor is on the high risk list.",
  SCREENING_HIT: "Recipient name matches the screening list (internal watchlist).",
  SANCTIONS_BLOCK: "Recipient name matches the sanctions list. Transfer is blocked.",
};

export const REASON_METHOD_HINT: Record<ReasonCode, string> = {
  LIMIT_PER_TX: "Move up a tier to unlock a larger limit.",
  LIMIT_ROLLING_30D: "Move up a tier to unlock a larger 30 day limit.",
  VELOCITY_HIGH: "A quick check to confirm this activity is really yours.",
  NEW_RECIPIENT_LARGE: "A quick check for a new recipient with a large amount.",
  CORRIDOR_RISK: "This corridor needs extra verification before processing.",
  SCREENING_HIT: "Transfer goes to the compliance review queue.",
  SANCTIONS_BLOCK: "Transfer cannot proceed.",
};

export type Decision = {
  outcome: "ALLOW" | "STEP_UP" | "HOLD_REVIEW" | "BLOCK";
  reasonCodes: ReasonCode[];
  methods: string[]; // verification methods the user may choose
  targetTier: number; // minimum tier that satisfies the transfer
  snapshot: Record<string, unknown>;
};

export const METHOD_LABELS: Record<string, string> = {
  selfie_liveness: "Selfie liveness / age estimation",
  age_estimation: "Age estimation",
  id_face_match: "ID plus face match",
  bank_micro_deposit: "Bank account check (micro deposit)",
  proof_of_address: "Proof of address",
  source_of_funds: "Source of funds letter",
  video_call: "Video call with a reviewer",
};

export async function getRollingUsage(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const transfers = await db.transfer.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      status: { in: ["quoted", "compliance_check", "awaiting_verification", "pending_review", "submitted", "settled"] },
    },
    include: { quote: true },
  });
  return transfers.reduce((s, t) => s + (t.quote?.usdEquivalent || 0), 0);
}

export async function getVelocityCount(userId: string): Promise<number> {
  const windowMin = await getConfigNumber("velocity_window_minutes") || 10;
  const since = new Date(Date.now() - windowMin * 60 * 1000);
  // Audit M3: terminal failed/blocked rows are not velocity signal.
  return db.transfer.count({
    where: { userId, createdAt: { gte: since }, status: { notIn: ["failed", "blocked"] } },
  });
}

function pickTargetTier(
  amountUsd: number,
  usageUsd: number,
  tiers: { tier: number; perTxLimitUsd: number; rolling30dLimitUsd: number }[],
): number {
  const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
  for (const t of sorted) {
    if (amountUsd <= t.perTxLimitUsd && usageUsd + amountUsd <= t.rolling30dLimitUsd) {
      return t.tier;
    }
  }
  return sorted[sorted.length - 1]?.tier ?? 3;
}

export async function evaluateTransfer(input: {
  userId: string;
  userTier: number;
  amountUsd: number;
  recipientName: string;
  recipientCountry: string;
  recipientCreatedAt: Date;
  rates: FxSnapshot;
}): Promise<Decision> {
  const tiers = await db.kycTierConfig.findMany({
    orderBy: { tier: "asc" },
  });
  const currentTierCfg = tiers.find((t) => t.tier === input.userTier) || tiers[0];
  const usage = await getRollingUsage(input.userId);
  const velocity = await getVelocityCount(input.userId);
  const velocityMax = await getConfigNumber("velocity_max_transfers") || 3;
  const newRecMinutes = await getConfigNumber("new_recipient_minutes") || 30;
  const newRecLarge = await getConfigNumber("new_recipient_large_usd") || 100;
  const corridors = await getConfigJson<string[]>("risk_corridors");

  const reasonCodes: ReasonCode[] = [];
  let outcome: Decision["outcome"] = "ALLOW";
  const recipientAgeMin = (Date.now() - input.recipientCreatedAt.getTime()) / 60000;

  // 1) screening list (normalized match: case/space/punctuation/diacritics)
  const allEntries = await db.screeningEntry.findMany();
  const hit = allEntries.find((e) =>
    screeningMatches(e.name, input.recipientName),
  );
  if (hit) {
    if (hit.action === "BLOCK") {
      reasonCodes.push("SANCTIONS_BLOCK");
      return finish("BLOCK");
    }
    reasonCodes.push("SCREENING_HIT");
    outcome = "HOLD_REVIEW";
  }

  // 2) corridor risk
  if (corridors.includes(input.recipientCountry)) {
    reasonCodes.push("CORRIDOR_RISK");
    if (outcome === "ALLOW") outcome = "HOLD_REVIEW";
  }

  // 3) tier limits -> STEP_UP to minimum sufficient tier
  const targetTier = pickTargetTier(
    input.amountUsd,
    usage,
    tiers.map((t) => ({ tier: t.tier, perTxLimitUsd: t.perTxLimitUsd, rolling30dLimitUsd: t.rolling30dLimitUsd })),
  );
  // Audit M3: amounts above the TOP tier ceiling can never be satisfied by
  // step-up — hard BLOCK instead of offering an unreachable tier.
  const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
  const topTier = sorted[sorted.length - 1];
  if (topTier) {
    const over = isOverTopTier(input.amountUsd, usage, topTier);
    if (over.overPerTx) {
      if (!reasonCodes.includes("LIMIT_PER_TX")) reasonCodes.push("LIMIT_PER_TX");
      return finish("BLOCK", [], topTier.tier);
    }
    if (over.overRolling) {
      if (!reasonCodes.includes("LIMIT_ROLLING_30D")) reasonCodes.push("LIMIT_ROLLING_30D");
      return finish("BLOCK", [], topTier.tier);
    }
  }
  if (input.amountUsd > currentTierCfg.perTxLimitUsd) {
    reasonCodes.push("LIMIT_PER_TX");
    if (outcome === "ALLOW") outcome = "STEP_UP";
  }
  if (usage + input.amountUsd > currentTierCfg.rolling30dLimitUsd) {
    reasonCodes.push("LIMIT_ROLLING_30D");
    if (outcome === "ALLOW") outcome = "STEP_UP";
  }

  // 4) risk triggers (even under limits)
  if (recipientAgeMin <= newRecMinutes && input.amountUsd >= newRecLarge) {
    reasonCodes.push("NEW_RECIPIENT_LARGE");
    if (outcome === "ALLOW") outcome = "STEP_UP";
  }
  if (velocity >= velocityMax) {
    reasonCodes.push("VELOCITY_HIGH");
    if (outcome === "ALLOW") outcome = "STEP_UP";
  }

  // methods: what the target tier requires (or next tier if step-up is generic)
  let methods: string[] = [];
  if (outcome === "STEP_UP") {
    const targetCfg = tiers.find((t) => t.tier === targetTier) || tiers[tiers.length - 1];
    methods = JSON.parse(targetCfg.requiredMethods || "[]");
  }

  return finish(outcome, methods, targetTier);

  function finish(
    o: Decision["outcome"],
    m: string[] = [],
    tt = input.userTier,
  ): Decision {
    return {
      outcome: o,
      reasonCodes,
      methods: m,
      targetTier: tt,
      snapshot: {
        userTier: input.userTier,
        amountUsd: input.amountUsd,
        rollingUsage30dUsd: usage,
        velocityLast10m: velocity,
        recipientAgeMinutes: Math.round(recipientAgeMin),
        recipientCountry: input.recipientCountry,
        corridors,
        screeningHit: hit ? { name: hit.name, reason: hit.reason, action: hit.action } : null,
        perTxLimitUsd: currentTierCfg.perTxLimitUsd,
        rolling30dLimitUsd: currentTierCfg.rolling30dLimitUsd,
        targetTier: tt,
      },
    };
  }
}
