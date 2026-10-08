import { db } from "@/lib/db";
import { createHash } from "crypto";
import {
  ensureQilaToken,
  faucetFund,
  getTreasuryAccount,
  getTreasuryClient,
  getTokenBalance,
  micro,
  transferWithMemo,
} from "./tempo";
import { refreshFxRates } from "./fx";
import { encryptSecret } from "./crypto";
import { setConfig } from "./config";
import type { PrivateKey } from "./types";

/**
 * Seeding: KYC tiers, screening list, currencies (on-chain issuance),
 * FX rates, and demo personas with deterministic custodial wallets.
 *
 * Persona wallets are DETERMINISTIC (derived from personaKey + secret), so
 * demo reset keeps the same on-chain addresses/balances — no faucet spam,
 * reset stays fast.
 */

export const TIER_SEED = [
  {
    tier: 0,
    name: "Basic",
    perTxLimitUsd: 50,
    rolling30dLimitUsd: 150,
    requiredMethods: JSON.stringify(["selfie_liveness", "age_estimation", "bank_micro_deposit"]),
    description: "Email + OTP (simulasi)",
  },
  {
    tier: 1,
    name: "Verified",
    perTxLimitUsd: 500,
    rolling30dLimitUsd: 2000,
    requiredMethods: JSON.stringify(["selfie_liveness", "age_estimation", "bank_micro_deposit"]),
    description: "+ Selfie liveness / estimasi usia (simulasi)",
  },
  {
    tier: 2,
    name: "Full KYC",
    perTxLimitUsd: 5000,
    rolling30dLimitUsd: 20000,
    requiredMethods: JSON.stringify(["id_face_match", "proof_of_address"]),
    description: "+ KTP/Paspor + face match (simulasi)",
  },
  {
    tier: 3,
    name: "Enhanced",
    perTxLimitUsd: 50000,
    rolling30dLimitUsd: 100000,
    requiredMethods: JSON.stringify(["proof_of_address", "source_of_funds", "video_call"]),
    description: "+ Bukti alamat + sumber dana, review manual admin",
  },
];

export const SCREENING_SEED = [
  { name: "Hansi Vijayananth", reason: "Dummy watchlist: sanksi keuangan (simulasi)", action: "HOLD_REVIEW" },
  { name: "Vladimir Skriponov", reason: "Dummy sanctions list: BLOCK otomatis (simulasi)", action: "BLOCK" },
];

export const CURRENCY_SEED = [
  { code: "USD", name: "US Dollar (pathUSD)" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

/** Deterministic private key for demo personas (never used for real users). */
function personaPrivateKey(personaKey: string): PrivateKey {
  const secret = process.env.WALLET_ENCRYPTION_KEY || "qilapay";
  const hash = createHash("sha256").update(`qilapay:${personaKey}:${secret}`).digest();
  return (`0x${hash.toString("hex")}`) as PrivateKey;
}

export async function ensureCurrencies(): Promise<void> {
  for (const c of CURRENCY_SEED) {
    const existing = await db.currency.findUnique({ where: { code: c.code } });
    if (c.code === "USD") {
      if (!existing) {
        await db.currency.create({ data: { code: "USD", name: c.name, tokenAddress: "0x20c0000000000000000000000000000000000000", decimals: 6 } });
      }
      continue;
    }
    const address = await ensureQilaToken(c.code, existing?.tokenAddress);
    if (existing) {
      if (existing.tokenAddress !== address) {
        await db.currency.update({ where: { code: c.code }, data: { tokenAddress: address } });
      }
    } else {
      await db.currency.create({ data: { code: c.code, name: c.name, tokenAddress: address, decimals: 6 } });
    }
  }
}

/** Give a wallet at least `targetUsd` worth of pathUSD via faucet if low. */
async function ensureUsdBalance(address: string, targetUsd: number): Promise<void> {
  const bal = await getTokenBalance("0x20c0000000000000000000000000000000000000", address);
  if (Number(bal) / 1e6 < targetUsd) {
    await faucetFund(address);
    await new Promise((r) => setTimeout(r, 4000));
  }
}

/** Mint q<ccy> to a wallet up to a target balance (treasury is the issuer). */
async function ensureQBalance(address: string, code: string, target: number): Promise<void> {
  const cur = await db.currency.findUnique({ where: { code } });
  if (!cur) return;
  const bal = await getTokenBalance(cur.tokenAddress, address);
  if (Number(bal) / 1e6 >= target) return;
  const client = getTreasuryClient();
  await client.token.mintSync({
    token: cur.tokenAddress as `0x${string}`,
    to: address as `0x${string}`,
    amount: micro(target),
  });
}

export type PersonaSpec = {
  key: string;
  email: string;
  fullName: string;
  country: string;
  tier: number;
  role?: "admin";
  targets: { usd: number; idr?: number; sgd?: number; eur?: number; gbp?: number };
};

export const PERSONA_SEED: PersonaSpec[] = [
  { key: "sari", email: "sari@qilapay.demo", fullName: "Sari Putri", country: "ID", tier: 0, targets: { usd: 260, idr: 2_000_000 } },
  { key: "budi", email: "budi@qilapay.demo", fullName: "Budi Santoso", country: "ID", tier: 2, targets: { usd: 800, eur: 300, sgd: 500 } },
  { key: "dewi", email: "dewi@qilapay.demo", fullName: "Dewi Lestari", country: "ID", tier: 0, targets: { usd: 45, idr: 1_500_000 } },
  { key: "admin", email: "admin@qilapay.demo", fullName: "Admin QilaPay", country: "ID", tier: 2, role: "admin", targets: { usd: 100 } },
];

const DEMO_PASSWORD = "demo1234";

function hashPassword(email: string, password: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}:${password}:qilapay`).digest("hex");
}

export async function seedBase(): Promise<void> {
  for (const t of TIER_SEED) {
    await db.kycTierConfig.upsert({
      where: { tier: t.tier },
      create: t,
      update: t,
    });
  }
  for (const s of SCREENING_SEED) {
    await db.screeningEntry.upsert({ where: { name: s.name }, create: s, update: s });
  }
  // spread / fee config defaults are handled by getConfig fallbacks
  await setConfig("fx_spread_bps", "75");
  await setConfig("fee_bps", "50");
  try {
    await refreshFxRates();
  } catch {
    // offline: static fallback in fx.ts keeps the demo alive
  }
  // treasury fee funds
  await ensureUsdBalance(getTreasuryAccount().address, 1000);
  await ensureCurrencies();
}

export async function seedPersonas(): Promise<void> {
  for (const p of PERSONA_SEED) {
    const pk = personaPrivateKey(p.key);
    const { privateKeyToAccount } = await import("viem/accounts");
    const address = privateKeyToAccount(pk).address;
    const user = await db.user.upsert({
      where: { email: p.email },
      create: {
        email: p.email,
        passwordHash: hashPassword(p.email, DEMO_PASSWORD),
        fullName: p.fullName,
        country: p.country,
        currentTier: p.tier,
        personaKey: p.key,
      },
      update: { currentTier: p.tier, personaKey: p.key },
    });
    await db.userRole.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: p.role === "admin" ? "admin" : "user" },
      update: { role: p.role === "admin" ? "admin" : "user" },
    });
    await db.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id, address, encryptedKey: encryptSecret(pk) },
      update: {},
    });
    // balances (idempotent: only tops up when below target)
    await ensureUsdBalance(address, p.targets.usd);
    await ensureQBalance(address, "IDR", p.targets.idr || 0);
    await ensureQBalance(address, "SGD", p.targets.sgd || 0);
    await ensureQBalance(address, "EUR", p.targets.eur || 0);
    await ensureQBalance(address, "GBP", p.targets.gbp || 0);
    // sweep excess USD down to target + 20 to keep demo balances realistic
    const bal = await getTokenBalance("0x20c0000000000000000000000000000000000000", address);
    const targetMicro = micro(p.targets.usd + 20);
    if (bal > targetMicro) {
      const excess = bal - targetMicro;
      if (excess > micro(5)) {
        try {
          await transferWithMemo({
            privateKey: pk,
            tokenAddress: "0x20c0000000000000000000000000000000000000",
            to: getTreasuryAccount().address,
            amount: excess,
          });
        } catch {
          // sweep is cosmetic; ignore failure
        }
      }
    }
  }
  // cross-links after ALL personas exist (so Budi's wallet is available to Sari)
  for (const p of PERSONA_SEED) {
    const user = await db.user.findUnique({ where: { email: p.email } });
    if (user) await ensureRecipients(user.id, p.key);
  }
}

async function ensureRecipients(userId: string, personaKey: string) {
  const common = [
    { name: "Ibu Ratna (keluarga)", country: "ID" },
    { name: "Toko Kelontong Maju", country: "ID" },
    { name: "Chen Wei", country: "SG" },
    { name: "Maria Gonzalez", country: "ES" },
  ];
  const { privateKeyToAccount } = await import("viem/accounts");
  for (const r of common) {
    const exists = await db.recipient.findFirst({ where: { userId, name: r.name } });
    if (!exists) {
      // deterministic demo wallet per recipient name
      const secret = process.env.WALLET_ENCRYPTION_KEY || "qilapay";
      const hash = createHash("sha256").update(`qilapay-recipient:${r.name}:${secret}`).digest();
      const address = privateKeyToAccount((`0x${hash.toString("hex")}`) as `0x${string}`).address;
      await db.recipient.create({ data: { userId, ...r, walletAddress: address } });
    } else if (!exists.walletAddress) {
      const secret = process.env.WALLET_ENCRYPTION_KEY || "qilapay";
      const hash = createHash("sha256").update(`qilapay-recipient:${r.name}:${secret}`).digest();
      const address = privateKeyToAccount((`0x${hash.toString("hex")}`) as `0x${string}`).address;
      await db.recipient.update({ where: { id: exists.id }, data: { walletAddress: address } });
    }
  }
  if (personaKey === "sari") {
    // linked recipient: Budi (another QilaPay user)
    const budi = await db.user.findUnique({ where: { email: "budi@qilapay.demo" } });
    const budiWallet = budi ? await db.wallet.findUnique({ where: { userId: budi.id } }) : null;
    if (budi && budiWallet) {
      const exists = await db.recipient.findFirst({ where: { userId, linkedUserId: budi.id } });
      if (!exists) {
        await db.recipient.create({
          data: { userId, name: "Budi Santoso (QilaPay)", country: "ID", linkedUserId: budi.id, walletAddress: budiWallet.address },
        });
      } else if (!exists.walletAddress) {
        await db.recipient.update({ where: { id: exists.id }, data: { walletAddress: budiWallet.address } });
      }
    }
  }
}

/**
 * Give a persona fresh velocity history: N small real transfers in the
 * last few minutes (on-chain + fully recorded in DB), so the next
 * transfer trips VELOCITY_HIGH.
 */
export async function seedVelocityHistory(personaKey: string, count = 3): Promise<void> {
  const user = await db.user.findUnique({ where: { email: `${personaKey}@qilapay.demo` } });
  if (!user) return;
  const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;
  const recipient =
    (await db.recipient.findFirst({ where: { userId: user.id, name: "Toko Kelontong Maju" } })) ||
    (await db.recipient.findFirst({ where: { userId: user.id } }));
  if (!recipient) return;
  const pk = personaPrivateKey(personaKey);
  for (let i = 0; i < count; i++) {
    try {
      const receipt = await transferWithMemo({
        privateKey: pk,
        tokenAddress: "0x20c0000000000000000000000000000000000000",
        to: recipient.walletAddress as string,
        amount: micro(2),
        memo: (`0x${Buffer.from(`QILA-VEL${i}`).toString("hex").padStart(64, "0")}`) as `0x${string}`,
      });
      // record in DB so the velocity counter sees it
      const quote = await db.quote.create({
        data: {
          userId: user.id,
          fromCcy: "USD",
          toCcy: "USD",
          amountIn: "2000000",
          amountOut: "1990000",
          rate: 0.995,
          spreadBps: 75,
          feeUsd: 0.01,
          usdEquivalent: 2,
          executionMode: "direct",
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      const transfer = await db.transfer.create({
        data: {
          userId: user.id,
          recipientId: recipient.id,
          quoteId: quote.id,
          status: "settled",
          txHash: receipt.transactionHash,
          submitTxHash: receipt.transactionHash,
          submittedAt: new Date(),
          settledAt: new Date(),
          memo: `QILA-VEL${i}`,
          executionMode: "dex",
        },
      });
      await db.transferEvent.create({
        data: { transferId: transfer.id, status: "settled", detail: JSON.stringify({ seeded: true }) },
      });
    } catch {
      // best effort
    }
  }
}

/** Full reset: wipe user-generated data, re-seed tiers/screening/personas. */
export async function resetDemoData(withVelocity = false): Promise<void> {
  await db.transferEvent.deleteMany({});
  await db.riskDecision.deleteMany({});
  await db.transfer.deleteMany({});
  await db.quote.deleteMany({});
  await db.kycVerification.deleteMany({});
  await db.recipient.deleteMany({});
  await db.auditLog.deleteMany({});
  // keep users/wallets/currencies/tiers/screening for speed & stable addresses
  await seedBase();
  await seedPersonas();
  if (withVelocity) {
    await seedVelocityHistory("dewi", 3);
  }
}

export { DEMO_PASSWORD, personaPrivateKey, hashPassword };
