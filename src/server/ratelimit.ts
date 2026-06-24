/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single-instance internal tool. For multi-instance/serverless
 * deployments, replace the Map with a shared store (Redis, Cloudflare KV, or a
 * Durable Object) — the interface stays the same.
 */
import { Errors } from './errors'

const hits = new Map<string, number[]>()

interface RateResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  maybeCleanup(now)
  const cutoff = now - windowMs
  const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff)

  if (timestamps.length >= limit) {
    const retryAfterMs = Math.max(0, timestamps[0] + windowMs - now)
    hits.set(key, timestamps)
    return { ok: false, remaining: 0, retryAfterMs }
  }

  timestamps.push(now)
  hits.set(key, timestamps)
  return { ok: true, remaining: limit - timestamps.length, retryAfterMs: 0 }
}

/** Rate-limit and throw a 429 AppError if the limit is exceeded. */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message?: string,
): void {
  const result = rateLimit(key, limit, windowMs)
  if (!result.ok) {
    const secs = Math.ceil(result.retryAfterMs / 1000)
    throw Errors.rateLimited(
      message ?? `Too many attempts. Try again in ${secs} second${secs === 1 ? '' : 's'}.`,
    )
  }
}

// Opportunistic eviction of stale buckets, driven from rateLimit() rather than a
// global-scope timer (the Workers runtime disallows setInterval at module load).
let lastCleanup = 0
function maybeCleanup(now: number): void {
  if (now - lastCleanup < 10 * 60 * 1000) return
  lastCleanup = now
  for (const [key, timestamps] of hits) {
    // Drop buckets untouched for over an hour.
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - 60 * 60 * 1000) {
      hits.delete(key)
    }
  }
}
