/**
 * Stripe embedded checkout — unit laws (owner directive 2026-10-19).
 *
 * - Env gating: card is available only with secret + publishable keys;
 *   the webhook needs the webhook secret too. Absent env never crashes.
 * - Session line items + total come from the SERVER order record only.
 * - The subscriber discount is carried as a one-off coupon so the
 *   session total equals the order total to the cent.
 * - The paid ledger records once per order (idempotent) and is the only
 *   writer of 'paid' for card orders.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildEmbeddedSessionParams,
  buildSessionLineItems,
  buildShippingOptions,
  createEmbeddedCheckoutSession,
  expectedSessionTotalCents,
  findStripePayment,
  getStripeConfig,
  recordStripePayment,
  resolveOrderStatus,
  STRIPE_TAX_CODE_GENERAL,
  type StripeClientLike,
} from './stripe';
import type { OrderRecord } from '../checkout/order';
import { closeAllEventPools } from '../events/event-store';

const DIR = mkdtempSync(join(tmpdir(), 'stripe-payments-'));
const LEDGER = join(DIR, 'stripe-payments.jsonl');
let savedLedgerPath: string | undefined;

beforeEach(() => {
  savedLedgerPath = process.env.STRIPE_PAYMENTS_LEDGER_PATH;
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = LEDGER;
});
afterEach(() => {
  if (savedLedgerPath === undefined) {
    delete process.env.STRIPE_PAYMENTS_LEDGER_PATH;
  } else {
    process.env.STRIPE_PAYMENTS_LEDGER_PATH = savedLedgerPath;
  }
});

function record(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    order_id: 'AWK-20261019-TEST03',
    created_at: '2026-10-19T00:00:00.000Z',
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test Customer', email: 'customer@example.com' },
    items: [
      {
        product_handle: 'gaias-rose-soap',
        title: "Gaia's Rose Soap",
        quantity: 2,
        unit_price_cents: 1177,
      },
    ],
    bundle: {
      bundle_id: 'soap-style-collection-5',
      slots: [],
      price_cents: 3577,
      savings_cents: 1208,
    },
    subtotal_cents: 5931,
    subscriber_discount_cents: 0,
    shipping_cents: 0,
    shipping_status: 'FREE',
    free_shipping_threshold_cents: 4500,
    total_cents: 5931,
    is_subscriber_asserted: false,
    is_subscriber_verified: false,
    payment_method: 'stripe_card_embedded',
    ...overrides,
  };
}

describe('getStripeConfig', () => {
  it('card unavailable and webhook unconfigured with no env', () => {
    const config = getStripeConfig({});
    expect(config.cardAvailable).toBe(false);
    expect(config.webhookConfigured).toBe(false);
  });

  it('card available with both keys; webhook needs its secret', () => {
    const config = getStripeConfig({
      STRIPE_SECRET_KEY: 'sk_test_x',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    });
    expect(config.cardAvailable).toBe(true);
    expect(config.webhookConfigured).toBe(false);
    const full = getStripeConfig({
      STRIPE_SECRET_KEY: 'sk_test_x',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
    });
    expect(full.webhookConfigured).toBe(true);
  });
});

describe('session construction from the server record', () => {
  it('line items mirror the record and the totals agree to the cent', () => {
    const rec = record();
    const items = buildSessionLineItems(rec);
    expect(items).toHaveLength(2);
    expect(items[0].price_data.unit_amount).toBe(1177);
    expect(items[0].quantity).toBe(2);
    expect(items[1].price_data.unit_amount).toBe(3577);
    expect(expectedSessionTotalCents(rec)).toBe(5931);
    const params = buildEmbeddedSessionParams(
      rec,
      'https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}',
    );
    expect(params.ui_mode).toBe('embedded');
    expect(params.mode).toBe('payment');
    expect(params.customer_email).toBe('customer@example.com');
    expect(params.metadata).toEqual({ order_id: 'AWK-20261019-TEST03' });
    expect(params).not.toHaveProperty('discounts');
  });

  it('line items carry Stripe Tax fields: exclusive behavior + general tax code', () => {
    const items = buildSessionLineItems(record());
    for (const item of items) {
      expect(item.price_data.tax_behavior).toBe('exclusive');
      expect(item.price_data.tax_code).toBe('txcd_99999999');
    }
    expect(STRIPE_TAX_CODE_GENERAL).toBe('txcd_99999999');
  });

  it('session params enable Stripe Tax + US shipping address collection', () => {
    const params = buildEmbeddedSessionParams(
      record(),
      'https://example.com/checkout/return',
    );
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.shipping_address_collection).toEqual({
      allowed_countries: ['US'],
    });
  });

  it('free-shipping record: shipping option is 0¢ "Free shipping", no shipping line item', () => {
    const rec = record(); // shipping_cents 0, status FREE
    expect(buildShippingOptions(rec)).toEqual([
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'usd' },
          display_name: 'Free shipping',
        },
      },
    ]);
    const params = buildEmbeddedSessionParams(
      rec,
      'https://example.com/checkout/return',
    );
    expect(params.shipping_options).toEqual(buildShippingOptions(rec));
  });

  it('flat-shipping record: shipping is a 595¢ shipping_option, total includes it pre-tax', () => {
    const rec = record({
      items: [
        {
          product_handle: 'gaias-rose-soap',
          title: "Gaia's Rose Soap",
          quantity: 1,
          unit_price_cents: 1177,
        },
      ],
      bundle: null,
      subtotal_cents: 1177,
      shipping_cents: 595,
      shipping_status: 'FLAT',
      total_cents: 1177 + 595,
    });
    // No shipping LINE item — shipping rides in shipping_options only.
    expect(buildSessionLineItems(rec)).toHaveLength(1);
    expect(expectedSessionTotalCents(rec)).toBe(1772);
    expect(buildShippingOptions(rec)).toEqual([
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 595, currency: 'usd' },
          display_name: 'Standard shipping',
        },
      },
    ]);
    const params = buildEmbeddedSessionParams(
      rec,
      'https://example.com/checkout/return',
    );
    expect(params.shipping_options).toEqual(buildShippingOptions(rec));
  });

  it('refuses an internally inconsistent record', () => {
    expect(() =>
      buildEmbeddedSessionParams(record({ total_cents: 1 }), 'https://x/'),
    ).toThrow(/internally inconsistent/);
  });

  it('creates a coupon for the subscriber discount so totals match', async () => {
    const rec = record({
      subscriber_discount_cents: 593,
      total_cents: 5931 - 593,
      is_subscriber_verified: true,
    });
    const calls: { coupons: unknown[]; sessions: Record<string, unknown>[] } = {
      coupons: [],
      sessions: [],
    };
    const fake: StripeClientLike = {
      coupons: {
        create: async (params) => {
          calls.coupons.push(params);
          return { id: 'cpn_test_1' };
        },
      },
      checkout: {
        sessions: {
          create: async (params) => {
            calls.sessions.push(params);
            return { id: 'cs_test_1', client_secret: 'cs_secret_1' };
          },
        },
      },
      webhooks: {
        constructEvent: () => {
          throw new Error('not used');
        },
      },
    };
    const session = await createEmbeddedCheckoutSession(
      rec,
      fake,
      'https://example.com/checkout/return',
    );
    expect(session).toEqual({ id: 'cs_test_1', client_secret: 'cs_secret_1' });
    expect(calls.coupons).toHaveLength(1);
    expect(
      (calls.coupons[0] as { amount_off: number }).amount_off,
    ).toBe(593);
    expect(calls.sessions[0].discounts).toEqual([{ coupon: 'cpn_test_1' }]);
  });
});

describe('paid ledger', () => {
  it('records once per order and resolves paid status', async () => {
    const payment = {
      order_id: 'AWK-20261019-PAID01',
      stripe_session_id: 'cs_test_9',
      payment_intent_id: 'pi_test_9',
      amount_total_cents: 5931,
      tax_cents: 0,
      currency: 'usd',
      paid_at: '2026-10-19T01:00:00.000Z',
      source: 'stripe_webhook' as const,
    };
    await recordStripePayment(payment);
    const again = await recordStripePayment({
      ...payment,
      stripe_session_id: 'cs_test_DUPLICATE',
    });
    expect(again.stripe_session_id).toBe('cs_test_9');
    const lines = readFileSync(LEDGER, 'utf8')
      .trim()
      .split('\n')
      .filter((l) => l.includes('AWK-20261019-PAID01'));
    expect(lines).toHaveLength(1);

    const found = await findStripePayment('AWK-20261019-PAID01');
    expect(found?.amount_total_cents).toBe(5931);
    expect(found?.tax_cents).toBe(0);
    expect(await findStripePayment('AWK-UNKNOWN')).toBeNull();

    const rec = record({ order_id: 'AWK-20261019-PAID01' });
    expect(resolveOrderStatus(rec, found)).toBe('paid');
    expect(resolveOrderStatus(rec, null)).toBe('pending_payment');
  });

  it('selects the Postgres driver when DATABASE_URL is set — never a silent file fallback', async () => {
    const savedUrl = process.env.DATABASE_URL;
    // Closed port: the PG attempt fails fast at connect time.
    process.env.DATABASE_URL = 'postgres://127.0.0.1:1/awaken_unreachable';
    try {
      await expect(
        recordStripePayment({
          order_id: 'AWK-20261019-PGSEL',
          stripe_session_id: 'cs_test_pgsel',
          payment_intent_id: 'pi_test_pgsel',
          amount_total_cents: 100,
          tax_cents: 0,
          currency: 'usd',
          paid_at: '2026-10-19T02:00:00.000Z',
          source: 'stripe_webhook' as const,
        }),
      ).rejects.toThrow();
      const after = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : '';
      expect(after).not.toContain('AWK-20261019-PGSEL');
    } finally {
      if (savedUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = savedUrl;
      }
      await closeAllEventPools();
    }
  });
});
