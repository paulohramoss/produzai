// Best-effort in-memory rate limiter for the AI serverless functions.
//
// State lives at module scope, so it is shared only within a single warm
// instance — NOT globally across the whole deployment. Under high concurrency
// Vercel may spin up several instances, each with its own counters, which
// weakens the limit proportionally. It is intended as a cheap cost/abuse guard
// against a single authenticated user hammering one endpoint, not as a strict
// global quota. For a hard global limit, back this with Vercel KV, Upstash
// Redis, or a Firestore counter.

const buckets = new Map() // key -> { count, resetAt }

/**
 * Fixed-window counter.
 * @param {string} key            Unique bucket key (e.g. `completion:${uid}`).
 * @param {object} opts
 * @param {number} opts.limit     Max requests allowed per window.
 * @param {number} opts.windowMs  Window length in milliseconds.
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count++

  // Opportunistic cleanup so the Map can't grow unbounded across many uids.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k)
    }
  }

  const allowed = bucket.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  }
}
