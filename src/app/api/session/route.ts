import { db } from "@/lib/db";
import { ok, handleError, jsonSafe } from "@/lib/qila/api";
import { getCurrentUser } from "@/lib/qila/session";
import { getTokenBalance } from "@/lib/qila/tempo";
import { getRollingUsage } from "@/lib/qila/risk";

/** Current session: user, tier, limits, usage, on-chain balances. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ authenticated: false });

    const [tierCfg, tiers, currencies, usage] = await Promise.all([
      db.kycTierConfig.findUnique({ where: { tier: user.currentTier } }),
      db.kycTierConfig.findMany({ orderBy: { tier: "asc" } }),
      db.currency.findMany({ where: { isActive: true } }),
      getRollingUsage(user.id),
    ]);

    // on-chain balances
    const balances: { code: string; name: string; tokenAddress: string; amount: number }[] = [];
    if (user.wallet) {
      for (const c of currencies) {
        try {
          const raw = await getTokenBalance(c.tokenAddress, user.wallet.address);
          balances.push({
            code: c.code,
            name: c.name,
            tokenAddress: c.tokenAddress,
            amount: Number(raw) / 1e6,
          });
        } catch {
          balances.push({ code: c.code, name: c.name, tokenAddress: c.tokenAddress, amount: 0 });
        }
      }
    }

    const recentTransfers = await db.transfer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { quote: true, recipient: true },
    });

    const pendingVerifications = await db.kycVerification.findMany({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      jsonSafe({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          country: user.country,
          currentTier: user.currentTier,
          personaKey: user.personaKey,
          role: user.role?.role || "user",
          walletAddress: user.wallet?.address,
        },
        tier: tierCfg,
        tiers,
        usage30dUsd: usage,
        balances,
        recentTransfers,
        pendingVerifications,
      }),
    );
  } catch (e) {
    return handleError(e);
  }
}
