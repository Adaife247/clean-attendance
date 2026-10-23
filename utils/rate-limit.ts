// ─── utils/rate-limit.ts ───
// In-memory sliding-window rate limiter.
//
// Works: single Vercel instance, small user base.
// Fails: multi-region scaling (each instance has its own memory).
//
// To upgrade to Redis (Upstash): replace `hits` Map with a Redis call.
// Signature and behavior stay identical — only the storage layer changes.

import { RATE_LIMIT_WINDOW_MS } from './constants';

type Bucket = { count: number; resetAt: number };

const hits = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow forever
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled || typeof setInterval === 'undefined') return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits.entries()) {
      if (bucket.resetAt < now) hits.delete(key);
    }
  }, 5 * 60 * 1000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): RateLimitResult {
  scheduleCleanup();

  const now = Date.now();
  const existing = hits.get(identifier);

  if (!existing || existing.resetAt < now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs };
    hits.set(identifier, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}