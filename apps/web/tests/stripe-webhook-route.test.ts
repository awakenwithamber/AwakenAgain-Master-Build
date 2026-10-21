/**
 * Stripe webhook — regression suite (owner directive 2026-10-19).
 *
 * Laws under test:
 * - ONLY a signature-verified webhook marks an order paid — a bad
 *   signature is rejected (400) and marks nothing.
 * - A verified checkout.session.completed marks EXACTLY the bound
 *   order paid (the order-status lookup then resolves 'paid').
 * - Amounts are verified as order total (pre-tax) + the Stripe Tax
 *   amount on the session (total_details.amount_tax), and the tax is
 *   stored on the payment record (2026-10-20). An amount that differs
 *   marks nothing (400); a session event with NO tax breakdown fails
 *   safe (400, nothing marked); payment_intent.succeeded carries no
 *   tax breakdown and never marks an order paid by itself.
 * - Duplicate deliveries are idempotent (one payment record).
 * - Unconfigured webhook → 503, marks nothing.
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
  const actual =
    await importOriginal<typeof import('../lib/payments/stripe')>();
  return { ...actual, createStripeClient: () => hoisted.client };
});

import { POST } from '../app/api/stripe/webhook/route';
import { POST as postCheckout } from '../app/api/checkout/route';
import { POST as postOrderStatus } from '../app/api/orders/status/route';
import { findStripePayment } from '../lib/payments/stripe';

const DIR = mkdtempSync(join(tmpdir(), 'stripe-webhook-route-'));
const PAYMENTS_LEDGER = join(DIR, 'stripe-payments.jsonl');
const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };
const CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};

const ENV_KEYS = [
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ORDERS_LEDGER_PATH = join(DIR, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(DIR, 'subscriptions.jsonl');
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = PAYMENTS_LEDGER;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// The seeded order: $19.77 capsule, under the $45 free-shipping
// threshold → server total 1977 + 595 flat shipping = 2572 (pre-tax).
// Stripe Tax adds tax on top inside the session; the webhook verifies
// amount_total == 2572 + amount_tax and stores the tax.
const ORDER_TOTAL_CENTS = 1977 + 595;
const TAX_CENTS = 187;

async function seedOrder(): Promise<string> {
  const res = await postCheckout(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        payment_method: 'stripe_card_embedded',
        client_total_cents: ORDER_TOTAL_CENTS,
      }),
    }),
  );
  const json = (await res.json()) as { ok: boolean; order_id: string };
  expect(res.status).toBe(200);
  return json.order_id;
}

function completedEvent(
  orderId: string,
  amountTotal = ORDER_TOTAL_CENTS + TAX_CENTS,
  amountTax: number | null = TAX_CENTS,
) {
  return {
    id: `evt_${orderId}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: amountTotal,
        currency: 'usd',
        payment_intent: 'pi_test_123',
        client_reference_id: orderId,
        metadata: { order_id: orderId },
        ...(amountTax === null
          ? {}
          : { total_details: { amount_tax: amountTax } }),
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
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

async function orderStatus(orderId: string): Promise<string> {
  const res = await postOrderStatus(
    new Request('http://localhost/api/orders/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, email: CUSTOMER.email }),
    }),
  );
  const json = (await res.json()) as {
    order: { status: string };
  };
  return json.order.status;
}

describe('POST /api/stripe/webhook', () => {
  it('a verified completed session marks exactly the bound order paid', async () => {
    const orderId = await seedOrder();
    const otherId = await seedOrder();
    expect(await orderStatus(orderId)).toBe('pending_payment');

    const { status, json } = await postWebhook(completedEvent(orderId));
    expect(status).toBe(200);
    expect(json.marked_paid).toBe(true);
    expect(json.order_id).toBe(orderId);

    const payment = await findStripePayment(orderId);
    expect(payment?.amount_total_cents).toBe(ORDER_TOTAL_CENTS + TAX_CENTS);
    expect(payment?.tax_cents).toBe(TAX_CENTS);
    expect(payment?.stripe_session_id).toBe('cs_test_123');
    expect(await orderStatus(orderId)).toBe('paid');
    // Exactly the bound order — the other order is untouched.
    expect(await findStripePayment(otherId)).toBeNull();
    expect(await orderStatus(otherId)).toBe('pending_payment');
  });

  it('rejects a bad signature (400) and marks nothing', async () => {
    const orderId = await seedOrder();
    const { status } = await postWebhook(
      completedEvent(orderId),
      'forged-signature',
    );
    expect(status).toBe(400);
    expect(await findStripePayment(orderId)).toBeNull();
    expect(await orderStatus(orderId)).toBe('pending_payment');
  });

  it('rejects an amount mismatch (400) and marks nothing', async () => {
    const orderId = await seedOrder();
    const { status, json } = await postWebhook(
      completedEvent(orderId, 100),
    );
    expect(status).toBe(400);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /does not match/,
    );
    expect(await findStripePayment(orderId)).toBeNull();
  });

  it('rejects the pre-tax total alone — tax must be included (400)', async () => {
    const orderId = await seedOrder();
    // amount_total == order total WITHOUT the tax Stripe reported.
    const { status, json } = await postWebhook(
      completedEvent(orderId, ORDER_TOTAL_CENTS),
    );
    expect(status).toBe(400);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /does not match/,
    );
    expect(await findStripePayment(orderId)).toBeNull();
    expect(await orderStatus(orderId)).toBe('pending_payment');
  });

  it('fails safe when the session carries no tax breakdown (400, nothing marked)', async () => {
    const orderId = await seedOrder();
    const { status, json } = await postWebhook(
      completedEvent(orderId, ORDER_TOTAL_CENTS + TAX_CENTS, null),
    );
    expect(status).toBe(400);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /no tax breakdown/,
    );
    expect(await findStripePayment(orderId)).toBeNull();
    expect(await orderStatus(orderId)).toBe('pending_payment');
  });

  it('payment_intent.succeeded alone never marks an order paid (no tax breakdown)', async () => {
    const orderId = await seedOrder();
    const { status, json } = await postWebhook({
      id: `evt_pi_${orderId}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount_received: ORDER_TOTAL_CENTS + TAX_CENTS,
          currency: 'usd',
          metadata: { order_id: orderId },
        },
      },
    });
    expect(status).toBe(200);
    expect(json.marked_paid).toBe(false);
    expect(await findStripePayment(orderId)).toBeNull();
    expect(await orderStatus(orderId)).toBe('pending_payment');
  });

  it('duplicate deliveries are idempotent — one payment record', async () => {
    const orderId = await seedOrder();
    const first = await postWebhook(completedEvent(orderId));
    expect(first.json.already_paid).toBe(false);
    const second = await postWebhook(completedEvent(orderId));
    expect(second.status).toBe(200);
    expect(second.json.marked_paid).toBe(true);
    expect(second.json.already_paid).toBe(true);
    const lines = readFileSync(PAYMENTS_LEDGER, 'utf8')
      .trim()
      .split('\n')
      .filter((l) => l.includes(orderId));
    expect(lines).toHaveLength(1);
  });

  it('returns 503 when the webhook is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const orderId = await seedOrder();
    const { status } = await postWebhook(completedEvent(orderId));
    expect(status).toBe(503);
    expect(await findStripePayment(orderId)).toBeNull();
  });
});
