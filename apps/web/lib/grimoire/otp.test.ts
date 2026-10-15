/**
 * OTP contract — G8.
 *
 * Laws under test:
 * - requestOtp validates email; returns a request descriptor + one-time
 *   plaintext code.
 * - verifyOtp: correct code → session; wrong code → mismatch; single use
 *   (consumed); 5 failed attempts burn the request; expiry honored.
 * - Codes are stored hashed, never plaintext.
 * - getValidSession: valid → session; expired → pruned/null; unknown → null.
 * - createSupabaseOtpStore refuses to run (binding NEEDS VERIFICATION).
 * - Contract is store-agnostic: flows work against the OtpStore interface.
 * - Entitlement (audit 2026-10-15 GAP-4): with an entitlement check bound,
 *   a correct code for a non-entitled email grants NO session
 *   ('not_entitled'), does not consume the code, and fails closed when
 *   the checker throws or no subscription record exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InMemoryOtpStore,
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  createSupabaseOtpStore,
  getValidSession,
  requestOtp,
  verifyOtp,
  type OtpStore,
} from './otp';
import { isEntitledSubscriberAsync } from '../subscriptions/entitlement';

function freshStore(): OtpStore {
  return new InMemoryOtpStore();
}

describe('requestOtp', () => {
  it('issues a request with a 6-digit code and TTL', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'customer@example.com');
    expect(request.request_id).toMatch(/^otp_/);
    expect(request.expires_in_seconds).toBe(OTP_TTL_SECONDS);
    expect(request.purpose).toBe('grimoire_gate');
    expect(code).toMatch(/^\d{6}$/);
    expect(OTP_CODE_LENGTH).toBe(6);
  });

  it('rejects invalid email', async () => {
    await expect(requestOtp(freshStore(), 'not-an-email')).rejects.toThrow();
    await expect(requestOtp(freshStore(), '')).rejects.toThrow();
  });

  it('stores the code hashed, never plaintext', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'customer@example.com');
    const persisted = await store.getCodeRequest(request.request_id);
    expect(persisted).not.toBeNull();
    expect(persisted!.code_hash).not.toContain(code);
  });
});

describe('verifyOtp', () => {
  it('verifies a correct code and issues a session', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'customer@example.com');
    const result = await verifyOtp(store, request.request_id, code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.session_token.length).toBeGreaterThanOrEqual(32);
      expect(result.session.email).toBe('customer@example.com');
      expect(result.session.expires_at).toBeGreaterThan(result.session.issued_at);
    }
  });

  it('is single-use: the same code cannot verify twice', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'customer@example.com');
    expect((await verifyOtp(store, request.request_id, code)).ok).toBe(true);
    const again = await verifyOtp(store, request.request_id, code);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('not_found');
  });

  it('wrong codes mismatch; 5 attempts burn the request', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'customer@example.com');
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await verifyOtp(store, request.request_id, wrong);
      expect(r.ok).toBe(false);
    }
    const burned = await verifyOtp(store, request.request_id, code);
    expect(burned.ok).toBe(false);
    if (!burned.ok) {
      expect(['too_many_attempts', 'not_found']).toContain(burned.reason);
    }
  });

  it('unknown request ids are rejected', async () => {
    const result = await verifyOtp(freshStore(), 'otp_nope', '123456');
    expect(result.ok).toBe(false);
  });

  it('expired codes are rejected', async () => {
    vi.useFakeTimers();
    try {
      const store = freshStore();
      const { request, code } = await requestOtp(store, 'customer@example.com');
      vi.advanceTimersByTime((OTP_TTL_SECONDS + 60) * 1000);
      const result = await verifyOtp(store, request.request_id, code);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('expired');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('verifyOtp entitlement gate (audit 2026-10-15 GAP-4)', () => {
  afterEach(() => {
    delete process.env.SUBSCRIPTIONS_LEDGER_PATH;
  });

  function subscriptionLedger(lines: unknown[]): string {
    const path = join(
      mkdtempSync(join(tmpdir(), 'otp-entitlement-')),
      'subscriptions.jsonl',
    );
    writeFileSync(
      path,
      lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : ''),
      'utf8',
    );
    return path;
  }

  function subscriptionRecord(email: string, status: string) {
    return {
      subscription_id: 'SUB-TEST-0001',
      created_at: '2026-10-13T00:00:00.000Z',
      computed_by: 'server',
      plan_id: 'living-grimoire-monthly',
      plan_name: 'Living Grimoire',
      price_cents: 777,
      interval: 'month',
      status,
      customer: { name: 'Test Member', email },
      confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
      confirmed_by: status === 'active' ? 'owner' : null,
      recurring_mechanic: 'NEEDS_VERIFICATION',
      ledger_version: 1,
    };
  }

  it('entitled member: session issued exactly as before', async () => {
    process.env.SUBSCRIPTIONS_LEDGER_PATH = subscriptionLedger([
      subscriptionRecord('member@example.com', 'active'),
    ]);
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'member@example.com');
    const result = await verifyOtp(store, request.request_id, code, {
      entitlementCheck: isEntitledSubscriberAsync,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.email).toBe('member@example.com');
      expect(await getValidSession(store, result.session.session_token)).not.toBeNull();
    }
  });

  it('non-entitled (pending_payment): no session, code NOT consumed', async () => {
    process.env.SUBSCRIPTIONS_LEDGER_PATH = subscriptionLedger([
      subscriptionRecord('pending@example.com', 'pending_payment'),
    ]);
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'pending@example.com');
    const denied = await verifyOtp(store, request.request_id, code, {
      entitlementCheck: isEntitledSubscriberAsync,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe('not_entitled');
    // The request survives unconsumed — possession was proven; membership
    // is the only missing piece. Once entitled, the same code verifies.
    const persisted = await store.getCodeRequest(request.request_id);
    expect(persisted).not.toBeNull();
    expect(persisted!.consumed).toBe(false);
    const after = await verifyOtp(store, request.request_id, code, {
      entitlementCheck: async () => true,
    });
    expect(after.ok).toBe(true);
  });

  it('no subscription record at all: fail-closed not_entitled', async () => {
    process.env.SUBSCRIPTIONS_LEDGER_PATH = subscriptionLedger([]);
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'stranger@example.com');
    const result = await verifyOtp(store, request.request_id, code, {
      entitlementCheck: isEntitledSubscriberAsync,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_entitled');
  });

  it('a throwing entitlement checker fails closed (never grants)', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'member@example.com');
    const result = await verifyOtp(store, request.request_id, code, {
      entitlementCheck: async () => {
        throw new Error('ledger unavailable');
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_entitled');
  });

  it('without a checker bound, the pure possession contract is unchanged', async () => {
    const store = freshStore();
    const { request, code } = await requestOtp(store, 'anyone@example.com');
    const result = await verifyOtp(store, request.request_id, code);
    expect(result.ok).toBe(true);
  });
});

describe('getValidSession', () => {
  it('returns the session while valid, prunes after expiry', async () => {
    vi.useFakeTimers();
    try {
      const store = freshStore();
      const { request, code } = await requestOtp(store, 'customer@example.com');
      const verified = await verifyOtp(store, request.request_id, code);
      if (!verified.ok) throw new Error('setup failed');
      const token = verified.session.session_token;
      expect(await getValidSession(store, token)).not.toBeNull();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      expect(await getValidSession(store, token)).toBeNull();
      expect(await store.getSession(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null for unknown tokens', async () => {
    expect(await getValidSession(freshStore(), 'nope')).toBeNull();
  });
});

describe('supabase binding', () => {
  it('createSupabaseOtpStore refuses to run — binding NEEDS VERIFICATION', () => {
    expect(() => createSupabaseOtpStore()).toThrow(/NEEDS VERIFICATION/);
  });
});
