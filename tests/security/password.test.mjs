import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  hashPasswordSync,
  verifyPasswordSync,
  isModernHash,
} from "../../src/lib/qila/password.ts";

// Audit C3: fast unsalted sha256 must be gone; scrypt + constant-time verify.

describe("password hashing (C3)", () => {
  it("produces versioned scrypt hashes, never bare sha256", () => {
    const h = hashPasswordSync("user@example.com", "correct-horse-42");
    assert.match(h, /^scrypt\$v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(isModernHash(h), true);
  });

  it("salts uniquely: same password -> different hashes", () => {
    const a = hashPasswordSync("a@x.com", "same-password-1");
    const b = hashPasswordSync("a@x.com", "same-password-1");
    assert.notEqual(a, b);
  });

  it("verifies correct password, rejects wrong one", () => {
    const h = hashPasswordSync("user@example.com", "s3cret-pass!");
    assert.equal(verifyPasswordSync("user@example.com", "s3cret-pass!", h), true);
    assert.equal(verifyPasswordSync("user@example.com", "wrong-pass!!", h), false);
  });

  it("email comparison is case-insensitive like the legacy scheme", () => {
    const h = hashPasswordSync("User@Example.COM", "pw-12345");
    assert.equal(verifyPasswordSync("user@example.com", "pw-12345", h), true);
  });

  it("still verifies legacy sha256 hashes (migration grace)", () => {
    const legacy = crypto
      .createHash("sha256")
      .update("legacy@x.com:old-password-9:qilapay")
      .digest("hex");
    assert.equal(isModernHash(legacy), false);
    assert.equal(verifyPasswordSync("legacy@x.com", "old-password-9", legacy), true);
    assert.equal(verifyPasswordSync("legacy@x.com", "nope-nope-nope", legacy), false);
  });

  it("rejects malformed/empty inputs without throwing", () => {
    assert.equal(verifyPasswordSync("a@b.c", "x", "not-a-hash"), false);
    assert.equal(verifyPasswordSync("a@b.c", "x", "scrypt$v1$zz$zz"), false);
    assert.equal(verifyPasswordSync("", "", ""), false);
  });
});
