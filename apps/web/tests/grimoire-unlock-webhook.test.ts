/**
 * Grimoire PERMANENT_UNLOCK webhook flow (Stage 2).
 *
 * Laws under test:
 * - ONLY a signature-verified checkout.session.completed carrying
 *   unlock metadata grants the unlock — amount must equal $8.88
 *   (888¢); a wrong amount grants nothing (400, event not recorded).
 * - Unlock sessions are NOT product orders: no order, no Stripe
 *   payment record is created for them.
 * - Grant is idempotent (duplicate event delivery + a second event
 *   for the same transaction both leave exactly one grant record).
 * - charge.refunded revokes with reason 'refund';
 *   charge.dispute.created revokes with reason 'chargeback'.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hoisted = vi.hoisted(() => {
  const client = {
    checkout: {
      sessions: {
        create: async () => ({ id: 'cs_unused', client_secret: 'x' }),
      },
    },
    coupons: { create: async () => ({ id: 'cpn_unused' }) },
    webhooks: {
      constructEvent: (body: string, signature: string) => {
        if (signature !== 'valid-signature') {
          throw new Error('signature verification failed');
        }
        return JSON.parse(body) as Record<string, unknown>;
      },
    },
  };
  return { client };
});

vi.mock('../lib/payments/stripe', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/payments/stripe')>();
  return { ...actual, createStripeClient: () => hoisted.client };
});

import { POST } from '../app/api/stripe/webhook/route';
import {
  findUnlockByTransactionRef,
  isUnlockEntitled,
  readUnlockRecords,
} from '../lib/grimoire/unlock';
import {
  findStripePayment,
  findStripeWebhookEvent,
  readStripePaymentsAsync,
} from '../lib/payments/stripe';

const DIR = mkdtempSync(join(tmpdir(), 'grimoire-unlock-webhook-'));

const ENV_KEYS = [
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'DATABASE_URL',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  const run = join(DIR, `run-${Math.random().toString(36).slice(2)}`);
  process.env.ORDERS_LEDGER_PATH = join(run, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(run, 'subscriptions.jsonl');
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = join(run, 'stripe-payments.jsonl');
  process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'events.jsonl');
  process.env.STRIPE_ORDER_STATUS_LEDGER_PATH = join(run, 'status.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(run, 'order-payments.jsonl');
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = join(run, 'unlocks.jsonl');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  delete process.env.RESEND_API_KEY;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function unlockCompletedEvent(
  email: string,
  opts: {
    eventId?: string;
    sessionId?: string;
    paymentIntent?: string;
    amount?: number;
  } = {},
) {
  return {
    id: opts.eventId ?? 'evt_unlock_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: opts.sessionId ?? 'cs_unlock_1',
        payment_status: 'paid',
        amount_total: opts.amount ?? 888,
        currency: 'usd',
        payment_intent: opts.paymentIntent ?? 'pi_unlock_1',
        customer_email: email,
        metadata: {
          grimoire_unlock: 'grimoire_permanent_unlock',
          purpose: 'grimoire_permanent_unlock',
          edition_id: 'living-grimoire-333',
          email,
        },
      },
    },
  };
}

async function postWebhook(event: unknown, signature = 'valid-signature') {
  const res = await POST(
    new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: JSON.stringify(event),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('grimoire unlock webhook grant path', () => {
  it('a verified unlock session grants the entitlement — and is not an order', async () => {
    const { status, json } = await postWebhook(
      unlockCompletedEvent('buyer@example.com'),
    );
    expect(status).toBe(200);
    expect(json.unlock_granted).toBe(true);
    expect(json.unlock_email).toBe('buyer@example.com');
    expect(json.marked_paid).toBe(false);
    expect(json.order_id).toBeNull();

    expect(await isUnlockEntitled('buyer@example.com')).toBe(true);
    const record = await findUnlockByTransactionRef('pi_unlock_1');
    expect(record?.edition_id).toBe('living-grimoire-333');
    expect(record?.stripe_session_id).toBe('cs_unlock_1');
    expect(record?.source).toBe('stripe_webhook');

    // Not a product order: the Stripe payment ledger stays empty.
    expect(await readStripePaymentsAsync()).toHaveLength(0);
    expect(await findStripePayment('cs_unlock_1')).toBeNull();
  });

  it('grant is idempotent across duplicate and repeat deliveries', async () => {
    const event = unlockCompletedEvent('buyer@example.com');
    await postWebhook(event);
    const dup = await postWebhook(event);
    expect(dup.json.duplicate_event).toBe(true);
    // A second, distinct event for the same transaction also grants once.
    const repeat = await postWebhook(
      unlockCompletedEvent('buyer@example.com', { eventId: 'evt_unlock_2' }),
    );
    expect(repeat.status).toBe(200);
    expect(repeat.json.unlock_granted).toBe(true);
    expect(await readUnlockRecords()).toHaveLength(1);
    const recorded = await findStripeWebhookEvent('evt_unlock_2');
    expect(recorded?.outcome).toBe('unlock_already_granted');
  });

  it('a wrong amount grants nothing and the delivery is not recorded', async () => {
    const bad = unlockCompletedEvent('buyer@example.com', { amount: 100 });
    const first = await postWebhook(bad);
    expect(first.status).toBe(400);
    expect(await isUnlockEntitled('buyer@example.com')).toBe(false);
    expect(await findStripeWebhookEvent('evt_unlock_1')).toBeNull();
    const second = await postWebhook(bad);
    expect(second.status).toBe(400);
  });

  it('a bad signature grants nothing', async () => {
    const { status } = await postWebhook(
      unlockCompletedEvent('buyer@example.com'),
      'forged-signature',
    );
    expect(status).toBe(400);
    expect(await isUnlockEntitled('buyer@example.com')).toBe(false);
  });

  it('charge.refunded revokes the unlock (reason: refund)', async () => {
    await postWebhook(unlockCompletedEvent('buyer@example.com'));
    expect(await isUnlockEntitled('buyer@example.com')).toBe(true);
    const { status, json } = await postWebhook({
      id: 'evt_unlock_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_unlock_1',
          payment_intent: 'pi_unlock_1',
          amount_refunded: 888,
          currency: 'usd',
        },
      },
    });
    expect(status).toBe(200);
    expect(json.unlock_revoked).toBe(true);
    expect(json.status_transition).toBeNull();
    expect(await isUnlockEntitled('buyer@example.com')).toBe(false);
    const record = await findUnlockByTransactionRef('pi_unlock_1');
    expect(record?.state).toBe('revoked');
    expect(record?.revoked_reason).toBe('refund');
  });

  it('charge.dispute.created revokes the unlock (reason: chargeback)', async () => {
    await postWebhook(
      unlockCompletedEvent('buyer2@example.com', {
        eventId: 'evt_unlock_b2',
        sessionId: 'cs_unlock_2',
        paymentIntent: 'pi_unlock_2',
      }),
    );
    expect(await isUnlockEntitled('buyer2@example.com')).toBe(true);
    const { status, json } = await postWebhook({
      id: 'evt_unlock_dispute_1',
      type: 'charge.dispute.created',
      data: {
        object: {
          id: 'dp_unlock_1',
          charge: 'ch_unlock_2',
          payment_intent: 'pi_unlock_2',
          amount: 888,
          currency: 'usd',
        },
      },
    });
    expect(status).toBe(200);
    expect(json.unlock_revoked).toBe(true);
    expect(await isUnlockEntitled('buyer2@example.com')).toBe(false);
    const record = await findUnlockByTransactionRef('pi_unlock_2');
    expect(record?.revoked_reason).toBe('chargeback');
  });
});
