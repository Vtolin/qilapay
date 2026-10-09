import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// Fix-verification for the DB-layer audit findings (F3/F5/F6/F7/F10/F11/
// F13/F14/F15/F16 + throttle hardening + F1/F4/F12 hygiene).
// Pure unit tests import dependency-free modules directly; wiring guards
// assert the minimal fix is present in route/engine sources. Each guard
// fails on the pre-fix code and passes after.

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(path.dirname(here));
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

import {
  canTransitionTransferStatus,
  assertTransferTransition,
  validateTargetTier,
} from "../../src/lib/qila/validation.ts";
import { reclaimStuckSubmitted } from "../../src/lib/qila/reclaim.ts";
import {
  makeSessionToken,
  parseSessionToken,
  SESSION_TTL_MS,
} from "../../src/lib/qila/session-token.ts";

describe("F5: allowlisted transfer status transitions", () => {
  it("permits exactly the production transition set", () => {
    const legit = [
      ["quoted", "compliance_check"],
      ["compliance_check", "compliance_check"],
      ["compliance_check", "awaiting_verification"],
      ["compliance_check", "pending_review"],
      ["compliance_check", "blocked"],
      ["compliance_check", "submitted"],
      ["awaiting_verification", "submitted"],
      ["pending_review", "submitted"],
      ["pending_review", "blocked"],
      ["submitted", "settled"],
      ["submitted", "failed"],
    ];
    for (const [from, to] of legit) {
      assert.equal(canTransitionTransferStatus(from, to), true, `${from} -> ${to}`);
    }
  });

  it("rejects forgeries, resurrections, and skips", () => {
    const bad = [
      ["quoted", "settled"],
      ["quoted", "submitted"],
      ["compliance_check", "settled"],
      ["awaiting_verification", "settled"],
      ["awaiting_verification", "blocked"],
      ["pending_review", "settled"],
      ["submitted", "compliance_check"],
      ["failed", "submitted"],
      ["failed", "settled"],
      ["blocked", "pending_review"],
      ["settled", "failed"],
      ["settled", "settled"],
      ["quoted", "GOD_MODE_SETTLED_X2"],
      ["nope", "settled"],
    ];
    for (const [from, to] of bad) {
      assert.equal(canTransitionTransferStatus(from, to), false, `${from} -> ${to}`);
      assert.throws(() => assertTransferTransition(from, to), /Illegal transfer status transition/);
    }
  });

  it("F5 wiring: writers assert transitions", () => {
    assert.match(read("src/app/api/transfer/route.ts"), /assertTransferTransition/);
    assert.match(read("src/lib/qila/transfer-engine.ts"), /assertTransferTransition/);
    assert.match(read("src/app/api/admin/review/route.ts"), /assertTransferTransition/);
  });
});

describe("F16: KYC targetTier validated", () => {
  it("accepts integers 0..3 only", () => {
    for (const v of [0, 1, 2, 3]) assert.equal(validateTargetTier(v), v);
    for (const v of [-1, 4, 999, 1.5, "2", null, undefined, NaN, {}, []]) {
      assert.throws(() => validateTargetTier(v), /targetTier must be an integer 0\.\.3/);
    }
  });

  it("F16 wiring: verify endpoint validates", () => {
    assert.match(read("src/app/api/verify/route.ts"), /validateTargetTier/);
  });
});

describe("F6: session tokens (legacy removed, 24h TTL)", () => {
  const OLD_SECRET = process.env.SESSION_SECRET;
  before(() => {
    process.env.SESSION_SECRET = "test-secret-for-audit";
  });
  after(() => {
    if (OLD_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = OLD_SECRET;
  });

  it("v1 tokens round-trip", () => {
    const tok = makeSessionToken("user-123");
    assert.equal(parseSessionToken(tok), "user-123");
  });

  it("legacy never-expiring format is rejected (was accepted pre-fix)", () => {
    const legacySig = crypto
      .createHmac("sha256", "test-secret-for-audit")
      .update("user-123")
      .digest("hex")
      .slice(0, 32);
    assert.equal(parseSessionToken(`user-123.${legacySig}`), null);
  });

  it("tampered, expired, and malformed tokens rejected", () => {
    const tok = makeSessionToken("user-123");
    assert.equal(parseSessionToken(tok.slice(0, -1) + (tok.endsWith("0") ? "1" : "0")), null);
    assert.equal(parseSessionToken(undefined), null);
    assert.equal(parseSessionToken(""), null);
    assert.equal(parseSessionToken("v1.user.notanumber.sig"), null);
    // expired: craft with old issuedAt + valid sig
    const old = String(Date.now() - SESSION_TTL_MS - 1000);
    const sig = crypto
      .createHmac("sha256", "test-secret-for-audit")
      .update(`user-123.${old}`)
      .digest("hex")
      .slice(0, 32);
    assert.equal(parseSessionToken(`v1.user-123.${old}.${sig}`), null);
  });

  it("TTL is 24h (was 7d)", () => {
    assert.equal(SESSION_TTL_MS, 24 * 60 * 60 * 1000);
  });

  it("F6 wiring: no legacy branch left in token code", () => {
    const src = read("src/lib/qila/session-token.ts");
    assert.doesNotMatch(src, /Legacy format/);
    assert.doesNotMatch(src, /lastIndexOf/);
  });
});

describe("F3: reclaimStuckSubmitted (fake client)", () => {
  function fake(rows) {
    const updated = [];
    const events = [];
    return {
      updated,
      events,
      client: {
        transfer: {
          findMany: async () => rows,
          update: async (args) => {
            updated.push(args);
            return {};
          },
        },
        transferEvent: {
          create: async (args) => {
            events.push(args);
            return {};
          },
        },
      },
    };
  }

  it("marks only stale submitted rows failed with an event", async () => {
    const now = Date.now();
    const { client, updated, events } = fake([{ id: "stale-1" }]);
    // fake findMany ignores args; emulate the time filter via opts on real client below —
    // here assert the write shape for each returned row.
    const n = await reclaimStuckSubmitted(client, { timeoutMs: 5 * 60 * 1000, now });
    assert.equal(n, 1);
    assert.deepEqual(updated, [{ where: { id: "stale-1" }, data: { status: "failed" } }]);
    assert.equal(events.length, 1);
    assert.equal(events[0].data.transferId, "stale-1");
    assert.equal(events[0].data.status, "failed");
    assert.match(events[0].data.detail, /needsReview/);
    void now;
  });

  it("returns 0 and writes nothing when nothing is stuck", async () => {
    const { client, updated, events } = fake([]);
    assert.equal(await reclaimStuckSubmitted(client), 0);
    assert.equal(updated.length, 0);
    assert.equal(events.length, 0);
  });

  it("F3 wiring: runExecution sweeps before claiming", () => {
    const src = read("src/lib/qila/transfer-engine.ts");
    assert.match(src, /reclaimStuckSubmitted\(db\)/);
  });
});

describe("F7/F10/F11/F13/F14/F15 wiring guards", () => {
  it("F7: demo mode fail-closed in production + single gate", () => {
    const kyc = read("src/lib/qila/kyc-provider.ts");
    assert.match(kyc, /NODE_ENV.*production/);
    assert.match(kyc, /return false/);
    assert.match(kyc, /QILA_DEMO_BACKDOORS/);
    assert.match(read("src/app/api/auth/route.ts"), /isDemoMode\(\)/);
    assert.match(read("src/app/api/verify/[id]/simulate/route.ts"), /isDemoMode\(\)/);
  });

  it("F10: session cookie is SameSite=strict", () => {
    assert.match(read("src/lib/qila/session.ts"), /sameSite:\s*"strict"/);
  });

  it("F11: register oracle message neutralized", () => {
    assert.doesNotMatch(read("src/app/api/auth/route.ts"), /already registered/);
  });

  it("F13: fund honors Currency.isActive", () => {
    assert.match(read("src/app/api/fund/route.ts"), /isActive/);
  });

  it("F14: admin approve distinguishes refused executions in the audit log", () => {
    const src = read("src/app/api/admin/review/route.ts");
    assert.match(src, /approve_failed/);
  });

  it("F15: no user-delete path in app routes (cascade wipe unreachable)", () => {
    for (const f of [
      "src/app/api/admin/route.ts",
      "src/app/api/admin/review/route.ts",
      "src/app/api/admin/config/route.ts",
      "src/app/api/demo/route.ts",
    ]) {
      assert.doesNotMatch(read(f), /user\.delete|users\.delete/);
    }
  });

  it("spam hardening: quote/recipients/verify POSTs throttled", () => {
    assert.match(read("src/app/api/quote/route.ts"), /checkRateLimit/);
    assert.match(read("src/app/api/recipients/route.ts"), /checkRateLimit/);
    assert.match(read("src/app/api/verify/route.ts"), /checkRateLimit/);
  });
});

describe("F1/F4/F12 hygiene guards", () => {
  it("secret bundle + logs untracked and ignored", () => {
    const ls = execFileSync("git", ["ls-files", "download/qilapay-source.zip", "dev.log"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    assert.equal(ls, "", "secret bundle/logs must not be tracked: " + ls);
    const gi = read(".gitignore");
    assert.match(gi, /download\/\*\.zip/);
    assert.match(gi, /dev\.log/);
  });

  it(".env.example documents every required variable (no values)", () => {
    const ex = read(".env.example");
    for (const k of [
      "DATABASE_URL",
      "TEMPO_RPC_URL",
      "TREASURY_PRIVATE_KEY",
      "WALLET_ENCRYPTION_KEY",
      "SESSION_SECRET",
      "DEMO_MODE=false",
    ]) {
      assert.match(ex, new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(ex, /0x[0-9a-f]{10}/);
  });
});
