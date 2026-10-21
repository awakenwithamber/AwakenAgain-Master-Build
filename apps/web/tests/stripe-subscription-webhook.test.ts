/**
 * Stripe subscription webhook lifecycle (Stage 3).
 *
 * Laws under test:
 * - invoice.paid → ACTIVE with Stripe linkage + paid_through.
 * - invoice.payment_failed → PAST_DUE, recorded with the failure
 *   time (grace evaluated by the entitlement fold).
 * - customer.subscription.updated → syncs status incl.
 *   cancel_at_period_end.
 * - customer.subscription.deleted → cancelled with paid_through
 *   kept (entitlement evaluates the window).
 * - Duplicate deliveries have a single effect; an out-of-order older
 *   event never regresses a newer state.
 * - livemode is recorded on the event ledger and mismatches are
 *   log-only (ack 200).
 * - The strict one-time order rule is untouched: a product-order
 *   session marks the order paid, and a subscription event never
 *   creates a Stripe payment record.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
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
  const actual = await importOriginal<typeof import('../lib/payments/stripe')>();
  return { ...actual, createStripeClient: () => hoisted.client };
});

import { POST } from '../app/api/stripe/webhook/route';
import { POST as postCheckout } from '../app/api/checkout/route';
import {
  findLatestStripeOrderStatus,
  findStripePayment,
  findStripeWebhookEvent,
  readStripePaymentsAsync,
} from '../lib/payments/stripe';
import {
  findLatestSubscriptionRecordAsync,
  isEntitledSubscriberAsync,
} from '../lib/subscriptions/entitlement';

const DIR = mkdtempSync(join(tmpdir(), 'stripe-subscription-webhook-'));

const ENV_KEYS = [
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'DATABASE_URL',
  'GRIMOIRE_GRACE_DAYS',
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
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  delete process.env.RESEND_API_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.GRIMOIRE_GRACE_DAYS;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const T0 = Date.parse('2026-10-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const sec = (ms: number) => Math.floor(ms / 1000);

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

function invoicePaid(email: string, sub: string, createdMs: number, periodEndMs: number) {
  return {
    id: `evt_inv_paid_${sub}_${createdMs}`,
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

describe('subscription webhook lifecycle', () => {
  it('invoice.paid marks the member ACTIVE with linkage', async () => {
    const { status, json } = await postWebhook(
      invoicePaid('subber@example.com', 'sub_1', T0, T0 + 30 * DAY),
    );
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('active');
    expect(json.subscription_email).toBe('subber@example.com');
    const record = await findLatestSubscriptionRecordAsync('subber@example.com');
    expect(record?.status).toBe('active');
    expect(record?.stripe_subscription_id).toBe('sub_1');
    expect(record?.billing_source).toBe('stripe');
    expect(await isEntitledSubscriberAsync('subber@example.com', new Date(T0 + DAY))).toBe(true);
  });

  it('invoice.payment_failed marks PAST_DUE with the failure time', async () => {
    await postWebhook(invoicePaid('failed@example.com', 'sub_2', T0, T0 + 30 * DAY));
    const failedAt = T0 + 30 * DAY;
    const { status, json } = await postWebhook({
      id: 'evt_inv_failed_1',
      created: sec(failedAt),
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_sub_2',
          customer: 'cus_sub_2',
          customer_email: 'failed@example.com',
          subscription: 'sub_2',
        },
      },
    });
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('past_due');
    const record = await findLatestSubscriptionRecordAsync('failed@example.com');
    expect(record?.status).toBe('past_due');
    expect(record?.past_due_since).toBe(new Date(failedAt).toISOString());
    // Grace window: entitled day 2, not day 4 (grace = 3 days).
    expect(await isEntitledSubscriberAsync('failed@example.com', new Date(failedAt + 2 * DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync('failed@example.com', new Date(failedAt + 4 * DAY))).toBe(false);
  });

  it('customer.subscription.updated syncs cancel_at_period_end', async () => {
    const email = 'sync@example.com';
    await postWebhook(invoicePaid(email, 'sub_3', T0, T0 + 30 * DAY));
    const { status, json } = await postWebhook({
      id: 'evt_sub_updated_1',
      created: sec(T0 + DAY),
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_3',
          object: 'subscription',
          customer: 'cus_sub_3',
          status: 'active',
          cancel_at_period_end: true,
          current_period_end: sec(T0 + 30 * DAY),
          metadata: { email },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('active');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.cancel_at_period_end).toBe(true);
    expect(await isEntitledSubscriberAsync(email, new Date(T0 + 29 * DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync(email, new Date(T0 + 31 * DAY))).toBe(false);
  });

  it('customer.subscription.deleted ends at paid_through, then lapses', async () => {
    const email = 'gone@example.com';
    await postWebhook(invoicePaid(email, 'sub_4', T0, T0 + 30 * DAY));
    const { status, json } = await postWebhook({
      id: 'evt_sub_deleted_1',
      created: sec(T0 + 5 * DAY),
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_4',
          object: 'subscription',
          customer: 'cus_sub_4',
          status: 'canceled',
          current_period_end: sec(T0 + 30 * DAY),
          metadata: { email },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('cancelled');
    const record = await findLatestSubscriptionRecordAsync(email);
    expect(record?.stripe_deleted_at).toBe(new Date(T0 + 5 * DAY).toISOString());
    expect(await isEntitledSubscriberAsync(email, new Date(T0 + 29 * DAY))).toBe(true);
    expect(await isEntitledSubscriberAsync(email, new Date(T0 + 31 * DAY))).toBe(false);
  });

  it('duplicate invoice.paid deliveries have a single effect', async () => {
    const event = invoicePaid('dup@example.com', 'sub_5', T0, T0 + 30 * DAY);
    const first = await postWebhook(event);
    expect(first.json.duplicate_event).toBe(false);
    const second = await postWebhook(event);
    expect(second.status).toBe(200);
    expect(second.json.duplicate_event).toBe(true);
    const lines = readFileSync(process.env.SUBSCRIPTIONS_LEDGER_PATH!, 'utf8')
      .trim()
      .split('\n')
      .filter((l) => l.includes('dup@example.com'));
    expect(lines).toHaveLength(1);
  });

  it('an out-of-order older event never regresses a newer state', async () => {
    await postWebhook(invoicePaid('ooo@example.com', 'sub_6', T0 + 10 * DAY, T0 + 40 * DAY));
    const { status, json } = await postWebhook({
      id: 'evt_stale_failed_1',
      created: sec(T0 + 5 * DAY),
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_sub_6',
          customer: 'cus_sub_6',
          customer_email: 'ooo@example.com',
          subscription: 'sub_6',
        },
      },
    });
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('active');
    const record = await findLatestSubscriptionRecordAsync('ooo@example.com');
    expect(record?.status).toBe('active');
    expect(await isEntitledSubscriberAsync('ooo@example.com', new Date(T0 + 11 * DAY))).toBe(true);
  });

  it('livemode is recorded and mismatches are log-only (ack 200)', async () => {
    const { status, json } = await postWebhook({
      id: 'evt_livemode_1',
      created: sec(T0),
      livemode: true, // mismatch with sk_test key
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_live',
          customer: 'cus_live',
          customer_email: 'live@example.com',
          subscription: 'sub_live',
          lines: { data: [{ period: { end: sec(T0 + 30 * DAY) } }] },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.subscription_status).toBe('active');
    const recorded = await findStripeWebhookEvent('evt_livemode_1');
    expect(recorded?.livemode).toBe(true);
    const record = await findLatestSubscriptionRecordAsync('live@example.com');
    expect(record?.status).toBe('active');
  });

  it('a subscription checkout completion links + activates the member, not an order', async () => {
    const { status, json } = await postWebhook({
      id: 'evt_sub_checkout_1',
      created: sec(T0),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub_checkout_1',
          mode: 'subscription',
          payment_status: 'paid',
          amount_total: 777,
          currency: 'usd',
          customer: 'cus_sub_8',
          subscription: 'sub_8',
          customer_email: 'checkout@example.com',
          metadata: {
            grimoire_subscription: 'grimoire_subscription',
            purpose: 'grimoire_subscription',
            plan_id: 'living-grimoire-monthly',
            email: 'checkout@example.com',
          },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.marked_paid).toBe(false);
    expect(json.order_id).toBeNull();
    expect(json.subscription_status).toBe('active');
    const record = await findLatestSubscriptionRecordAsync('checkout@example.com');
    expect(record?.stripe_subscription_id).toBe('sub_8');
    expect(record?.stripe_customer_id).toBe('cus_sub_8');
    expect(await readStripePaymentsAsync()).toHaveLength(0);
  });

  it('subscription events never touch the one-time order ledgers', async () => {
    await postWebhook(invoicePaid('nor@example.com', 'sub_7', T0, T0 + 30 * DAY));
    expect(await readStripePaymentsAsync()).toHaveLength(0);
    expect(await findLatestStripeOrderStatus('sub_7')).toBeNull();
  });

  it('the strict one-time order rule is untouched', async () => {
    const orderRes = await postCheckout(
      new Request('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              product_handle: 'chill-pill-capsules',
              variant_id: 'chill-pill-capsules-2wk',
              quantity: 1,
              unit_price_cents: 1977,
            },
          ],
          customer: { name: 'Test Customer', email: 'order@example.com' },
          payment_method: 'stripe_card_embedded',
          client_total_cents: 1977 + 595,
        }),
      }),
    );
    const { order_id } = (await orderRes.json()) as { order_id: string };
    const { status, json } = await postWebhook({
      id: `evt_order_${order_id}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_order_1',
          payment_status: 'paid',
          amount_total: 1977 + 595 + 187,
          currency: 'usd',
          payment_intent: 'pi_test_order_1',
          client_reference_id: order_id,
          metadata: { order_id },
          total_details: { amount_tax: 187 },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.marked_paid).toBe(true);
    expect(await findStripePayment(order_id)).not.toBeNull();
    // ...and a product-order session carries no subscription metadata
    // (subscription checkout events route to the member ledger only).
    expect(json.subscription_status).toBeNull();
  });
});
