/**
 * FEATURE SUITE — FIRST10 coupon at checkout (owner request 2026-10-24,
 * staged build — the social post promises FIRST10: 10% off a first
 * order, first-time customers only, once per customer).
 *
 * Laws under test:
 * - A valid FIRST10 (any case) applies 10% off the product subtotal —
 *   the same discountable base + rounding as the subscriber discount;
 *   shipping is NEVER discounted — and the discount + code are stored
 *   on the order record and returned in the checkout response.
 * - Server-side validation only: an unknown code is REJECTED (422)
 *   with a friendly error; no order is recorded.
 * - First-time only, enforced by the route's order-store lookup: a
 *   second order from the same email (coupon or not) cannot use
 *   FIRST10 again — whether the block is "already used" (prior order
 *   carried the coupon) or "not first-time" (prior order without it).
 * - NO STACKING: a verified Living Grimoire subscriber keeps the
 *   larger single discount (their 10% subscriber discount); FIRST10 is
 *   not applied on top, the total is exactly the subscriber-only
 *   total, and a clear coupon_message explains why.
 * - The discount flows to the confirmation email (job data + the
 *   Template 1 render), to the order-status summary, and keeps the
 *   dormant Stripe session totals internally consistent.
 * - The checkout UI carries the coupon field + Apply flow.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POST } from '../app/api/checkout/route';
import { POST as statusPOST } from '../app/api/orders/status/route';
import {
  normalizeCouponCode,
  parseCouponCode,
  validateAndBuildOrder,
} from '../lib/checkout/order';
import { previewCartTotals } from '../components/checkout/cart-preview';
import { buildOrderConfirmationJob } from '../lib/jobs/order-confirmation';
import { renderPurchaseConfirmation } from '../lib/jobs/purchase-confirmation-email';
import type { PurchaseConfirmationData } from '../lib/jobs/email';
import { expectedSessionTotalCents } from '../lib/payments/stripe';

const DIR = mkdtempSync(join(tmpdir(), 'checkout-coupon-'));
const ORDERS_LEDGER = join(DIR, 'orders.jsonl');
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
const TRACKING_LEDGER = join(DIR, 'tracking.jsonl');
process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;
process.env.ORDER_TRACKING_LEDGER_PATH = TRACKING_LEDGER;

beforeEach(() => {
  // Stores read these paths at call time — re-pin them so this suite's
  // ledgers are the ones in use regardless of suite ordering.
  process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
  process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;
  process.env.ORDER_TRACKING_LEDGER_PATH = TRACKING_LEDGER;
  writeFileSync(ORDERS_LEDGER, '', 'utf8');
  writeFileSync(SUBS_LEDGER, '', 'utf8');
  writeFileSync(TRACKING_LEDGER, '', 'utf8');
});

const CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};
// Capsule math: subtotal 1977; 10% discount = 1977 − round(1977×0.9)
// = 1977 − 1779 = 198; shipping stays the FLAT 595 (never discounted);
// coupon total = 1977 − 198 + 595 = 2374. Standard total = 2572.
// Verified-subscriber total = 1779 (discount 198, free shipping).

function subscriptionLine(email: string, status: string) {
  return JSON.stringify({
    subscription_id: 'SUB-COUPON-0001',
    created_at: '2026-10-13T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
  });
}

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

function ledgerOrders(): Record<string, unknown>[] {
  const raw = readFileSync(ORDERS_LEDGER, 'utf8').trim();
  return raw ? raw.split('\n').map((l) => JSON.parse(l) as Record<string, unknown>) : [];
}

describe('coupon code parsing', () => {
  it('normalizes case + whitespace; blank means no coupon', () => {
    expect(normalizeCouponCode(' first10 ')).toBe('FIRST10');
    expect(normalizeCouponCode('')).toBeNull();
    expect(normalizeCouponCode(undefined)).toBeNull();
    expect(parseCouponCode('First10')).toBe('FIRST10');
    expect(parseCouponCode('')).toBeNull();
  });

  it('unknown codes throw the friendly error', () => {
    expect(() => parseCouponCode('BOGUS20')).toThrow(/coupon code doesn't look right/i);
  });
});

describe('validateAndBuildOrder — FIRST10', () => {
  const customer = { name: 'New Customer', email: 'new@example.com' };

  it('valid FIRST10 applies 10% off products only and is stored on the record', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE_ITEM],
      customer,
      coupon_code: 'first10', // lowercase — case-insensitive
      client_total_cents: 2374,
    });
    expect(record.coupon_code).toBe('FIRST10');
    expect(record.coupon_discount_cents).toBe(198);
    expect(record.subscriber_discount_cents).toBe(0);
    expect(record.shipping_cents).toBe(595); // shipping NOT discounted
    expect(record.total_cents).toBe(2374);
  });

  it('unknown code is rejected and changes nothing', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE_ITEM],
        customer,
        coupon_code: 'HALFOFF',
        client_total_cents: 2572,
      }),
    ).toThrow(/coupon code doesn't look right/i);
  });

  it('already-used eligibility is rejected with the one-time message', () => {
    expect(() =>
      validateAndBuildOrder(
        {
          items: [CAPSULE_ITEM],
          customer,
          coupon_code: 'FIRST10',
          client_total_cents: 2374,
        },
        { couponEligibility: { hasPriorOrder: true, hasUsedCoupon: true } },
      ),
    ).toThrow(/already been used/i);
  });

  it('a prior order without the coupon still blocks FIRST10 (first-time only)', () => {
    expect(() =>
      validateAndBuildOrder(
        {
          items: [CAPSULE_ITEM],
          customer,
          coupon_code: 'FIRST10',
          client_total_cents: 2374,
        },
        { couponEligibility: { hasPriorOrder: true, hasUsedCoupon: false } },
      ),
    ).toThrow(/first-time customers/i);
  });

  it('a tampered client total is still rejected with a coupon', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE_ITEM],
        customer,
        coupon_code: 'FIRST10',
        client_total_cents: 1,
      }),
    ).toThrow(/Total mismatch/);
  });

  it('subscriber no-stack at the builder level: subscriber discount stands, coupon adds nothing, message explains', () => {
    const record = validateAndBuildOrder(
      {
        items: [CAPSULE_ITEM],
        customer,
        is_subscriber: true,
        coupon_code: 'FIRST10',
        client_total_cents: 1779,
      },
      { isSubscriberVerified: true },
    );
    expect(record.subscriber_discount_cents).toBe(198);
    expect(record.coupon_code).toBeNull();
    expect(record.coupon_discount_cents).toBe(0);
    expect(record.total_cents).toBe(1779); // exactly the subscriber-only total
    expect(record.coupon_message).toMatch(/can.t be combined/i);
  });
});

describe('checkout route — FIRST10 end to end', () => {
  it('first order with FIRST10 succeeds, stores the coupon, and returns it', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'First Timer', email: 'first@example.com' },
      coupon_code: 'FIRST10',
      payment_method: 'bookipi_invoice',
      client_total_cents: 2374,
    });
    expect(status).toBe(200);
    expect(json.coupon_code).toBe('FIRST10');
    expect(json.coupon_discount_cents).toBe(198);
    expect(json.total_cents).toBe(2374);
    const saved = ledgerOrders();
    expect(saved).toHaveLength(1);
    expect(saved[0].coupon_code).toBe('FIRST10');
    expect(saved[0].coupon_discount_cents).toBe(198);
    expect(saved[0].total_cents).toBe(2374);
  });

  it('second use by the same email is rejected (already used), and no second order is recorded', async () => {
    const customer = { name: 'Repeat', email: 'repeat@example.com' };
    const first = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      coupon_code: 'FIRST10',
      client_total_cents: 2374,
    });
    expect(first.status).toBe(200);

    const second = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      coupon_code: 'first10',
      client_total_cents: 2374,
    });
    expect(second.status).toBe(422);
    expect(String((second.json.errors as string[]).join(' '))).toMatch(
      /already been used/i,
    );
    expect(ledgerOrders()).toHaveLength(1); // unchanged — no total changed, no order placed
  });

  it('a returning customer (prior order, no coupon) is rejected as not first-time', async () => {
    const customer = { name: 'Regular', email: 'regular@example.com' };
    const plain = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      client_total_cents: 2572,
    });
    expect(plain.status).toBe(200);

    const attempt = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      coupon_code: 'FIRST10',
      client_total_cents: 2374,
    });
    expect(attempt.status).toBe(422);
    expect(String((attempt.json.errors as string[]).join(' '))).toMatch(
      /first-time customers/i,
    );
    expect(ledgerOrders()).toHaveLength(1);
  });

  it('unknown code via the route is a friendly 422 and records nothing', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Typo', email: 'typo@example.com' },
      coupon_code: 'FIRST1O', // letter O instead of zero
      client_total_cents: 2572,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /coupon code doesn't look right/i,
    );
    expect(ledgerOrders()).toHaveLength(0);
  });

  it('verified subscriber + FIRST10: no stacking, subscriber total, clear message, coupon NOT consumed', async () => {
    writeFileSync(SUBS_LEDGER, subscriptionLine('member@example.com', 'active') + '\n', 'utf8');
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Member', email: 'member@example.com' },
      is_subscriber: true,
      coupon_code: 'FIRST10',
      client_total_cents: 1779,
    });
    expect(status).toBe(200);
    expect(json.subscriber_discount_cents).toBe(198);
    expect(json.coupon_code).toBeNull();
    expect(json.coupon_discount_cents).toBe(0);
    expect(json.total_cents).toBe(1779);
    expect(String(json.coupon_message)).toMatch(/can.t be combined/i);
    const saved = ledgerOrders();
    expect(saved[0].coupon_discount_cents).toBe(0);
    expect(saved[0].total_cents).toBe(1779);
  });

  it('orders without a coupon are unchanged (null code, zero discount)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Plain', email: 'plain@example.com' },
      client_total_cents: 2572,
    });
    expect(status).toBe(200);
    expect(json.coupon_code).toBeNull();
    expect(json.coupon_discount_cents).toBe(0);
    expect(json.total_cents).toBe(2572);
  });
});

describe('coupon discount downstream', () => {
  it('appears in the confirmation email job data and the Template 1 render', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE_ITEM],
      customer: { name: 'First Timer', email: 'first@example.com' },
      coupon_code: 'FIRST10',
      client_total_cents: 2374,
    });
    const job = buildOrderConfirmationJob(record);
    const data = job.data as PurchaseConfirmationData;
    expect(data.coupon_code).toBe('FIRST10');
    expect(data.coupon_discount_cents).toBe(198);
    const rendered = renderPurchaseConfirmation(data);
    expect(rendered.text).toContain('Coupon FIRST10 discount (10% off): −$1.98');
    expect(rendered.text).toContain('Total: $23.74');
    expect(rendered.html).toContain('Coupon FIRST10 discount');
  });

  it('appears in the order-status summary', async () => {
    const placed = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Tracker', email: 'tracker@example.com' },
      coupon_code: 'FIRST10',
      client_total_cents: 2374,
    });
    expect(placed.status).toBe(200);
    const res = await statusPOST(
      new Request('http://localhost/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: placed.json.order_id,
          email: 'tracker@example.com',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const order = body.order as Record<string, unknown>;
    expect(order.coupon_code).toBe('FIRST10');
    expect(order.coupon_discount_cents).toBe(198);
    expect(order.subtotal_cents).toBe(1977);
    expect(order.total_cents).toBe(2374);
  });

  it('keeps dormant Stripe session totals internally consistent', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE_ITEM],
      customer: { name: 'First Timer', email: 'first@example.com' },
      coupon_code: 'FIRST10',
      client_total_cents: 2374,
    });
    expect(expectedSessionTotalCents(record)).toBe(record.total_cents);
  });

  it('client preview mirrors the server coupon math and never stacks', () => {
    const items = [
      {
        id: 'x1',
        product_handle: 'chill-pill-capsules',
        variant_id: 'chill-pill-capsules-2wk',
        quantity: 1,
        unit_price_cents: 1977,
      },
    ] as never[];
    const withCoupon = previewCartTotals(items, null, false, 'first10');
    expect(withCoupon.couponCode).toBe('FIRST10');
    expect(withCoupon.couponDiscountCents).toBe(198);
    expect(withCoupon.shippingCents).toBe(595);
    expect(withCoupon.totalCents).toBe(2374);
    const stacked = previewCartTotals(items, null, true, 'FIRST10');
    expect(stacked.couponDiscountCents).toBe(0);
    expect(stacked.subscriberDiscountCents).toBe(198);
  });

  it('checkout UI carries the coupon field, Apply flow, and discount lines', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    expect(form).toContain('Coupon code');
    expect(form).toContain('applyCoupon');
    expect(form).toContain('coupon_code: appliedCoupon');
    expect(form).toContain('coupon_discount_cents');
    expect(form).toContain('coupon_message');
  });
});
