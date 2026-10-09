/**
 * Minimal in-memory fixed-window rate limiter (audit M5/H5).
 *
 * Single-instance only: each server instance tracks its own counters. Behind
 * multiple replicas this degrades to per-instance limits — acceptable for this
 * deployment (standalone server), documented here so it is not mistaken for
 * distributed rate limiting.
 */

export type RateLimit = { limit: number; windowMs: number };
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimit,
  now = Date.now(),
): RateLimitResult {
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (cur.count < limit) {
    cur.count += 1;
    return { allowed: true, remaining: limit - cur.count, retryAfterMs: 0 };
  }
  return { allowed: false, remaining: 0, retryAfterMs: cur.resetAt - now };
}

/** Test/support helper: clear all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
