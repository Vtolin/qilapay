import { NextRequest } from "next/server";
import { ok, fail, handleError, jsonSafe } from "@/lib/qila/api";
import { seedBase, seedPersonas, resetDemoData, seedVelocityHistory, DEMO_PASSWORD } from "@/lib/qila/seed";
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
          demoPassword: DEMO_PASSWORD,
        }),
      );
    }

    if (body.action === "seed") {
      await seedBase();
      await seedPersonas();
      return ok({ seeded: true });
    }

    if (body.action === "reset") {
      await resetDemoData(true);
      return ok({ reset: true });
    }

    if (body.action === "velocity") {
      await seedVelocityHistory(body.persona || "dewi", 3);
      return ok({ velocitySeeded: true });
    }

    return fail("Unknown action");
  } catch (e) {
    return handleError(e);
  }
}
