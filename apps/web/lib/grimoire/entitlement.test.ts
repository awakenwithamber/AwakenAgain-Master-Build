/**
 * Grimoire entitlement matrix + PERMANENT_UNLOCK ledger (Stage 2).
 *
 * Laws under test (owner decisions 2026-10-21 §13(1)/(2)/(5)):
 * - Anonymous → pages 1–16 only. Active subscriber → all 1,389.
 *   Unlock holder → all 1,389. Keeper (env set + verified session
 *   email) → all 1,389. Cancelled subscriber → 1–16. Revoked → 1–16.
 * - Unlock survives subscription cancellation (independent ledgers).
 * - Keeper with NO session email (anonymous) is never entitled —
 *   email possession alone is not access.
 * - Grant/revoke are idempotent; revocation records refund/chargeback
 *   reasons; the record carries the 333-page edition id + scope note.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FREE_PREVIEW_LAST_PAGE,
  GRIMOIRE_TOTAL_PAGES,
  resolveGrimoireEntitlement,
} from './entitlement';
import {
  findLatestUnlock,
  findUnlockByTransactionRef,
  grantUnlock,
  isUnlockEntitled,
  readUnlockRecords,
  revokeUnlockByTransactionRef,
} from './unlock';

const ALL_PAGES = Array.from({ length: GRIMOIRE_TOTAL_PAGES }, (_, i) => i + 1);
const PREVIEW_PAGES = Array.from(
  { length: FREE_PREVIEW_LAST_PAGE },
  (_, i) => i + 1,
);

const ENV_KEYS = [
  'DATABASE_URL',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'GRIMOIRE_KEEPER_EMAILS',
] as const;
const savedEnv: Record<string, string | undefined> = {};
let dir: string;

function subscriptionRecord(email: string, status: string) {
  return {
    subscription_id: 'SUB-TEST-0001',
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
  };
}

function writeSubscriptions(records: unknown[]) {
  writeFileSync(
    process.env.SUBSCRIPTIONS_LEDGER_PATH!,
    records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''),
    'utf8',
  );
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  delete process.env.DATABASE_URL;
  delete process.env.GRIMOIRE_KEEPER_EMAILS;
  dir = mkdtempSync(join(tmpdir(), 'grimoire-entitlement-'));
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(dir, 'subscriptions.jsonl');
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = join(dir, 'unlocks.jsonl');
  writeSubscriptions([]);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('entitlement matrix', () => {
  it('anonymous → preview pages 1–16 only', async () => {
    const r = await resolveGrimoireEntitlement(null);
    expect(r.entitled).toBe(false);
    expect(r.entitled_pages).toEqual(PREVIEW_PAGES);
    expect(r.email).toBeNull();
  });

  it('active subscriber → all pages', async () => {
    writeSubscriptions([subscriptionRecord('member@example.com', 'active')]);
    const r = await resolveGrimoireEntitlement('member@example.com');
    expect(r.entitled).toBe(true);
    expect(r.is_subscriber).toBe(true);
    expect(r.entitled_pages).toEqual(ALL_PAGES);
  });

  it('cancelled subscriber → preview only', async () => {
    writeSubscriptions([
      subscriptionRecord('member@example.com', 'active'),
      subscriptionRecord('member@example.com', 'cancelled'),
    ]);
    const r = await resolveGrimoireEntitlement('member@example.com');
    expect(r.entitled).toBe(false);
    expect(r.entitled_pages).toEqual(PREVIEW_PAGES);
  });

  it('unlock holder → all pages', async () => {
    await grantUnlock({
      email: 'buyer@example.com',
      stripe_session_id: 'cs_1',
      payment_intent_id: 'pi_1',
    });
    const r = await resolveGrimoireEntitlement('buyer@example.com');
    expect(r.entitled).toBe(true);
    expect(r.has_permanent_unlock).toBe(true);
    expect(r.entitled_pages).toEqual(ALL_PAGES);
  });

  it('revoked unlock → preview only', async () => {
    await grantUnlock({
      email: 'buyer@example.com',
      stripe_session_id: 'cs_1',
      payment_intent_id: 'pi_1',
    });
    await revokeUnlockByTransactionRef('pi_1', 'refund');
    const r = await resolveGrimoireEntitlement('buyer@example.com');
    expect(r.entitled).toBe(false);
    expect(r.entitled_pages).toEqual(PREVIEW_PAGES);
  });

  it('unlock survives subscription cancellation', async () => {
    writeSubscriptions([
      subscriptionRecord('both@example.com', 'active'),
      subscriptionRecord('both@example.com', 'cancelled'),
    ]);
    await grantUnlock({
      email: 'both@example.com',
      stripe_session_id: 'cs_2',
      payment_intent_id: 'pi_2',
    });
    const r = await resolveGrimoireEntitlement('both@example.com');
    expect(r.is_subscriber).toBe(false);
    expect(r.has_permanent_unlock).toBe(true);
    expect(r.entitled).toBe(true);
    expect(r.entitled_pages).toEqual(ALL_PAGES);
  });

  it('keeper (env set + verified session email) → all pages', async () => {
    process.env.GRIMOIRE_KEEPER_EMAILS = 'Keeper@Example.com, other@example.com';
    const r = await resolveGrimoireEntitlement('keeper@example.com');
    expect(r.is_keeper).toBe(true);
    expect(r.entitled).toBe(true);
    expect(r.entitled_pages).toEqual(ALL_PAGES);
  });

  it('keeper email with NO session (anonymous) is never entitled', async () => {
    process.env.GRIMOIRE_KEEPER_EMAILS = 'keeper@example.com';
    const r = await resolveGrimoireEntitlement(null);
    expect(r.entitled).toBe(false);
    expect(r.is_keeper).toBe(false);
    expect(r.entitled_pages).toEqual(PREVIEW_PAGES);
  });

  it('non-keeper email with keeper env set → preview only', async () => {
    process.env.GRIMOIRE_KEEPER_EMAILS = 'keeper@example.com';
    const r = await resolveGrimoireEntitlement('someone@example.com');
    expect(r.entitled).toBe(false);
  });
});

describe('unlock ledger', () => {
  it('grant records the 333-page edition, scope, and transaction refs', async () => {
    const record = await grantUnlock({
      email: 'Buyer@Example.com',
      stripe_session_id: 'cs_9',
      payment_intent_id: 'pi_9',
      charge_id: 'ch_9',
    });
    expect(record.email).toBe('buyer@example.com');
    expect(record.type).toBe('PERMANENT_UNLOCK');
    expect(record.edition_id).toBe('living-grimoire-333');
    expect(record.scope).toContain('333-page edition');
    expect(record.scope).toContain('future chapters');
    expect(record.scope).toContain('not included');
    expect(record.transaction_ref).toBe('pi_9');
    expect(record.state).toBe('active');
    expect(record.source).toBe('stripe_webhook');
    expect(await isUnlockEntitled('buyer@example.com')).toBe(true);
  });

  it('grant is idempotent by transaction', async () => {
    const input = {
      email: 'buyer@example.com',
      stripe_session_id: 'cs_1',
      payment_intent_id: 'pi_1',
    };
    const first = await grantUnlock(input);
    const second = await grantUnlock(input);
    expect(second.transaction_ref).toBe(first.transaction_ref);
    expect(second.effective_at).toBe(first.effective_at);
    expect(await readUnlockRecords()).toHaveLength(1);
  });

  it('revoke is idempotent and records the reason', async () => {
    await grantUnlock({
      email: 'buyer@example.com',
      stripe_session_id: 'cs_1',
      payment_intent_id: 'pi_1',
    });
    const revoked = await revokeUnlockByTransactionRef('pi_1', 'chargeback');
    expect(revoked?.state).toBe('revoked');
    expect(revoked?.revoked_reason).toBe('chargeback');
    expect(revoked?.revoked_at).toBeTruthy();
    const again = await revokeUnlockByTransactionRef('pi_1', 'chargeback');
    expect(again?.state).toBe('revoked');
    // Append-only: grant + one revoke — the second revoke wrote nothing.
    expect(await readUnlockRecords()).toHaveLength(2);
    expect((await findLatestUnlock('buyer@example.com'))?.state).toBe('revoked');
  });

  it('revoking an unknown transaction changes nothing', async () => {
    expect(await revokeUnlockByTransactionRef('pi_nope', 'refund')).toBeNull();
    expect(await readUnlockRecords()).toHaveLength(0);
  });

  it('findUnlockByTransactionRef resolves session, payment intent, and charge ids', async () => {
    await grantUnlock({
      email: 'buyer@example.com',
      stripe_session_id: 'cs_x',
      payment_intent_id: 'pi_x',
      charge_id: 'ch_x',
    });
    for (const ref of ['cs_x', 'pi_x', 'ch_x']) {
      expect((await findUnlockByTransactionRef(ref))?.email).toBe(
        'buyer@example.com',
      );
    }
    expect(await findUnlockByTransactionRef('pi_other')).toBeNull();
    expect(await findUnlockByTransactionRef(null)).toBeNull();
  });
});
