import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits } from "../../src/lib/qila/rate-limit.ts";

// Audit M5/H5: abuse controls exist and behave.

describe("fixed-window rate limiter", () => {
  it("allows up to the limit, then blocks with retryAfterMs", () => {
    resetRateLimits();
    const spec = { limit: 3, windowMs: 60_000 };
    assert.equal(checkRateLimit("k1", spec, 1000).allowed, true);
    assert.equal(checkRateLimit("k1", spec, 1001).allowed, true);
    assert.equal(checkRateLimit("k1", spec, 1002).allowed, true);
    const blocked = checkRateLimit("k1", spec, 1003);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
  });

  it("resets after the window and isolates keys", () => {
    resetRateLimits();
    const spec = { limit: 1, windowMs: 1000 };
    assert.equal(checkRateLimit("a", spec, 0).allowed, true);
    assert.equal(checkRateLimit("b", spec, 0).allowed, true);
    assert.equal(checkRateLimit("a", spec, 500).allowed, false);
    assert.equal(checkRateLimit("a", spec, 1000).allowed, true);
  });
});
