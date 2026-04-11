/**
 * In-memory sliding window rate limiter.
 * Keys are typically IP addresses or user IDs.
 * Entries are lazily evicted on each check.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within rate limits.
 * @param key - Identifier (IP address, user ID, etc.)
 * @param limit - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    // New window
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Rate limit configurations by path pattern. */
export const RATE_LIMITS: {
  pattern: RegExp;
  limit: number;
  windowMs: number;
}[] = [
  { pattern: /^\/api\/auth\/login$/, limit: 10, windowMs: 60_000 },
  { pattern: /^\/api\/auth\/register$/, limit: 5, windowMs: 60_000 },
  { pattern: /^\/api\/chat$/, limit: 30, windowMs: 60_000 },
  { pattern: /^\/api\/interviews\/[^/]+\/turn$/, limit: 20, windowMs: 60_000 },
];
