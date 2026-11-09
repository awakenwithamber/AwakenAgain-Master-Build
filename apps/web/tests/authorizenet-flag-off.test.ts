/**
 * Authorize.net flag-off default — tests (card checkout build
 * 2026-11-09, shop orders only; adapted from the unified build's
 * flag-off suite to current main's routes and parser law).
 *
 * The card path is gated by BOTH CARD_PAYMENTS_ENABLED (exactly
 * 'true') AND the gateway credentials. While either gate is closed:
 * - config + the availability endpoint report the card path
 *   unavailable — INCLUDING with credentials present but the flag
 *   off (proven inert);
 * - the checkout route refuses an Authorize.net-method order BEFORE
 *   persistence (the payment-method parser rejects it; the route
 *   answers 422 and ZERO orders are recorded);
 * - the live flow is untouched: a Bluevine invoice order places
 *   exactly as before, and the checkout form's card radio exists
 *   only inside its server-availability conditional.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GET as checkoutTokenGET } from '../app/api/checkout/authorizenet/route';
import { POST as checkoutPOST } from '../app/api/checkout/route';
import { getAuthorizeNetConfig } from '../lib/payments/authorizenet';
import { defaultOrderStore } from '../lib/stores/order-store';

const DIR = mkdtempSync(join(tmpdir(), 'authorizenet-flag-off-'));
const ENV_KEYS = [
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'AUTHORIZENET_PAYMENTS_LEDGER_PATH',
  'AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_STATUS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH',
  'CARD_PAYMENTS_ENABLED',
  'AUTHORIZENET_API_LOGIN_ID',
  'AUTHORIZENET_TRANSACTION_KEY',
  'AUTHORIZENET_SIGNATURE_KEY',
  'AUTHORIZENET_ENV',
  'DATABASE_URL',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  const run = join(DIR, `run-${Math.random().toString(36).slice(2)}`);
  process.env.ORDERS_LEDGER_PATH = join(run, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(run, 'subscriptions.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(run, 'order-payments.jsonl');
  process.env.AUTHORIZENET_PAYMENTS_LEDGER_PATH = join(run, 'an-payments.jsonl');
  process.env.AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'an-events.jsonl');
  process.env.AUTHORIZENET_ORDER_STATUS_LEDGER_PATH = join(run, 'an-status.jsonl');
  process.env.AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH = join(run, 'an-audit.jsonl');
  delete process.env.CARD_PAYMENTS_ENABLED;
  delete process.env.AUTHORIZENET_API_LOGIN_ID;
  delete process.env.AUTHORIZENET_TRANSACTION_KEY;
  delete process.env.AUTHORIZENET_SIGNATURE_KEY;
  delete process.env.AUTHORIZENET_ENV;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const ORDER_BODY = {
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
  client_total_cents: 2572,
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

function setCredentials() {
  process.env.AUTHORIZENET_API_LOGIN_ID = 'fake-login';
  process.env.AUTHORIZENET_TRANSACTION_KEY = 'fake-transaction-key';
  process.env.AUTHORIZENET_SIGNATURE_KEY = 'fake-signature-key';
}

describe('flag off (default)', () => {
  it('config reports unavailable with neither gate satisfied', () => {
    const config = getAuthorizeNetConfig();
    expect(config.flagEnabled).toBe(false);
    expect(config.cardAvailable).toBe(false);
    expect(config.webhookConfigured).toBe(false);
  });

  it('the availability endpoint reports the card path unavailable', async () => {
    const shop = (await (await checkoutTokenGET()).json()) as Record<
      string,
      unknown
    >;
    expect(shop.card_available).toBe(false);
    expect(shop.form_post_url).toBeNull();
  });

  it('credentials alone (flag still off) keep every surface dark', async () => {
    setCredentials();
    expect(getAuthorizeNetConfig().cardAvailable).toBe(false);
    expect(getAuthorizeNetConfig().webhookConfigured).toBe(false);
    const shop = (await (await checkoutTokenGET()).json()) as Record<
      string,
      unknown
    >;
    expect(shop.card_available).toBe(false);
  });

  it("flag values other than exactly 'true' stay dark", () => {
    setCredentials();
    for (const value of ['1', 'yes', 'TRUE', 'on', ' true ']) {
      // ' true ' trims to 'true' in the config law, so it is excluded
      // from this list's expectation below; see the next test.
      if (value === ' true ') continue;
      process.env.CARD_PAYMENTS_ENABLED = value;
      expect(getAuthorizeNetConfig().flagEnabled).toBe(false);
      expect(getAuthorizeNetConfig().cardAvailable).toBe(false);
    }
  });

  it('flag alone (no credentials) also keeps every surface dark', async () => {
    process.env.CARD_PAYMENTS_ENABLED = 'true';
    expect(getAuthorizeNetConfig().flagEnabled).toBe(true);
    expect(getAuthorizeNetConfig().cardAvailable).toBe(false);
    const shop = (await (await checkoutTokenGET()).json()) as Record<
      string,
      unknown
    >;
    expect(shop.card_available).toBe(false);
  });

  it('checkout refuses a card order before persistence while the flag is off (zero orders recorded)', async () => {
    setCredentials(); // even WITH credentials — the flag rules
    const res = await postCheckout({
      ...ORDER_BODY,
      payment_method: 'authorizenet_card_hosted',
    });
    expect(res.status).toBe(422);
    const orders = await defaultOrderStore().listOrders({ limit: 100 });
    expect(orders).toHaveLength(0);
  });

  it('the live invoice flow is untouched while the flag is off', async () => {
    const res = await postCheckout({
      ...ORDER_BODY,
      payment_method: 'bluevine_invoice',
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.payment_method).toBe('bluevine_invoice');
    const orders = await defaultOrderStore().listOrders({ limit: 100 });
    expect(orders).toHaveLength(1);
  });

  it('the checkout form renders the card option only inside its availability conditional', () => {
    const form = readFileSync(
      join(
        resolve(__dirname, '..'),
        'components/checkout/CheckoutForm.tsx',
      ),
      'utf8',
    );
    const conditionalAt = form.indexOf('{cardAvailable ? (');
    const radioAt = form.indexOf('value="authorizenet_card_hosted"');
    expect(conditionalAt).toBeGreaterThan(-1);
    expect(radioAt).toBeGreaterThan(conditionalAt);
    // The availability itself comes from the server endpoint.
    expect(form).toContain("fetch('/api/checkout/authorizenet')");
  });
});
