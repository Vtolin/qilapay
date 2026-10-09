import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amountToMicro,
  microToMajor,
  isValidWalletAddress,
  normalizeScreeningName,
  screeningMatches,
  validateConfigPatch,
  validateTierUpdates,
  validateScreeningAction,
  computeMinAmountOut,
  isQuoteAmountCovered,
  isOverTopTier,
  buildPartialFailureDetail,
  requireEnvSecret,
} from "../../src/lib/qila/validation.ts";

// Audit M1/M2/M3/M4/L1/H3 pure-helper coverage.

describe("amountToMicro (M4: no float money)", () => {
  it("converts decimals exactly", () => {
    assert.equal(amountToMicro("10.5"), 10_500_000n);
    assert.equal(amountToMicro("0.000001"), 1n);
    assert.equal(amountToMicro(100), 100_000_000n);
  });

  it("rejects >6dp, negatives, exponents, zero, garbage", () => {
    for (const bad of ["0.0000001", "-5", "1e-7", "0", "abc", "", "12.34.56"]) {
      assert.throws(() => amountToMicro(bad), /Invalid amount|greater than 0/);
    }
  });

  it("microToMajor round-trips for display", () => {
    assert.equal(microToMajor(10_500_000n), 10.5);
  });
});

describe("wallet addresses (M2)", () => {
  it("accepts only 0x + 40 hex", () => {
    assert.equal(isValidWalletAddress("0x" + "ab".repeat(20)), true);
    for (const bad of ["", "0x123", "0x" + "zz".repeat(20), "ab".repeat(20), null, 42]) {
      assert.equal(isValidWalletAddress(bad), false);
    }
  });
});

describe("screening normalization (M3)", () => {
  it("exact-list bypass with extra spaces/punctuation now matches", () => {
    assert.equal(
      screeningMatches("Vladimir Skriponov", "Vladimir   Skriponov!!"),
      true,
    );
    assert.equal(screeningMatches("Hansi Vijayananth", "hansi vijayananth"), true);
    assert.equal(screeningMatches("Hansi Vijayananth", "Hansi Other"), false);
  });

  it("strips diacritics and collapses whitespace", () => {
    assert.equal(normalizeScreeningName("  José   García-López "), "jose garcia lopez");
  });
});

describe("config patch validation (M1)", () => {
  it("accepts a sane patch", () => {
    const out = validateConfigPatch({ fee_bps: "50", risk_corridors: '["AF","IR"]' });
    assert.deepEqual(out, { fee_bps: "50", risk_corridors: '["AF","IR"]' });
  });

  it("rejects negative fee/spread (would invert quote math)", () => {
    assert.throws(() => validateConfigPatch({ fee_bps: "-500" }), /between/);
    assert.throws(() => validateConfigPatch({ fx_spread_bps: "20000" }), /between/);
  });

  it("rejects malformed corridors (would silently disable screening)", () => {
    assert.throws(() => validateConfigPatch({ risk_corridors: "oops" }), /JSON/);
    assert.throws(() => validateConfigPatch({ risk_corridors: '["USA"]' }), /alpha-2/);
  });

  it("rejects unknown keys", () => {
    assert.throws(() => validateConfigPatch({ evil_key: "1" }), /Unknown config key/);
  });
});

describe("tier validation (M1)", () => {
  it("accepts sane tiers", () => {
    const out = validateTierUpdates([
      { tier: 1, perTxLimitUsd: 500, rolling30dLimitUsd: 2000 },
    ]);
    assert.equal(out[0].tier, 1);
  });

  it("rejects inverted/negative/unknown-method tiers", () => {
    assert.throws(
      () => validateTierUpdates([{ tier: 1, perTxLimitUsd: 5000, rolling30dLimitUsd: 100 }]),
      />=/,
    );
    assert.throws(
      () => validateTierUpdates([{ tier: 9, perTxLimitUsd: 1, rolling30dLimitUsd: 2 }]),
      /Invalid tier/,
    );
    assert.throws(
      () =>
        validateTierUpdates([
          { tier: 1, perTxLimitUsd: 1, rolling30dLimitUsd: 2, requiredMethods: ["telepathy"] },
        ]),
      /unknown methods/,
    );
  });
});

describe("screening actions (M1)", () => {
  it("only HOLD_REVIEW/BLOCK survive", () => {
    assert.equal(validateScreeningAction("BLOCK"), "BLOCK");
    assert.throws(() => validateScreeningAction("ALLOW"), /must be/);
    assert.throws(() => validateScreeningAction("block"), /must be/);
  });
});

describe("dex slippage + coverage (L1)", () => {
  it("floors live quotes by slippage bps", () => {
    assert.equal(computeMinAmountOut(1_000_000n, 100), 990_000n);
    assert.throws(() => computeMinAmountOut(1n, -1), /slippage/);
  });

  it("stale quotes below live coverage are unusable", () => {
    assert.equal(isQuoteAmountCovered(900n, 1000n), false);
    assert.equal(isQuoteAmountCovered(1000n, 1000n), true);
  });
});

describe("top-tier ceiling (M3)", () => {
  it("flags over-ceiling amounts for BLOCK", () => {
    const top = { perTxLimitUsd: 50000, rolling30dLimitUsd: 100000 };
    assert.deepEqual(isOverTopTier(1_000_000, 0, top), { overPerTx: true, overRolling: true });
    assert.deepEqual(isOverTopTier(10, 0, top), { overPerTx: false, overRolling: false });
  });
});

describe("partial-failure detail (H3)", () => {
  it("always marks refundRequired with the landed leg", () => {
    const d = buildPartialFailureDetail({ stage: "credit", debitTxHash: "0xabc", error: "boom" });
    assert.equal(d.partial, true);
    assert.equal(d.refundRequired, true);
    assert.equal(d.debitTxHash, "0xabc");
  });
});

describe("requireEnvSecret (H1/L3 fail-closed)", () => {
  it("throws in production when missing", () => {
    delete process.env.QILA_TEST_SECRET_X;
    assert.throws(
      () => requireEnvSecret("QILA_TEST_SECRET_X", { nodeEnv: "production" }),
      /not set/,
    );
  });

  it("returns env value when present", () => {
    process.env.QILA_TEST_SECRET_X = "s3cret";
    assert.equal(requireEnvSecret("QILA_TEST_SECRET_X", { nodeEnv: "production" }), "s3cret");
    delete process.env.QILA_TEST_SECRET_X;
  });
});
