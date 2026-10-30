// ─── utils/rate-limit.ts ───
// Production: Upstash Redis sliding-window (shared across all lambdas).
// Dev / no Upstash env: in-memory Map fallback (advisory only).
//
// IMPORTANT: checkRateLimit is now async. Every caller must await it.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RATE_LIMIT_WINDOW_MS } from './constants';
import { scoped } from './logger';

const log = scoped('rate-limit');

// ── Upstash setup (only if env is present) ──
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(upstashUrl && upstashToken);

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number): Ratelimit {
  const key = `${limit}:${RATE_LIMIT_WINDOW_MS}`;
  const existing = limiters.get(key);
  if (existing) return existing;

  if (!redis) {
    redis = new Redis({ url: upstashUrl!, token: upstashToken! });
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${RATE_LIMIT_WINDOW_MS} ms`),
    analytics: false,
    prefix: 'campuscheck:rl',
  });
  limiters.set(key, limiter);
  return limiter;
}

// ── In-memory fallback (dev / no Upstash) ──
type Bucket = { count: number; resetAt: number };
const hits = new Map<string, Bucket>();
const MAX_MAP_SIZE = 5000;

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

function checkInMemory(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  scheduleCleanup();
  const now = Date.now();
  const existing = hits.get(identifier);

  if (!existing || existing.resetAt < now) {
    if (hits.size >= MAX_MAP_SIZE) {
      const keysToDelete = Array.from(hits.keys()).slice(0, 1000);
      keysToDelete.forEach((k) => hits.delete(k));
    }
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

// ── Public API ──
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<RateLimitResult> {
  if (!useUpstash) {
    if (!warnedNoUpstash && process.env.NODE_ENV === 'production') {
      log.warn(
        'UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to per-instance in-memory rate limiting. This is NOT production-safe.'
      );
      warnedNoUpstash = true;
    }
    return checkInMemory(identifier, limit, windowMs);
  }

  try {
    const limiter = getUpstashLimiter(limit);
    const res = await limiter.limit(identifier);
    return {
      allowed: res.success,
      remaining: res.remaining,
      resetAt: res.reset,
    };
  } catch (err) {
    log.error('Upstash rate limit check failed — failing OPEN', err);
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

let warnedNoUpstash = false;

export function getClientIp(request: Request): string {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    const first = vercelForwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return `unknown-${Math.random().toString(36).slice(2, 10)}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}