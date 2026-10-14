/**
 * Rate limiting — ROUTE integration tests.
 *
 * Route wiring is inert under NODE_ENV=test by default (so every other
 * handler suite stays deterministic); this file explicitly opts in via
 * AWAKEN_RATE_LIMIT_TEST_ENABLE=1 — a flag honored ONLY in test runs —
 * and proves the live behavior on three representative routes:
 *
 * - POST /api/admin/subscriptions/confirm (STRICT): repeated wrong-secret
 *   attempts from one IP flip from 401 to 429 with a Retry-After header —
 *   failed-auth guessing is throttled before any auth work happens.
 * - POST /api/checkout (MODERATE): the budget is consumed even by
 *   malformed requests (the limiter runs first), then 429.
 * - POST /api/grimoire-otp (STRICT): code-issuance requests are capped
 *   per IP, complementing the per-code attempt cap in lib/grimoire/otp.
 *
 * Budgets are per (route group, IP): a second IP is unaffected. State is
 * reset between tests via resetRateLimitState().
 */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as adminConfirmPOST } from '../app/api/admin/subscriptions/confirm/route';
import { POST as checkoutPOST } from '../app/api/checkout/route';
import { POST as grimoireOtpPOST } from '../app/api/grimoire-otp/route';
import {
  RATE_LIMIT_TIERS,
  RATE_LIMIT_GROUPS,
  resetRateLimitState,
} from '../lib/security/rate-limit';

const STRICT = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS['admin-confirm']];
const MODERATE = RATE_LIMIT_TIERS[RATE_LIMIT_GROUPS.checkout];

/* Admin-confirm fixtures: temp ledger + a test-only owner secret. */
const DIR = mkdtempSync(join(tmpdir(), 'rl-admin-confirm-'));
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
writeFileSync(SUBS_LEDGER, '', 'utf8');
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;
const SECRET = 'rl-test-owner-secret';
const ORIGINAL_SECRET = process.env.OWNER_ADMIN_SECRET;

function request(url: string, ip: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE = '1';
  resetRateLimitState();
});

afterEach(() => {
  resetRateLimitState();
});

afterAll(() => {
  delete process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE;
  if (ORIGINAL_SECRET === undefined) delete process.env.OWNER_ADMIN_SECRET;
  else process.env.OWNER_ADMIN_SECRET = ORIGINAL_SECRET;
  resetRateLimitState();
});

describe('POST /api/admin/subscriptions/confirm — failed-auth throttling', () => {
  it('flips wrong-secret attempts from 401 to 429 with Retry-After', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const ip = '203.0.113.10';
    const attempt = () =>
      adminConfirmPOST(
        request(
          'http://localhost/api/admin/subscriptions/confirm',
          ip,
          { email: 'member@example.com' },
          { 'x-owner-secret': 'wrong-secret-guess' },
        ),
      );

    for (let i = 0; i < STRICT.limit; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(STRICT.windowMs / 1000);
    const body = (await blocked.json()) as { ok: boolean; errors: string[] };
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);

    // A different IP still has its own budget — it gets the auth answer.
    const other = await adminConfirmPOST(
      request(
        'http://localhost/api/admin/subscriptions/confirm',
        '203.0.113.11',
        { email: 'member@example.com' },
        { 'x-owner-secret': 'wrong-secret-guess' },
      ),
    );
    expect(other.status).toBe(401);
  });
});

describe('POST /api/checkout — moderate write budget', () => {
  it('answers 429 once the per-IP budget is spent', async () => {
    const ip = '198.51.100.20';
    const attempt = () =>
      checkoutPOST(
        request('http://localhost/api/checkout', ip, 'not-json'),
      );

    // The limiter runs before body parsing: malformed requests consume
    // budget and fail as usual (400) until the budget is gone.
    for (let i = 0; i < MODERATE.limit; i++) {
      const res = await attempt();
      expect(res.status).toBe(400);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('POST /api/grimoire-otp — strict issuance budget', () => {
  it('caps code-issuance requests per IP', async () => {
    const ip = '192.0.2.30';
    const attempt = () =>
      grimoireOtpPOST(
        request('http://localhost/api/grimoire-otp', ip, {
          action: 'request',
          email: 'seeker@example.com',
        }),
      );

    for (let i = 0; i < STRICT.limit; i++) {
      const res = await attempt();
      expect(res.status).toBe(200);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
  });
});

describe('default test behavior — wiring stays inert without the opt-in', () => {
  it('never 429s when AWAKEN_RATE_LIMIT_TEST_ENABLE is unset', async () => {
    delete process.env.AWAKEN_RATE_LIMIT_TEST_ENABLE;
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const ip = '203.0.113.99';
    for (let i = 0; i < STRICT.limit + 3; i++) {
      const res = await adminConfirmPOST(
        request(
          'http://localhost/api/admin/subscriptions/confirm',
          ip,
          { email: 'member@example.com' },
          { 'x-owner-secret': 'wrong-secret-guess' },
        ),
      );
      expect(res.status).toBe(401);
    }
  });
});
