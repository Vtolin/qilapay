import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { requireAdmin } from "@/lib/qila/session";
import { setConfig } from "@/lib/qila/config";
import {
  validateConfigPatch,
  validateTierUpdates,
  validateScreeningAction,
} from "@/lib/qila/validation";

/** POST: update tier limits, FX spread/fee, risk corridors, screening list. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      action: "tiers" | "config" | "screening_add" | "screening_remove";
      tiers?: {
        tier: number;
        perTxLimitUsd: number;
        rolling30dLimitUsd: number;
        requiredMethods?: string[];
      }[];
      config?: Record<string, string>;
      screening?: { name: string; reason?: string; action?: string };
      name?: string;
    };

    if (body.action === "tiers" && body.tiers) {
      // Audit M1: validated ranges — negatives/inversions would corrupt limits.
      let tiers;
      try {
        tiers = validateTierUpdates(body.tiers);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Invalid tier");
      }
      for (const t of tiers) {
        await db.kycTierConfig.update({
          where: { tier: t.tier },
          data: {
            perTxLimitUsd: t.perTxLimitUsd,
            rolling30dLimitUsd: t.rolling30dLimitUsd,
            ...(t.requiredMethods ? { requiredMethods: JSON.stringify(t.requiredMethods) } : {}),
          },
        });
      }
      await db.auditLog.create({
        data: {
          actor: admin.email,
          action: "admin.tiers.update",
          entity: "kyc_tier_config",
          meta: JSON.stringify(body.tiers),
        },
      });
      return ok({ updated: true });
    }

    if (body.action === "config" && body.config) {
      // Audit M1: allowlisted keys + ranges; unknown/malformed values rejected.
      let patch: Record<string, string>;
      try {
        patch = validateConfigPatch(body.config);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Invalid config");
      }
      for (const [key, value] of Object.entries(patch)) {
        await setConfig(key, value);
      }
      await db.auditLog.create({
        data: {
          actor: admin.email,
          action: "admin.config.update",
          entity: "app_config",
          meta: JSON.stringify(body.config),
        },
      });
      return ok({ updated: true });
    }

    if (body.action === "screening_add" && body.screening) {
      // Audit M1: action constrained to HOLD_REVIEW | BLOCK.
      let action: "HOLD_REVIEW" | "BLOCK";
      try {
        action = validateScreeningAction(body.screening.action || "HOLD_REVIEW");
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Invalid action");
      }
      await db.screeningEntry.upsert({
        where: { name: body.screening.name },
        create: {
          name: body.screening.name,
          reason: body.screening.reason || "Manual admin entry",
          action,
        },
        update: {
          reason: body.screening.reason || "Manual admin entry",
          action,
        },
      });
      return ok({ updated: true });
    }

    if (body.action === "screening_remove" && body.name) {
      await db.screeningEntry.delete({ where: { name: body.name } });
      return ok({ updated: true });
    }

    return fail("Unknown action");
  } catch (e) {
    return handleError(e);
  }
}
