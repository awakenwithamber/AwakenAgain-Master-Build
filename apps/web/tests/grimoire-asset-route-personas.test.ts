/**
 * Gated asset route — PERSONA MATRIX (owner requirement,
 * SECURITY-ONLY release, 2026-11-07).
 *
 * "Nobody currently paying gets locked out." Every persona below
 * is resolved by the CURRENT, unmodified entitlement code on main
 * (lib/grimoire/entitlement → subscriptions + unlock + keeper) —
 * the same resolver the live reader page uses — and must see
 * EXACTLY what they see on the live site today, except that the
 * free preview is the only thing public:
 *
 *   1. visitor            → preview assets 200, gated assets 401
 *   2. active subscriber  → gated assets 200 (full access, as today)
 *   3. lapsed subscriber  → gated assets 403 — where "lapsed" means
 *      what it means TODAY: past_due past the 3-day grace, or
 *      cancelled. A subscriber INSIDE the grace window is still
 *      entitled today and still gets 200 here.
 *   4. permanent-unlock holder (legacy record — the only shape the
 *      current ledger writes; no access_model field exists) →
 *      gated assets 200, however old the grant. A REVOKED unlock
 *      (refund/chargeback) → 403, as today.
 *   5. admin/owner — on the live site the owner's book access runs
 *      through the same resolver; the owner-grade source is the
 *      KEEPER list (server env). Keeper + verified session → 200.
 *      Keeper email with NO session → 401 (an email alone grants
 *      nothing, as today).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { GET } from '../app/api/grimoire-assets/[...asset]/route';
import { grimoireAssetPageMap } from '../lib/grimoire/asset-map';
import { resolveGrimoireEntitlement } from '../lib/grimoire/entitlement';
import {
  GRIMOIRE_SESSION_COOKIE,
  getSharedOtpStore,
  requestOtp,
  verifyOtp,
} from '../lib/grimoire/otp';
import {
  findLatestUnlock,
  grantUnlock,
  revokeUnlockByTransactionRef,
} from '../lib/grimoire/unlock';

const DAY = 24 * 60 * 60 * 1000;
const assetMap = grimoireAssetPageMap();
/** Preview assets (earliest composed page ≤16) — public today. */
const SEPHER_SAMPLE = 'sepher-sephiroth/page-017.jpg'; // composed p.9
const WAITE_COVER = 'book-of-ceremonial-magic-waite-1913/cover.jpg'; // composed p.10
/** A gated asset from the same book as a preview sample. */
const SEPHER_GATED = 'sepher-sephiroth/page-018.jpg';
/** A REMOVED work's asset (owner decision 2026-11-08): the Book of
 *  Raziel left the compilation, so its keys are no longer in the
 *  asset map at all and the route must 404 them for EVERY persona —
 *  not 401/403-with-content, and not 200 for the entitled. */
const REMOVED_ASSET = 'book-of-raziel/page-01.jpg';

const ENV_KEYS = [
  'DATABASE_URL',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'GRIMOIRE_KEEPER_EMAILS',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  delete process.env.DATABASE_URL;
  delete process.env.GRIMOIRE_KEEPER_EMAILS;
  const dir = mkdtempSync(join(tmpdir(), 'grimoire-personas-'));
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(dir, 'subs.jsonl');
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = join(dir, 'unlocks.jsonl');
  writeSubscriptions([]);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** The record shape the live subscribe/confirm flow writes. */
function subscriptionRecord(
  email: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    subscription_id: 'SUB-TEST-PERSONA',
    created_at: '2026-10-21T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-21T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
    ...extra,
  };
}

function writeSubscriptions(records: unknown[]) {
  writeFileSync(
    process.env.SUBSCRIPTIONS_LEDGER_PATH!,
    records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''),
    'utf8',
  );
}

async function mintSession(email: string): Promise<string> {
  const store = getSharedOtpStore();
  const { request, code } = await requestOtp(store, email);
  const verified = await verifyOtp(store, request.request_id, code);
  if (!verified.ok) throw new Error('session mint failed');
  return verified.session.session_token;
}

function callRoute(key: string, token?: string) {
  return GET(
    new Request(`http://localhost/api/grimoire-assets/${key}`, {
      headers: token ? { cookie: `${GRIMOIRE_SESSION_COOKIE}=${token}` } : {},
    }),
    { params: Promise.resolve({ asset: key.split('/') }) },
  );
}

describe('persona matrix against the gated asset route', () => {
  it('boundary pins: the samples are preview assets, a deep Sepher page is gated, removed works are unmapped', () => {
    expect(assetMap.get(SEPHER_SAMPLE)).toBeLessThanOrEqual(16);
    expect(assetMap.get(WAITE_COVER)).toBeLessThanOrEqual(16);
    expect(assetMap.get(SEPHER_GATED)).toBeGreaterThan(16);
    expect(assetMap.has(REMOVED_ASSET)).toBe(false);
    expect(assetMap.has('albertus-magnus-egyptian-secrets/page-001.jpg')).toBe(false);
    expect(assetMap.has('grimorium-verum/img-000.png')).toBe(false);
    expect(assetMap.has('emerald-tablet-of-hermes/cover.jpg')).toBe(false);
  });

  it('1. VISITOR (no session): preview public, everything else refused', async () => {
    expect((await callRoute(SEPHER_SAMPLE)).status).toBe(200);
    expect((await callRoute(WAITE_COVER)).status).toBe(200);
    expect((await callRoute(SEPHER_GATED)).status).toBe(401);
    expect((await callRoute(REMOVED_ASSET)).status).toBe(404);
    const r = await resolveGrimoireEntitlement(null);
    expect(r.entitled).toBe(false);
  });

  it('2. ACTIVE SUBSCRIBER: full access, exactly as today', async () => {
    writeSubscriptions([subscriptionRecord('member@example.com', 'active')]);
    const token = await mintSession('member@example.com');
    const res = await callRoute(SEPHER_GATED, token);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect((await callRoute(SEPHER_SAMPLE, token)).status).toBe(200);
    const r = await resolveGrimoireEntitlement('member@example.com');
    expect(r.entitled).toBe(true);
    expect(r.is_subscriber).toBe(true);
  });

  it('3a. LAPSED SUBSCRIBER (past_due beyond the 3-day grace): refused, as today', async () => {
    writeSubscriptions([
      subscriptionRecord('lapsed@example.com', 'past_due', {
        past_due_since: new Date(Date.now() - 10 * DAY).toISOString(),
      }),
    ]);
    const token = await mintSession('lapsed@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(403);
    // The free preview is still theirs, like everyone else's.
    expect((await callRoute(SEPHER_SAMPLE, token)).status).toBe(200);
    const r = await resolveGrimoireEntitlement('lapsed@example.com');
    expect(r.entitled).toBe(false);
  });

  it('3b. SUBSCRIBER INSIDE THE GRACE WINDOW (past_due, day 1): still entitled — NOT locked out', async () => {
    writeSubscriptions([
      subscriptionRecord('grace@example.com', 'past_due', {
        past_due_since: new Date(Date.now() - 1 * DAY).toISOString(),
      }),
    ]);
    const token = await mintSession('grace@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(200);
    const r = await resolveGrimoireEntitlement('grace@example.com');
    expect(r.entitled).toBe(true);
  });

  it('3c. CANCELLED SUBSCRIBER: refused, as today', async () => {
    writeSubscriptions([
      subscriptionRecord('gone@example.com', 'active'),
      subscriptionRecord('gone@example.com', 'cancelled'),
    ]);
    const token = await mintSession('gone@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(403);
    const r = await resolveGrimoireEntitlement('gone@example.com');
    expect(r.entitled).toBe(false);
  });

  it('6. REMOVED WORKS: 404 for every persona, entitled or not', async () => {
    // The route resolves the asset map BEFORE any auth: an unmapped
    // key is a 404 even with a fully entitled session — the removed
    // works are not hidden behind the gate, they are GONE.
    writeSubscriptions([subscriptionRecord('member@example.com', 'active')]);
    const token = await mintSession('member@example.com');
    for (const key of [
      REMOVED_ASSET,
      'book-of-raziel/page-02.jpg',
      'albertus-magnus-egyptian-secrets/page-001.jpg',
      'grimorium-verum/img-000.png',
      'emerald-tablet-of-hermes/cover.jpg',
    ]) {
      expect((await callRoute(key)).status, key).toBe(404);
      expect((await callRoute(key, token)).status, key).toBe(404);
    }
  });

  it('4. PERMANENT-UNLOCK HOLDER (legacy record shape): full access, however old the grant', async () => {
    const record = await grantUnlock({
      email: 'holder@example.com',
      transaction_ref: 'LEGACY-2025-001',
      source: 'owner_manual',
      effective_at: '2025-06-01T00:00:00.000Z',
    });
    // The legacy shape IS the only shape the current ledger writes:
    // no timed-access field exists on it, and none is needed.
    expect(record.state).toBe('active');
    expect(record).not.toHaveProperty('access_model');
    const stored = await findLatestUnlock('holder@example.com');
    expect(stored).not.toHaveProperty('access_model');
    const token = await mintSession('holder@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(200);
    const r = await resolveGrimoireEntitlement('holder@example.com');
    expect(r.entitled).toBe(true);
    expect(r.has_permanent_unlock).toBe(true);
  });

  it('4b. REVOKED UNLOCK (refund): refused, as today', async () => {
    await grantUnlock({
      email: 'refunded@example.com',
      transaction_ref: 'LEGACY-2025-002',
      source: 'owner_manual',
    });
    await revokeUnlockByTransactionRef('LEGACY-2025-002', 'refund');
    const token = await mintSession('refunded@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(403);
    const r = await resolveGrimoireEntitlement('refunded@example.com');
    expect(r.entitled).toBe(false);
  });

  it('5. ADMIN / OWNER (keeper): full access with a verified session; the email alone grants nothing', async () => {
    process.env.GRIMOIRE_KEEPER_EMAILS = 'owner@example.com';
    // No session → refused even for the keeper's own email.
    expect((await callRoute(SEPHER_GATED)).status).toBe(401);
    const token = await mintSession('owner@example.com');
    expect((await callRoute(SEPHER_GATED, token)).status).toBe(200);
    const r = await resolveGrimoireEntitlement('owner@example.com');
    expect(r.entitled).toBe(true);
    expect(r.is_keeper).toBe(true);
  });
});
