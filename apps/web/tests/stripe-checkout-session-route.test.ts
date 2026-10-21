/**
 * Embedded checkout session route — regression suite (2026-10-19).
 *
 * Laws under test:
 * - A session is created ONLY for a persisted order placed for
 *   'stripe_card_embedded', looked up by order ID + ordering email.
 * - Session params come from the SERVER order record (unit amounts,
 *   order binding in metadata) — the client never supplies an amount.
 * - Wrong email → generic 404; a non-card order → 409 (no session);
 *   Stripe unconfigured → GET reports unavailable and POST degrades
 *   with 503 + steering copy, never a crash.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hoisted = vi.hoisted(() => {
  const sessionParams: Record<string, unknown>[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          sessionParams.push(params);
          return { id: 'cs_test_123', client_secret: 'cs_test_secret_123' };
        },
      },
    },
    coupons: { create: async () => ({ id: 'cpn_test_1' }) },
    webhooks: {
      constructEvent: () => {
        throw new Error('unused in this suite');
      },
    },
  };
  return { sessionParams, client };
});

vi.mock('../lib/payments/stripe', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/payments/stripe')>();
  return { ...actual, createStripeClient: () => hoisted.client };
});

import { GET, POST } from '../app/api/stripe/checkout-session/route';
import { POST as postCheckout } from '../app/api/checkout/route';

const DIR = mkdtempSync(join(tmpdir(), 'stripe-session-route-'));
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
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ORDERS_LEDGER_PATH = join(DIR, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(DIR, 'subscriptions.jsonl');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  delete process.env.RESEND_API_KEY;
  hoisted.sessionParams.length = 0;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function seedOrder(paymentMethod: string): Promise<string> {
  const res = await postCheckout(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        payment_method: paymentMethod,
        // $19.77 is under the $45 free-shipping threshold: the server
        // total includes the flat $5.95 shipping (owner decision
        // 2026-10-20).
        client_total_cents: 1977 + 595,
      }),
    }),
  );
  const json = (await res.json()) as { ok: boolean; order_id: string };
  expect(res.status).toBe(200);
  expect(json.ok).toBe(true);
  return json.order_id;
}

async function postSession(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/stripe/checkout-session', {
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

describe('POST /api/stripe/checkout-session', () => {
  it('creates an embedded session bound to the server order totals', async () => {
    const orderId = await seedOrder('stripe_card_embedded');
    const { status, json } = await postSession({
      order_id: orderId,
      email: CUSTOMER.email,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.client_secret).toBe('cs_test_secret_123');
    expect(json.publishable_key).toBe('pk_test_fake');

    expect(hoisted.sessionParams).toHaveLength(1);
    const params = hoisted.sessionParams[0];
    expect(params.ui_mode).toBe('embedded');
    expect(params.metadata).toEqual({ order_id: orderId });
    expect(params.client_reference_id).toBe(orderId);
    expect(String(params.return_url)).toContain('{CHECKOUT_SESSION_ID}');
    const lineItems = params.line_items as {
      price_data: {
        unit_amount: number;
        tax_behavior?: string;
        tax_code?: string;
      };
      quantity: number;
    }[];
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].price_data.unit_amount).toBe(1977);
    expect(lineItems[0].quantity).toBe(1);
    // Stripe Tax (2026-10-20): tax-exclusive line items with the
    // general tax code; tax calculated from the collected US address.
    expect(lineItems[0].price_data.tax_behavior).toBe('exclusive');
    expect(lineItems[0].price_data.tax_code).toBe('txcd_99999999');
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.shipping_address_collection).toEqual({
      allowed_countries: ['US'],
    });
    // Shipping rides as a shipping_option matching the order (flat
    // $5.95 — the order is under the free-shipping threshold), never
    // as an extra line item.
    expect(params.shipping_options).toEqual([
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 595, currency: 'usd' },
          display_name: 'Standard shipping',
        },
      },
    ]);
  });

  it('rejects a mismatched email with the generic 404', async () => {
    const orderId = await seedOrder('stripe_card_embedded');
    const { status, json } = await postSession({
      order_id: orderId,
      email: 'someone-else@example.com',
    });
    expect(status).toBe(404);
    expect(json.ok).toBe(false);
    expect(hoisted.sessionParams).toHaveLength(0);
  });

  it('leaves non-card orders untouched (409, no session)', async () => {
    const orderId = await seedOrder('cash_app_or_venmo');
    const { status } = await postSession({
      order_id: orderId,
      email: CUSTOMER.email,
    });
    expect(status).toBe(409);
    expect(hoisted.sessionParams).toHaveLength(0);
  });
});

describe('Stripe unconfigured — graceful degradation', () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  });

  it('GET reports card unavailable with no publishable key', async () => {
    const res = await GET();
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.card_available).toBe(false);
    expect(json.publishable_key).toBeNull();
  });

  it('POST degrades with 503 and steering copy — the order still exists', async () => {
    const orderId = await seedOrder('stripe_card_embedded');
    const { status, json } = await postSession({
      order_id: orderId,
      email: CUSTOMER.email,
    });
    expect(status).toBe(503);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Cash App/);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Venmo/);
  });

  it('GET reports availability when configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
    const res = await GET();
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.card_available).toBe(true);
    expect(json.publishable_key).toBe('pk_test_fake');
  });
});
