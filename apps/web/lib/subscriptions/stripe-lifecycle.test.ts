/**
 * Stripe subscription lifecycle walk (Stage 3).
 *
 * Laws under test (owner decisions 2026-10-21 §13(3)/(4)):
 * - subscribe(paid) → entitled.
 * - payment_failed → past_due: entitled on day 2, NOT on day 4
 *   (GRACE_DAYS = 3); a success inside grace restores ACTIVE
 *   seamlessly; after grace, access pauses until a payment lands.
 * - updated cancel_at_period_end → entitled until period end only.
 * - deleted → entitled until paid_through, lapsed after.
 * - out-of-order older events never regress a newer state.
 * - manual (owner-confirmed) members stay entitled throughout.
 * - a PERMANENT_UNLOCK holder whose subscription lapses stays
 *   entitled through the unlock (Stage 2 interplay).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applySubscriptionDeleted,
  applySubscriptionUpdated,
} from './stripe-lifecycle';
import {
  appendSubscriptionRecord,
  findLatestSubscriptionRecordAsync,
  isEntitledSubscriberAsync,
} from './entitlement';
import {
  confirmSubscription,
  validateAndBuildSubscription,
} from './subscriptions';
import {
  GRIMOIRE_TOTAL_PAGES,
  resolveGrimoireEntitlement,
} from '../grimoire/entitlement';
import { grantUnlock } from '../grimoire/unlock';

const T0 = Date.parse('2026-10-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const sec = (ms: number) => Math.floor(ms / 1000);
const at = (ms: number) => new Date(ms);

const ENV_KEYS = [
  'DATABASE_URL',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'GRIMOIRE_GRACE_DAYS',
  'GRIMOIRE_KEEPER_EMAILS',
] as const;
const savedEnv: Record<string, string | undefined> = {};
let dir: string;

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  delete process.env.DATABASE_URL;
  delete process.env.GRIMOIRE_GRACE_DAYS;
  delete process.env.GRIMOIRE_KEEPER_EMAILS;
  dir = mkdtempSync(join(tmpdir(), 'stripe-lifecycle-'));
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(dir, 'subscriptions.jsonl');
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = join(dir, 'unlocks.jsonl');
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function invoicePaid(email: string, sub: string, createdMs: number, periodEndMs: number) {
  return {
    created: sec(createdMs),
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_${sub}`,
        customer: `cus_${sub}`,
        customer_email: email,
        subscription: sub,
        lines: { data: [{ period: { end: sec(periodEndMs) } }] },
      },
    },
  };
}

function invoiceFailed(email: string, sub: string, createdMs: number) {
  return {
    created: sec(createdMs),
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: `in_${sub}`,
        customer: `cus_${sub}`,
        customer_email: email,
        subscription: sub,
      },
    },
  };
}

function subscriptionUpdated(
  email: string,
  sub: string,
  createdMs: number,
  periodEndMs: number,
  cancelAtPeriodEnd: boolean,
) {
  return {
    created: sec(createdMs),
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: sub,
        object: 'subscription',
        customer: `cus_${sub}`,
        status: 'active',
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: sec(periodEndMs),
        metadata: { email, grimoire_subscription: 'grimoire_subscription' },
      },
    },
  };
}

function subscriptionDeleted(
  email: string,
  sub: string,
  createdMs: number,
  periodEndMs: number,
) {
  return {
    created: sec(createdMs),
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: sub,
        object: 'subscription',
        customer: `cus_${sub}`,
        status: 'canceled',
        current_period_end: sec(periodEndMs),
        metadata: { email, grimoire_subscription: 'grimoire_subscription' },
      },
    },
  };
}

describe('full lifecycle walk', () => {
  it('subscribe(paid) → entitled, with Stripe linkage + paid_through recorded', async () => {
    const email = 'walker@example.com';
    const outcome = await applyInvoicePaid(
      invoicePaid(email, 'sub_walk', T0, T0 + 30 * DAY),
    );
    expect(outcome.applied).toBe(true);
    expect(outcome.status).toBe('active');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.stripe_subscription_id).toBe('sub_walk');
    expect(record?.stripe_customer_id).toBe('cus_sub_walk');
    expect(record?.paid_through).toBe(at(T0 + 30 * DAY).toISOString());
    expect(await isEntitledSubscriberAsync(email, at(T0 + DAY))).toBe(true);
  });

  it('payment_failed → past_due: entitled day 2, NOT day 4 (grace = 3)', async () => {
    const email = 'grace@example.com';
    await applyInvoicePaid(invoicePaid(email, 'sub_grace', T0, T0 + 30 * DAY));
    const failedAt = T0 + 30 * DAY;
    const outcome = await applyInvoicePaymentFailed(
      invoiceFailed(email, 'sub_grace', failedAt),
    );
    expect(outcome.status).toBe('past_due');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.past_due_since).toBe(at(failedAt).toISOString());
    expect(await isEntitledSubscriberAsync(email, at(failedAt + 2 * DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync(email, at(failedAt + 4 * DAY))).toBe(false);
  });

  it('success within grace restores ACTIVE seamlessly', async () => {
    const email = 'restore@example.com';
    await applyInvoicePaid(invoicePaid(email, 'sub_restore', T0, T0 + 30 * DAY));
    const failedAt = T0 + 30 * DAY;
    await applyInvoicePaymentFailed(invoiceFailed(email, 'sub_restore', failedAt));
    expect(await isEntitledSubscriberAsync(email, at(failedAt + DAY))).toBe(true);
    await applyInvoicePaid(
      invoicePaid(email, 'sub_restore', failedAt + 2 * DAY, failedAt + 32 * DAY),
    );
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.status).toBe('active');
    expect(record?.past_due_since).toBeNull();
    expect(await isEntitledSubscriberAsync(email, at(failedAt + 10 * DAY))).toBe(true);
  });

  it('after grace expires unpaid, a later payment reactivates', async () => {
    const email = 'reactivate@example.com';
    await applyInvoicePaid(invoicePaid(email, 'sub_react', T0, T0 + 30 * DAY));
    const failedAt = T0 + 30 * DAY;
    await applyInvoicePaymentFailed(invoiceFailed(email, 'sub_react', failedAt));
    expect(await isEntitledSubscriberAsync(email, at(failedAt + 5 * DAY))).toBe(false);
    await applyInvoicePaid(
      invoicePaid(email, 'sub_react', failedAt + 6 * DAY, failedAt + 36 * DAY),
    );
    expect(await isEntitledSubscriberAsync(email, at(failedAt + 7 * DAY))).toBe(true);
  });

  it('cancel_at_period_end → entitled until period end, not after', async () => {
    const email = 'cape@example.com';
    const periodEnd = T0 + 30 * DAY;
    await applyInvoicePaid(invoicePaid(email, 'sub_cape', T0, periodEnd));
    await applySubscriptionUpdated(
      subscriptionUpdated(email, 'sub_cape', T0 + DAY, periodEnd, true),
    );
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.status).toBe('active');
    expect(record?.cancel_at_period_end).toBe(true);
    expect(await isEntitledSubscriberAsync(email, at(periodEnd - DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync(email, at(periodEnd + DAY))).toBe(false);
  });

  it('deleted → entitled until paid_through, lapsed after', async () => {
    const email = 'deleted@example.com';
    const periodEnd = T0 + 30 * DAY;
    await applyInvoicePaid(invoicePaid(email, 'sub_del', T0, periodEnd));
    const outcome = await applySubscriptionDeleted(
      subscriptionDeleted(email, 'sub_del', T0 + 5 * DAY, periodEnd),
    );
    expect(outcome.status).toBe('cancelled');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.stripe_deleted_at).toBe(at(T0 + 5 * DAY).toISOString());
    expect(record?.paid_through).toBe(at(periodEnd).toISOString());
    expect(await isEntitledSubscriberAsync(email, at(periodEnd - DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync(email, at(periodEnd + DAY))).toBe(false);
  });

  it('an out-of-order older event never regresses a newer state', async () => {
    const email = 'order@example.com';
    await applyInvoicePaid(invoicePaid(email, 'sub_ord', T0 + 10 * DAY, T0 + 40 * DAY));
    const stale = await applyInvoicePaymentFailed(
      invoiceFailed(email, 'sub_ord', T0 + 5 * DAY),
    );
    expect(stale.applied).toBe(false);
    expect(stale.outcome).toBe('stale_event_ignored');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.status).toBe('active');
    expect(await isEntitledSubscriberAsync(email, at(T0 + 11 * DAY))).toBe(true);
  });

  it('manual member stays entitled throughout (regression)', async () => {
    const record = validateAndBuildSubscription({
      name: 'Manual Member',
      email: 'manual@example.com',
    });
    await appendSubscriptionRecord(confirmSubscription(record));
    expect(await isEntitledSubscriberAsync('manual@example.com', at(T0))).toBe(true);
    // Manual active has no expiry — entitled arbitrarily far out,
    // until an owner cancellation (a new latest line) lands.
    expect(
      await isEntitledSubscriberAsync('manual@example.com', at(T0 + 365 * DAY)),
    ).toBe(true);
  });

  it('unlock holder with a lapsed subscription is still entitled (Stage 2 interplay)', async () => {
    const email = 'both@example.com';
    await applyInvoicePaid(invoicePaid(email, 'sub_both', T0, T0 + 30 * DAY));
    const failedAt = T0 + 30 * DAY;
    await applyInvoicePaymentFailed(invoiceFailed(email, 'sub_both', failedAt));
    await grantUnlock({
      email,
      stripe_session_id: 'cs_both',
      payment_intent_id: 'pi_both',
    });
    const resolved = await resolveGrimoireEntitlement(email);
    // The subscription side evaluates with the real clock — the
    // failure above is in the past relative to any run date after
    // 2026-11-03, and in any case the unlock alone must entitle.
    expect(resolved.has_permanent_unlock).toBe(true);
    expect(resolved.entitled).toBe(true);
    expect(resolved.entitled_pages).toHaveLength(GRIMOIRE_TOTAL_PAGES);
  });
});
