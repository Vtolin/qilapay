import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Change-detector guards: each asserts the post-fix wiring for one finding.
// They fail on the pre-fix code and pass after the minimal fix.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(root);
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

describe("route-guard wiring", () => {
  it("C1: execute endpoint re-evaluates compliance (no blind awaiting_verification exec)", () => {
    const src = read("src/app/api/transfer/[id]/route.ts");
    assert.match(src, /evaluateTransfer/, "must re-run the risk engine");
    assert.match(src, /outcome !== "ALLOW"/, "must refuse non-ALLOW outcomes");
  });

  it("C2: demo orchestration gated — reset/seed admin, velocity own-persona, status public-minus-secret", () => {
    const src = read("src/app/api/demo/route.ts");
    assert.match(src, /requireAdmin/, "reset/seed must require admin");
    assert.match(src, /personaKey/, "velocity must be scoped to the caller's own persona");
    assert.match(src, /getCurrentUser/, "status must not throw for anonymous visitors");
    assert.match(src, /viewer \? \{ demoPassword/, "demoPassword only for signed-in users");
  });

  it("C3: auth/seed use scrypt, not bare sha256", () => {
    const auth = read("src/app/api/auth/route.ts");
    const seed = read("src/lib/qila/seed.ts");
    assert.match(auth, /verifyPasswordSync|hashPasswordSync/);
    assert.match(seed, /hashPasswordSync/);
    assert.doesNotMatch(seed, /createHash\("sha256"\)\.update\(`\$\{email/);
  });

  it("H1: sessions fail closed + constant-time compare + secure cookie", () => {
    const src = read("src/lib/qila/session.ts");
    assert.match(src, /timingSafeEqual/);
    assert.match(src, /secure:/);
    assert.match(src, /SESSION_SECRET is not set/);
  });

  it("H2: quotes are single-use (pre-check + unique constraint + P2002)", () => {
    const route = read("src/app/api/transfer/route.ts");
    const schema = read("prisma/schema.prisma");
    assert.match(route, /Quote sudah dipakai|sudah dipakai/);
    assert.match(route, /P2002/);
    assert.match(schema, /quoteId\s+String\s+@unique/);
  });

  it("H2b: runExecution claims the row (no double-execute)", () => {
    const src = read("src/lib/qila/transfer-engine.ts");
    assert.match(src, /updateMany/);
    assert.match(src, /tidak bisa dieksekusi/);
  });

  it("H3: partial two-leg failures preserve evidence + refund flag", () => {
    const src = read("src/lib/qila/transfer-engine.ts");
    assert.match(src, /refundRequired/);
    assert.match(src, /buildPartialFailureDetail|partial:\s*true/);
  });

  it("H4: sqlite db is git-ignored", () => {
    const gi = read(".gitignore");
    assert.match(gi, /db\/\*\.db|\*\.db/);
  });

  it("H5: fund endpoint is rate-limited/capped", () => {
    const src = read("src/app/api/fund/route.ts");
    assert.match(src, /checkRateLimit/);
  });

  it("H6: Caddy has no client-controlled upstream port", () => {
    const src = read("Caddyfile");
    assert.doesNotMatch(src, /\{query\./);
    assert.match(src, /localhost:3000/);
  });

  it("M1: admin config/tiers/screening validated", () => {
    const src = read("src/app/api/admin/config/route.ts");
    assert.match(src, /validateConfigPatch/);
    assert.match(src, /validateTierUpdates/);
    assert.match(src, /validateScreeningAction/);
  });

  it("M2: recipient + execution addresses strictly validated", () => {
    const rec = read("src/app/api/recipients/route.ts");
    const eng = read("src/lib/qila/transfer-engine.ts");
    assert.match(rec, /isValidWalletAddress/);
    assert.match(eng, /isValidWalletAddress/);
  });

  it("M3: screening normalized + over-ceiling BLOCK + velocity excludes terminal", () => {
    const src = read("src/lib/qila/risk.ts");
    assert.match(src, /screeningMatches|normalizeScreeningName/);
    assert.match(src, /"BLOCK"/);
    assert.match(src, /isOverTopTier/);
    assert.match(src, /notIn/);
  });

  it("M4: quote math in microunits + execution pre-flight balance check", () => {
    const quote = read("src/app/api/quote/route.ts");
    const eng = read("src/lib/qila/transfer-engine.ts");
    assert.match(quote, /amountToMicro/);
    assert.match(eng, /insufficientBalance/);
  });

  it("M5: auth + fx/refresh behind rate limits; fx/refresh requires session", () => {
    const auth = read("src/app/api/auth/route.ts");
    const fx = read("src/app/api/fx/refresh/route.ts");
    assert.match(auth, /checkRateLimit/);
    assert.match(fx, /requireUser|requireAdmin/);
    assert.match(fx, /checkRateLimit/);
  });

  it("M6: internal errors are generic; prod query logging off", () => {
    const api = read("src/lib/qila/api.ts");
    const db = read("src/lib/db.ts");
    assert.match(api, /Terjadi kesalahan internal/);
    assert.doesNotMatch(api, /return fail\(message, 500\)/);
    assert.match(db, /NODE_ENV/);
  });

  it("L1: dex path requires live coverage of the stale quote", () => {
    const src = read("src/lib/qila/transfer-engine.ts");
    assert.match(src, /isQuoteAmountCovered/);
  });

  it("L2: strict build config", () => {
    const src = read("next.config.ts");
    assert.match(src, /ignoreBuildErrors:\s*false/);
    assert.match(src, /reactStrictMode:\s*true/);
  });

  it("admin GET: no passwordHash in admin payloads", () => {
    const src = read("src/app/api/admin/route.ts");
    assert.doesNotMatch(src, /include:\s*\{[^}]*user:\s*true/);
    assert.match(src, /select/);
  });

  it("L3: no silent 'qilapay' secret fallbacks in key derivation", () => {
    const seed = read("src/lib/qila/seed.ts");
    const rec = read("src/app/api/recipients/route.ts");
    assert.doesNotMatch(seed, /\|\|\s*"qilapay"/);
    assert.doesNotMatch(rec, /WALLET_ENCRYPTION_KEY.*\|\|\s*"qilapay"/);
  });

  it("seed velocity history uses honest executionMode", () => {
    const src = read("src/lib/qila/seed.ts");
    const block = src.slice(src.indexOf("seedVelocityHistory"), src.indexOf("resetDemoData"));
    assert.match(block, /executionMode:\s*"direct"/);
    assert.doesNotMatch(block, /executionMode:\s*"dex"/);
  });
});
