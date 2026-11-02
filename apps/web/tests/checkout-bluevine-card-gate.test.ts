/**
 * BLUEVINE CARD GATE — regression suite (owner directive 2026-10-31:
 * a live card option through Bluevine; staged 2026-11-01 with the
 * checkout replacement).
 *
 * The card option is GATED OFF by configuration. Laws under test:
 * - With NEXT_PUBLIC_BLUEVINE_PAYMENT_LINK_URL unset (the default —
 *   and today's state: no verified Bluevine payment link exists), the
 *   helper resolves null, 'bluevine_card_link' is REJECTED at route
 *   and core level, a normal order's instructions carry no payment
 *   link and no card/hosted wording, and the checkout form renders
 *   the card choice ONLY inside its configuration conditional (so a
 *   customer never sees a card promise that cannot be fulfilled).
 * - With a valid https link configured, the method is accepted: the
 *   order total is the same server-authoritative, tax-inclusive
 *   figure as every other live rail (the customer enters that total
 *   on Bluevine's hosted page), the response carries the link and the
 *   hosted-page wording (never "Stripe", never on-site card wording),
 *   and the stored record carries 'bluevine_card_link'.
 * - A non-https or malformed configured value fails closed (treated
 *   as unset) — a bad config can never half-open the gate.
 *
 * The link value used here is a TEST FIXTURE (an example.invalid-style
 * placeholder on a reserved domain), never a real payment link.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POST } from '../app/api/checkout/route';
import {
  bluevineCardConfigured,
  bluevinePaymentLinkUrl,
  validateAndBuildOrder,
} from '../lib/checkout/order';

const DIR = mkdtempSync(join(tmpdir(), 'checkout-bluevine-card-gate-'));
const LEDGER = join(DIR, 'orders.jsonl');
process.env.ORDERS_LEDGER_PATH = LEDGER;
process.env.SUBSCRIPTIONS_LEDGER_PATH = join(DIR, 'subscriptions.jsonl');

const ENV_NAME = 'NEXT_PUBLIC_BLUEVINE_PAYMENT_LINK_URL';
const SAVED_ENV = process.env[ENV_NAME];
const FIXTURE_LINK = 'https://pay.example.invalid/awakenagain-card';

const CUSTOMER = { name: 'Gate Tester', email: 'gate@example.com' };
const CAPSULE = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};
const UT_ADDRESS = {
  line1: '100 S Main St',
  city: 'Salt Lake City',
  state: 'UT',
  postal_code: '84101',
};
// $19.77 + $5.95 shipping + $1.67 Utah tax = $27.39 (lib/tax, 8.45%).
const TAXED_TOTAL = 2739;

async function postCheckout(body: unknown) {
  const res = await POST(
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

function lastOrder(): Record<string, unknown> {
  const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
}

beforeEach(() => {
  delete process.env[ENV_NAME];
});

afterAll(() => {
  if (SAVED_ENV === undefined) delete process.env[ENV_NAME];
  else process.env[ENV_NAME] = SAVED_ENV;
});

describe('bluevine payment link config helper', () => {
  it('is null / not configured while unset (the default state)', () => {
    expect(bluevinePaymentLinkUrl()).toBeNull();
    expect(bluevineCardConfigured()).toBe(false);
  });

  it('resolves a valid https link', () => {
    process.env[ENV_NAME] = FIXTURE_LINK;
    expect(bluevinePaymentLinkUrl()).toBe(FIXTURE_LINK);
    expect(bluevineCardConfigured()).toBe(true);
  });

  it('fails closed on a non-https or malformed value', () => {
    process.env[ENV_NAME] = 'http://pay.example.invalid/insecure';
    expect(bluevinePaymentLinkUrl()).toBeNull();
    expect(bluevineCardConfigured()).toBe(false);
    process.env[ENV_NAME] = 'not a url';
    expect(bluevinePaymentLinkUrl()).toBeNull();
    expect(bluevineCardConfigured()).toBe(false);
  });
});

describe('card gate OFF (no link configured — today)', () => {
  it('rejects bluevine_card_link at route and core level', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'bluevine_card_link',
      client_total_cents: TAXED_TOTAL,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /Unknown payment method/,
    );
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: UT_ADDRESS,
        payment_method: 'bluevine_card_link',
        client_total_cents: TAXED_TOTAL,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('a Bluevine invoice order carries NO payment link and NO card wording', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'bluevine_invoice',
      client_total_cents: TAXED_TOTAL,
    });
    expect(status).toBe(200);
    const payment = json.payment as Record<string, unknown>;
    expect(payment.payment_link).toBeUndefined();
    const instructions = JSON.stringify(json.payment);
    expect(instructions).not.toMatch(/hosted/i);
    expect(instructions).not.toMatch(/pay by card/i);
    expect(instructions).not.toMatch(/Stripe/);
    expect(json.total_cents).toBe(TAXED_TOTAL);
  });

  it('the checkout form renders the card choice ONLY inside the gate conditional', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    // The gate is evaluated from the shared config helper…
    expect(form).toContain('bluevineCardConfigured()');
    // …and the card radio exists only within that conditional block.
    const gateIdx = form.indexOf('BLUEVINE_CARD_AVAILABLE ?');
    const radioIdx = form.indexOf('value="bluevine_card_link"');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(radioIdx).toBeGreaterThan(gateIdx);
    // The hosted-page wording lives in that same gated block / the
    // server-driven result branch — and "Stripe" never appears as an
    // offered method in the form.
    expect(form).not.toContain('stripe_card_embedded');
  });
});

describe('card gate ON (verified link configured)', () => {
  it('accepts the method with the hosted-page instructions and the tax-inclusive total', async () => {
    process.env[ENV_NAME] = FIXTURE_LINK;
    const { status, json } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'bluevine_card_link',
      client_total_cents: TAXED_TOTAL,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.payment_method).toBe('bluevine_card_link');
    // Same math as every live rail: tax included, shipping included.
    expect(json.tax_cents).toBe(167);
    expect(json.shipping_cents).toBe(595);
    expect(json.total_cents).toBe(TAXED_TOTAL);
    const payment = json.payment as Record<string, unknown>;
    expect(payment.method).toBe('bluevine_card_link');
    expect(payment.payment_link).toBe(FIXTURE_LINK);
    expect(String(payment.note)).toMatch(/pay by card through Bluevine/i);
    expect(String(payment.note)).toMatch(/secure hosted payment page/);
    expect(String(payment.note)).toMatch(/order number as the reference/);
    expect(String(payment.note)).not.toMatch(/Stripe/);
    // No handles ride along on the card instructions.
    expect(payment.cash_app).toBeUndefined();
    expect(payment.venmo).toBeUndefined();

    const saved = lastOrder();
    expect(saved.payment_method).toBe('bluevine_card_link');
    expect(saved.tax_cents).toBe(167);
    expect(saved.total_cents).toBe(TAXED_TOTAL);
  });

  it('a Utah card order claiming the pre-tax total is still rejected (server authority)', async () => {
    process.env[ENV_NAME] = FIXTURE_LINK;
    const { status } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'bluevine_card_link',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(422);
  });
});
