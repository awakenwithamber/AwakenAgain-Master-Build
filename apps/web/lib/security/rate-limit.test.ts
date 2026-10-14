/**
 * Rate limiter unit tests — the REAL logic, exercised directly through
 * createRateLimiter() with an injectable clock (routes stay inert under
 * NODE_ENV=test; route-level 429 behavior is proven separately in
 * tests/security-rate-limit-routes.test.ts).
 *
 * Laws under test:
 * - A (group, IP) pair may consume up to its tier limit inside the
 *   window; the next request is denied with a sane Retry-After.
 * - The window SLIDES: once the oldest request ages out, budget returns.
 * - Budgets are isolated per IP and per route group.
 * - Tier assignment matches the route-group contract (strict for the
 *   sensitive endpoints, moderate for writes, generous for reads).
 * - Client-IP derivation: x-forwarded-for first entry → x-real-ip →
 *   the shared 'unknown' bucket.
 * - Enforcement is off under NODE_ENV=test unless a test opts in.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  RATE_LIMIT_GROUPS,
  RATE_LIMIT_TIERS,
  clientIpFromHeaders,
  createRateLimiter,
  rateLimitEnforced,
} from './rate-limit';

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows up to the tier limit, then denies with Retry-After', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ now: clock.now });
    const { limit } = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS.checkout];

    for (let i = 0; i < limit; i++) {
      expect(limiter.consume('checkout', '203.0.113.7').allowed).toBe(true);
    }
    const denied = limiter.consume('checkout', '203.0.113.7');
    expect(denied.allowed).toBe(false);
    // Oldest request was at t0 with a 60s window → ~60s until it expires.
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('slides: budget returns as the oldest requests age out', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ now: clock.now });
    const tier = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS['grimoire-otp']];

    for (let i = 0; i < tier.limit; i++) {
      expect(limiter.consume('grimoire-otp', '198.51.100.2').allowed).toBe(true);
    }
    expect(limiter.consume('grimoire-otp', '198.51.100.2').allowed).toBe(false);

    // Just past the window, every original request has expired.
    clock.advance(tier.windowMs + 1);
    expect(limiter.consume('grimoire-otp', '198.51.100.2').allowed).toBe(true);
  });

  it('Retry-After counts down toward the oldest request expiry', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ now: clock.now });
    const tier = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS['admin-confirm']];

    for (let i = 0; i < tier.limit; i++) {
      limiter.consume('admin-confirm', '192.0.2.9');
    }
    const first = limiter.consume('admin-confirm', '192.0.2.9');
    clock.advance(60_000);
    const later = limiter.consume('admin-confirm', '192.0.2.9');
    expect(first.allowed).toBe(false);
    expect(later.allowed).toBe(false);
    expect(later.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds);
  });

  it('isolates budgets per IP and per route group', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ now: clock.now });
    const tier = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS.contact];

    for (let i = 0; i < tier.limit; i++) {
      limiter.consume('contact', '203.0.113.1');
    }
    expect(limiter.consume('contact', '203.0.113.1').allowed).toBe(false);
    // A different IP has its own budget…
    expect(limiter.consume('contact', '203.0.113.2').allowed).toBe(true);
    // …and so does the same IP on a different route group.
    expect(limiter.consume('checkout', '203.0.113.1').allowed).toBe(true);
  });

  it('reset() clears all counters', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ now: clock.now });
    const tier = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS.newsletter];

    for (let i = 0; i < tier.limit; i++) {
      limiter.consume('newsletter', '203.0.113.5');
    }
    expect(limiter.consume('newsletter', '203.0.113.5').allowed).toBe(false);
    limiter.reset();
    expect(limiter.consume('newsletter', '203.0.113.5').allowed).toBe(true);
  });
});

describe('route-group tier contract', () => {
  it('assigns strict budgets to the sensitive endpoints', () => {
    expect(RATE_LIMIT_GROUPS['admin-confirm']).toBe('strict');
    expect(RATE_LIMIT_GROUPS['grimoire-otp']).toBe('strict');
  });

  it('assigns generous budgets to the polled reads', () => {
    expect(RATE_LIMIT_GROUPS['reviews-read']).toBe('generous');
    expect(RATE_LIMIT_GROUPS['grimoire-otp-session']).toBe('generous');
  });

  it('orders the tiers strict < moderate < generous in effective rate', () => {
    const rate = (t: (typeof RATE_LIMIT_TIERS)[keyof typeof RATE_LIMIT_TIERS]) =>
      t.limit / t.windowMs;
    expect(rate(RATE_LIMIT_TIERS.strict)).toBeLessThan(
      rate(RATE_LIMIT_TIERS.moderate),
    );
    expect(rate(RATE_LIMIT_TIERS.moderate)).toBeLessThan(
      rate(RATE_LIMIT_TIERS.generous),
    );
  });
});

describe('clientIpFromHeaders', () => {
  function headers(init: Record<string, string>): Headers {
    return new Headers(init);
  }

  it('takes the first x-forwarded-for entry (the original client)', () => {
    expect(
      clientIpFromHeaders(
        headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.4' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to the shared unknown bucket', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.4' }))).toBe(
      '198.51.100.4',
    );
    expect(clientIpFromHeaders(headers({}))).toBe('unknown');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '  ' }))).toBe(
      'unknown',
    );
  });
});

describe('rateLimitEnforced (test seam)', () => {
  const ORIGINAL = process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE;
    else process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE = ORIGINAL;
  });

  it('is inert under NODE_ENV=test unless a test opts in', () => {
    delete process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE;
    expect(process.env.NODE_ENV).toBe('test');
    expect(rateLimitEnforced()).toBe(false);
    process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE = '1';
    expect(rateLimitEnforced()).toBe(true);
  });
});
