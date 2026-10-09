import { NextRequest } from "next/server";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { seedBase, seedPersonas, resetDemoData, seedVelocityHistory, DEMO_PASSWORD } from "@/lib/qila/seed";
import { getCurrentUser, requireUser, requireAdmin } from "@/lib/qila/session";
import { TEMPO, explorerAddress, getTreasuryAccount } from "@/lib/qila/tempo";
import { db } from "@/lib/db";
import { getAllConfig } from "@/lib/qila/config";

/**
 * POST: demo orchestration.
 *  - status: seed state + tech summary for the /demo page
 *  - seed: idempotent base + persona seed (first-run init)
 *  - reset: wipe + re-seed (one click)
 *  - velocity: re-seed Dewi's velocity history
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: string; persona?: string };

    if (body.action === "status") {
      // Public tech summary (network, tokens, tiers are all public info).
      // demoPassword is only disclosed to signed-in users.
      const viewer = await getCurrentUser().catch(() => null);
      const [currencies, tiers, config, treasury] = await Promise.all([
        db.currency.findMany(),
        db.kycTierConfig.findMany({ orderBy: { tier: "asc" } }),
        getAllConfig(),
        Promise.resolve(getTreasuryAccount()),
      ]);
      return ok(
        jsonSafe({
          network: {
            name: "Tempo Testnet (Moderato)",
            chainId: TEMPO.chainId,
            rpcUrl: TEMPO.rpcUrl,
            explorerUrl: TEMPO.explorerUrl,
            faucetUrl: TEMPO.faucetUrl,
          },
          tokens: currencies.map((c) => ({ code: c.code, name: c.name, address: c.tokenAddress })),
          tiers,
          config,
          treasury: { address: treasury.address, explorer: explorerAddress(treasury.address) },
          ...(viewer ? { demoPassword: DEMO_PASSWORD } : {}),
        }),
      );
    }

    if (body.action === "seed") {
      // Destructive/state-changing demo actions are admin-only (audit C2).
      await requireAdmin();
      await seedBase();
      await seedPersonas();
      return ok({ seeded: true });
    }

    if (body.action === "reset") {
      await requireAdmin();
      await resetDemoData(true);
      return ok({ reset: true });
    }

    if (body.action === "velocity") {
      // Scoped to your own persona account: the one-click scenario logs in
      // as that persona first, so demo UX is unchanged — but nobody can write
      // velocity history into someone else's account. Global reset stays admin.
      const user = await requireUser();
      const target = body.persona || "dewi";
      if (user.personaKey !== target) {
        return fail("Velocity setup is only for your own persona account", 403);
      }
      await seedVelocityHistory(target, 3);
      return ok({ velocitySeeded: true });
    }

    return fail("Unknown action");
  } catch (e) {
    return handleError(e);
  }
}
