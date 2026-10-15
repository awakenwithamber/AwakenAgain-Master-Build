/**
 * API rate limiting — per-instance, best-effort abuse blunting.
 *
 * WHAT THIS IS: a small in-memory sliding-window limiter wired into every
 * live route under app/api/ (see `enforceRateLimit`). It caps how many
 * requests one client IP can make to a route group inside a window and
 * answers 429 (with `Retry-After`) once the budget is spent.
 *
 * WHAT THIS IS NOT — read before trusting it:
 * - State lives in THIS process's memory. On serverless hosting every
 *   instance keeps its own counters, instances are recycled without
 *   notice, and an attacker spread across instances gets the budget
 *   multiplied by the instance count. This BLUNTS naive abuse (form
 *   floods, credential guessing from one source, OTP request spam); it
 *   is NOT a distributed guarantee.
 * - A shared-store limiter (durable counters every instance consults)
 *   belongs with the durable-data decision, which is still open — when
 *   that store lands, this module's interface is the seam: swap the
 *   bucket storage, keep the groups/tiers contract.
 * - Client identity is the platform-provided forwarding headers
 *   (`x-forwarded-for`, then `x-real-ip`). Behind Vercel those are set
 *   by the platform; when neither header is present the client shares
 *   the single 'unknown' bucket, which fails SAFE (one shared budget)
 *   rather than open.
 *
 * RELATIONSHIP TO EXISTING CONTROLS: this is the only request-rate
 * limiter in the codebase. lib/grimoire/otp.ts separately caps VERIFY
 * attempts per issued code (OTP_MAX_ATTEMPTS = 5) — a per-code control
 * that complements, and is not replaced by, the per-IP request budget
 * on the OTP route below.
 *
 * TEST SEAM: route wiring is inert while NODE_ENV === 'test' so the
 * handler-level suites (which import route handlers directly and fire
 * many synthetic requests) stay deterministic. A test opts in by setting
 * AWAKEN_RATE_LIMIT_TEST_ENABLE=1 — a flag that has effect ONLY under
 * NODE_ENV=test. The limiter's own unit tests exercise the real logic
 * through createRateLimiter() with an injectable clock.
 */
import { NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

export interface RateLimitTier {
  /** Max requests allowed inside the window, per route group + IP. */
  limit: number;
  /** Sliding window length, milliseconds. */
  windowMs: number;
}

export const RATE_LIMIT_TIERS = {
  /**
   * Sensitive endpoints. The admin-confirm budget caps ALL requests to
   * the route, so failed-auth guessing from one IP is throttled to 10
   * tries per 10 minutes regardless of which secret is presented; the
   * owner's legitimate confirmations are rare, deliberate actions.
   * The OTP budget caps code issuance + verification requests together
   * (the per-code attempt cap in lib/grimoire/otp.ts still applies
   * inside a single issued code).
   */
  strict: { limit: 10, windowMs: 10 * 60_000 },
  /** Write endpoints a human uses a handful of times per visit. */
  moderate: { limit: 30, windowMs: 60_000 },
  /** Cheap reads polled by components (session checks, review lists). */
  generous: { limit: 300, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitTier>;

export type RateLimitTierName = keyof typeof RATE_LIMIT_TIERS;

/** Every rate-limited route group → its budget tier. */
export const RATE_LIMIT_GROUPS = {
  'admin-confirm': 'strict',
  /**
   * Phase 2 owner-secret admin writes (order tracking, subscription
   * cancel, broadcast record) — same STRICT budget as admin-confirm for
   * the same reason: it caps failed-auth guessing against
   * OWNER_ADMIN_SECRET before any auth work happens.
   */
  admin: 'strict',
  'grimoire-otp': 'strict',
  'grimoire-otp-session': 'generous',
  /**
   * Account sign-in (Phase 3 Step 3): code request + verify share the
   * STRICT budget for the same reason as grimoire-otp — it caps code
   * guessing per IP; the per-code attempt cap applies inside as well.
   */
  'account-auth': 'strict',
  /** Account profile writes (likes/searches/progress/delete). */
  account: 'moderate',
  /** Account reads (profile view, export download). */
  'account-read': 'generous',
  checkout: 'moderate',
  orders: 'moderate',
  subscriptions: 'moderate',
  contact: 'moderate',
  newsletter: 'moderate',
  'quiz-lead': 'moderate',
  'affiliate-interest': 'moderate',
  'partner-idea': 'moderate',
  'reviews-write': 'moderate',
  'reviews-read': 'generous',
  'ai-chat': 'moderate',
} as const satisfies Record<string, RateLimitTierName>;

export type RateLimitGroup = keyof typeof RATE_LIMIT_GROUPS;

/* ------------------------------------------------------------------ */
/* Client identity                                                     */
/* ------------------------------------------------------------------ */

/**
 * Client IP from the platform forwarding headers. `x-forwarded-for`
 * carries the chain "client, proxy1, proxy2…" — the first entry is the
 * original client. Falls back to `x-real-ip`, then to the shared
 * 'unknown' bucket when the platform provided neither.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Limiter core (injectable clock — unit-tested directly)              */
/* ------------------------------------------------------------------ */

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the oldest in-window request expires (when denied). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Record one request for (group, key); report whether it is allowed. */
  consume(group: RateLimitGroup, key: string): RateLimitDecision;
  /** Drop all counters (test support; also bounds memory in tests). */
  reset(): void;
}

export function createRateLimiter(
  options: { now?: () => number } = {},
): RateLimiter {
  const now = options.now ?? Date.now;
  /** bucketKey → ascending request timestamps (ms) inside the window. */
  const buckets = new Map<string, number[]>();

  function prune(timestamps: number[], windowMs: number, at: number): number[] {
    const cutoff = at - windowMs;
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= cutoff) i += 1;
    return i === 0 ? timestamps : timestamps.slice(i);
  }

  return {
    consume(group, key) {
      const tier = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS[group]];
      const bucketKey = `${group}:${key}`;
      const at = now();
      const existing = buckets.get(bucketKey);
      const inWindow = existing ? prune(existing, tier.windowMs, at) : [];

      if (inWindow.length >= tier.limit) {
        if (inWindow.length === 0) buckets.delete(bucketKey);
        else buckets.set(bucketKey, inWindow);
        const oldest = inWindow[0];
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((oldest + tier.windowMs - at) / 1000),
          ),
        };
      }

      inWindow.push(at);
      buckets.set(bucketKey, inWindow);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset() {
      buckets.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Route wiring (shared instance + thin helper)                        */
/* ------------------------------------------------------------------ */

const sharedLimiter = createRateLimiter();

/**
 * True when route-level enforcement applies. Inert under NODE_ENV=test
 * unless a test explicitly opts in (AWAKEN_RATE_LIMIT_TEST_ENABLE=1,
 * honored only in test runs) — production behavior has no off switch.
 */
export function rateLimitEnforced(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE === '1';
  }
  return true;
}

/** Test support: clear the shared limiter's counters. */
export function resetRateLimitState(): void {
  sharedLimiter.reset();
}

/**
 * Route helper — call first in a handler:
 *
 *   const limited = enforceRateLimit(request, 'checkout');
 *   if (limited) return limited;
 *
 * Returns null when the request may proceed; otherwise the 429 response
 * in the codebase's { ok: false, errors } shape with a Retry-After
 * header (seconds).
 */
export function enforceRateLimit(
  request: Request,
  group: RateLimitGroup,
): NextResponse | null {
  if (!rateLimitEnforced()) return null;
  const decision = sharedLimiter.consume(
    group,
    clientIpFromHeaders(request.headers),
  );
  if (decision.allowed) return null;
  return NextResponse.json(
    {
      ok: false,
      errors: ['Too many requests. Please wait a moment and try again.'],
    },
    {
      status: 429,
      headers: { 'Retry-After': String(decision.retryAfterSeconds) },
    },
  );
}
