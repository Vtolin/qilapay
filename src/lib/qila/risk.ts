import { db } from "@/lib/db";
import { getConfig, getConfigNumber, getConfigJson } from "./config";
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
  LIMIT_PER_TX: "Jumlah transfer melebihi limit per transaksi tier kamu.",
  LIMIT_ROLLING_30D: "Total transfer 30 hari terakhir melebihi limit tier kamu.",
  VELOCITY_HIGH: "Terdeteksi pola pengiriman sangat cepat berulang (velocity tinggi).",
  NEW_RECIPIENT_LARGE: "Penerima baru dengan nominal yang relatif besar.",
  CORRIDOR_RISK: "Koridor tujuan berada di daftar koridor risiko tinggi.",
  SCREENING_HIT: "Nama penerima cocok dengan daftar screening (watchlist internal).",
  SANCTIONS_BLOCK: "Nama penerima cocok dengan daftar sanksi — transfer diblokir.",
};

export const REASON_METHOD_HINT: Record<ReasonCode, string> = {
  LIMIT_PER_TX: "Naik tier untuk membuka limit lebih besar.",
  LIMIT_ROLLING_30D: "Naik tier untuk membuka limit 30 hari lebih besar.",
  VELOCITY_HIGH: "Verifikasi cepat untuk konfirmasi aktivitas ini benar milikmu.",
  NEW_RECIPIENT_LARGE: "Verifikasi cepat untuk penerima baru dengan nominal besar.",
  CORRIDOR_RISK: "Koridor ini butuh verifikasi tambahan sebelum diproses.",
  SCREENING_HIT: "Transfer masuk antrean review tim compliance.",
  SANCTIONS_BLOCK: "Transfer tidak dapat dilanjutkan.",
};

export type Decision = {
  outcome: "ALLOW" | "STEP_UP" | "HOLD_REVIEW" | "BLOCK";
  reasonCodes: ReasonCode[];
  methods: string[]; // verification methods the user may choose
  targetTier: number; // minimum tier that satisfies the transfer
  snapshot: Record<string, unknown>;
};

export const METHOD_LABELS: Record<string, string> = {
  selfie_liveness: "Selfie liveness / estimasi usia",
  age_estimation: "Estimasi usia",
  id_face_match: "Dokumen identitas + face match",
  bank_micro_deposit: "Verifikasi rekening bank (micro-deposit)",
  proof_of_address: "Bukti alamat",
  source_of_funds: "Surat sumber dana",
  video_call: "Video call dengan reviewer",
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
  return db.transfer.count({ where: { userId, createdAt: { gte: since } } });
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

  // 1) screening list (case-insensitive name match)
  const allEntries = await db.screeningEntry.findMany();
  const hit = allEntries.find(
    (e) => e.name.toLowerCase() === input.recipientName.trim().toLowerCase(),
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
