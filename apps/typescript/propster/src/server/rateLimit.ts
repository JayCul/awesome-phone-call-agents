import "server-only";

import { ApiError } from "./http";

/**
 * In-process fixed-window rate limiter.
 *
 * Sufficient for a single-instance MVP. Placing a phone call costs real money
 * and rings a real person, so the verify endpoint is limited far more tightly
 * than search.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  search: { limit: 20, windowMs: 60_000 },
  verify: { limit: 6, windowMs: 60_000 },
  // Creating a test property is the precursor to dialling a number a stranger
  // typed, so it is the tightest bucket in the app.
  testProperty: { limit: 4, windowMs: 10 * 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export function enforceRateLimit(bucket: string, identity: string, rule: RateLimitRule): void {
  const key = bucket + ":" + identity;
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    pruneExpired(now);
    return;
  }

  if (existing.count >= rule.limit) {
    const seconds = Math.ceil((existing.resetAt - now) / 1000);
    throw ApiError.rateLimited("Too many requests. Try again in " + seconds + "s.");
  }

  existing.count += 1;
}

/** Derive a caller identity from proxy headers, falling back to a shared key. */
export function callerIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function pruneExpired(now: number): void {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}
