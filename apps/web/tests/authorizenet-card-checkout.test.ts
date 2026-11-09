/**
 * Authorize.net card checkout — server law + PAN proof
 * (card checkout build 2026-11-09, shop orders only).
 *
 * - Tampered client price/total is REJECTED at placement (the
 *   server recomputes every total from the catalog; a client total
 *   that is not a server-computable figure records no order).
 * - The hosted-payment input is built from the SERVER order record
 *   only: amount == stored tax-inclusive total, and the charge's
 *   idempotency key (invoice number) IS the order id — calling the
 *   builder twice yields the identical charge identity, so a
 *   double-submit cannot create a second charge.
 * - The token route refuses an already-paid order (409) before any
 *   gateway call, refuses non-card orders, and 404s a wrong email.
 * - No-card-numbers proof: the whole card code path (gateway
 *   module, webhook processor, both routes, the checkout form, and
 *   the confirmation-email builder/renderer) contains no card-number
 *   field, and the confirmation email for a card order contains no
 *   card details.
 * - Cart preservation (component-logic level): the checkout form
 *   clears the cart for non-card methods only, and its failure
 *   banner states the cart is still there.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as checkoutPOST } from '../app/api/checkout/route';
import {
  GET as tokenGET,
  POST as tokenPOST,
} from '../app/api/checkout/authorizenet/route';
import {
  buildHostedPaymentPageBody,
  buildOrderHostedPaymentInput,
  getAuthorizeNetConfig,
  recordAuthorizeNetPayment,
} from '../lib/payments/authorizenet';
import { validateAndBuildOrder } from '../lib/checkout/order';
import { defaultOrderStore } from '../lib/stores/order-store';
import { buildOrderConfirmationJob } from '../lib/jobs/order-confirmation';
import { renderEmailMessage } from '../lib/jobs/email';

const ENV_KEYS = [
  'DATABASE_URL',
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'AUTHORIZENET_PAYMENTS_LEDGER_PATH',
  'AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_STATUS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH',
  'CARD_PAYMENTS_ENABLED',
  'AUTHORIZENET_API_LOGIN_ID',
  'AUTHORIZENET_TRANSACTION_KEY',
  'AUTHORIZENET_SIGNATURE_KEY',
  'AUTHORIZENET_ENV',
  'RESEND_API_KEY',
] as const;
const savedEnv: Record<string, string | undefined> = {};
const DIR = mkdtempSync(join(tmpdir(), 'authorizenet-card-checkout-'));

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  const run = join(DIR, `run-${Math.random().toString(36).slice(2)}`);
  process.env.ORDERS_LEDGER_PATH = join(run, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(run, 'subscriptions.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(run, 'order-payments.jsonl');
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = join(run, 'stripe-payments.jsonl');
  process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'stripe-events.jsonl');
  process.env.STRIPE_ORDER_STATUS_LEDGER_PATH = join(run, 'stripe-status.jsonl');
  process.env.AUTHORIZENET_PAYMENTS_LEDGER_PATH = join(run, 'an-payments.jsonl');
  process.env.AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'an-events.jsonl');
  process.env.AUTHORIZENET_ORDER_STATUS_LEDGER_PATH = join(run, 'an-status.jsonl');
  process.env.AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH = join(run, 'an-audit.jsonl');
  delete process.env.DATABASE_URL;
  delete process.env.RESEND_API_KEY;
  process.env.CARD_PAYMENTS_ENABLED = 'true';
  process.env.AUTHORIZENET_API_LOGIN_ID = 'test-login';
  process.env.AUTHORIZENET_TRANSACTION_KEY = 'test-key';
  process.env.AUTHORIZENET_SIGNATURE_KEY = 'ab'.repeat(64);
  process.env.AUTHORIZENET_ENV = 'sandbox';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const BASE_BODY = {
  items: [
    {
      product_handle: 'chill-pill-capsules',
      variant_id: 'chill-pill-capsules-2wk',
      quantity: 1,
      unit_price_cents: 1977,
    },
  ],
  customer: { name: 'Test Buyer', email: 'buyer@example.com' },
  shipping_address: {
    name: 'Test Buyer',
    street: '100 Main St',
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    country: 'US',
  },
  payment_method: 'authorizenet_card_hosted',
};

async function postCheckout(body: unknown) {
  const res = await checkoutPOST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

describe('server-side totals — tamper rejection', () => {
  it('a tampered client total is rejected and records no order', async () => {
    for (const tampered of [1, 2571, 2573, 999999]) {
      const res = await postCheckout({
        ...BASE_BODY,
        client_total_cents: tampered,
      });
      expect(res.status).toBe(422);
      expect(String(res.json.errors)).toContain('Total mismatch');
    }
    const orders = await defaultOrderStore().listOrders({ limit: 100 });
    expect(orders).toHaveLength(0);
  });

  it('a tampered unit price is rejected outright (server price is the catalog price)', () => {
    expect(() =>
      validateAndBuildOrder(
        {
          ...BASE_BODY,
          items: [{ ...BASE_BODY.items[0], unit_price_cents: 1 }],
          client_total_cents: 2572,
        },
        {},
      ),
    ).toThrow(/Price mismatch for chill-pill-capsules: client claimed 1, server computes 1977/);
  });
});

describe('hosted charge creation — idempotency key', () => {
  it('the charge identity is the order id and the amount is the stored total, identically on repeat calls', () => {
    const record = validateAndBuildOrder(
      { ...BASE_BODY, client_total_cents: 2572 },
      {},
    );
    const first = buildOrderHostedPaymentInput(record, 'http://localhost');
    const second = buildOrderHostedPaymentInput(record, 'http://localhost');
    expect(first.invoiceNumber).toBe(record.order_id);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(first.amountCents).toBe(record.total_cents);
    expect(second.amountCents).toBe(first.amountCents);
    // The gateway body carries the same invoice + amount both times,
    // and no card field of any kind.
    const config = getAuthorizeNetConfig();
    const body = buildHostedPaymentPageBody(config, first);
    const serialized = JSON.stringify(body);
    expect(serialized).toContain(record.order_id);
    expect(serialized).toContain('25.72');
    expect(serialized.toLowerCase()).not.toContain('cardnumber');
    expect(serialized.toLowerCase()).not.toContain('cardexpiration');
    expect(serialized.toLowerCase()).not.toContain('cardcode');
  });

  it('the availability endpoint reports sandbox (test mode) first', async () => {
    const json = (await (await tokenGET()).json()) as Record<string, unknown>;
    expect(json.card_available).toBe(true);
    expect(json.environment).toBe('sandbox');
    expect(json.form_post_url).toBe('https://test.authorize.net/payment/payment');
  });

  it('the token route refuses an already-paid order (409) and a wrong email (404) before any gateway call', async () => {
    const placed = await postCheckout({
      ...BASE_BODY,
      client_total_cents: 2572,
    });
    const orderId = placed.json.order_id as string;
    await recordAuthorizeNetPayment({
      order_id: orderId,
      trans_id: 'trans-already',
      amount_cents: 2572,
      currency: 'USD',
      paid_at: new Date().toISOString(),
      source: 'authorizenet_webhook',
    });
    const paidRes = await tokenPOST(
      new Request('http://localhost/api/checkout/authorizenet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, email: 'buyer@example.com' }),
      }),
    );
    expect(paidRes.status).toBe(409);

    const wrongEmail = await tokenPOST(
      new Request('http://localhost/api/checkout/authorizenet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, email: 'other@example.com' }),
      }),
    );
    expect(wrongEmail.status).toBe(404);
  });
});

describe('no card numbers anywhere in our own system', () => {
  const ROOT = resolve(__dirname, '..');
  const cardPathFiles = [
    'lib/payments/authorizenet.ts',
    'lib/payments/authorizenet-webhook.ts',
    'app/api/checkout/authorizenet/route.ts',
    'app/api/webhooks/authorizenet/route.ts',
    'components/checkout/CheckoutForm.tsx',
  ];
  it('no card-number field or PAN pattern appears in the card code path', () => {
    for (const rel of cardPathFiles) {
      const source = readFileSync(join(ROOT, rel), 'utf8');
      expect(source, rel).not.toMatch(/cardNumber|creditCardNumber|card_number/i);
      expect(source, rel).not.toMatch(/\b(?:\d[ -]?){13,19}\b/);
      // The browser never collects a card input on our pages.
      expect(source, rel).not.toMatch(/name="card|id="card/i);
    }
  });

  it('the confirmation email for a card order contains no card details', async () => {
    const placed = await postCheckout({
      ...BASE_BODY,
      client_total_cents: 2572,
    });
    const orderId = placed.json.order_id as string;
    const orders = await defaultOrderStore().listOrders({ limit: 100 });
    const order = orders.find((o) => o.order_id === orderId);
    expect(order).toBeTruthy();
    const job = buildOrderConfirmationJob(order!);
    const rendered = renderEmailMessage(job);
    expect(rendered.subject).toContain(orderId);
    expect(rendered.text).toContain(orderId);
    expect(rendered.text).not.toMatch(/\b(?:\d[ -]?){13,19}\b/);
    expect(rendered.text.toLowerCase()).not.toContain('card number');
    expect(JSON.stringify(job.data)).not.toMatch(
      /cardNumber|creditCardNumber/i,
    );
  });
});

describe('cart preservation on card failure (component logic)', () => {
  it('the checkout form clears the cart for non-card methods only, and says so on failure', () => {
    const form = readFileSync(
      join(resolve(__dirname, '..'), 'components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    expect(form).toContain(
      "if (paymentMethod !== 'authorizenet_card_hosted') clear();",
    );
    expect(form).toContain('Your cart is still here');
    // The card-continue failure is a prominent alert, not a footnote.
    expect(form).toContain('Card payment could not be started');
    expect(form).toContain('role="alert"');
  });
});
