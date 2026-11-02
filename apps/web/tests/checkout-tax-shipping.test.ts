/**
 * CHECKOUT TAX + SHIPPING — staged build 2026-11-01 (owner directive:
 * "Make it calculate tax and shipping and make it work").
 *
 * Laws under test, with exact cent math:
 * - Shipping (existing, owner decision 2026-10-20): FLAT $5.95 under
 *   the $45 free-shipping threshold; FREE at $45+; FREE for verified
 *   subscribers; computed from the PRE-discount subtotal.
 * - Sales tax (lib/tax, ported from the Oct 28 staged build): Utah
 *   delivery → the seller's Salt Lake City combined rate 8.45%
 *   (Utah Tax Commission, location 18-122, effective 2026-10-01) on
 *   the DISCOUNTED merchandise subtotal; separately stated shipping
 *   is NEVER in the tax base; out-of-state → 0 under the named
 *   no-nexus assumption. For the live rails the tax is INCLUDED in
 *   total_cents — the amount owed by invoice / Cash App / Venmo.
 * - SERVER = AUTHORITY: a Utah client total that omits the tax is
 *   not a server-computable figure and is REJECTED (Total mismatch),
 *   exactly as a shipping-omitting total already was.
 * - The dormant 'stripe_card_embedded' rail is untouched: it ignores
 *   the delivery address, records no site tax, and keeps its pre-tax
 *   total (Stripe Tax in-session) — never double-taxed.
 * - The client preview (cart-preview.ts) imports the SAME lib/tax
 *   engine, so preview totals equal server totals for the same claim.
 *
 * Basket used throughout: chill-pill-capsules 2-week variant, $19.77
 * (1977¢) — the same fixture as tests/checkout-route.test.ts.
 * Hand math (rate 845 bps, half-up):
 *   1977 × 0.0845 = 167.0565 → 167¢
 *   5931 × 0.0845 = 501.1695 → 501¢   (3 × 1977 = 5931)
 *   1779 × 0.0845 = 150.3255 → 150¢   (1977 − 198 discount = 1779)
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/checkout/route';
import { validateAndBuildOrder } from '../lib/checkout/order';
import { previewCartTotals } from '../components/checkout/cart-preview';
import type { CartItem } from '../types';

const LEDGER = join(mkdtempSync(join(tmpdir(), 'orders-tax-')), 'orders.jsonl');
process.env.ORDERS_LEDGER_PATH = LEDGER;

const CUSTOMER = { name: 'Test Customer', email: 'tax-test@example.com' };

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

const CO_ADDRESS = {
  line1: '1600 Broadway',
  city: 'Denver',
  state: 'CO',
  postal_code: '80202',
};

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

describe('checkout tax + shipping — server builder', () => {
  it('(a) Utah order under $45: $5.95 shipping, tax on the merchandise subtotal only', () => {
    // subtotal 1977; shipping 595 (1977 < 4500); tax base excludes
    // shipping: 1977 → 167 (taxing 1977+595=2572 would give 217).
    const record = validateAndBuildOrder({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      client_total_cents: 1977 + 595 + 167,
    });
    expect(record.subtotal_cents).toBe(1977);
    expect(record.shipping_cents).toBe(595);
    expect(record.shipping_status).toBe('FLAT');
    expect(record.tax_cents).toBe(167);
    expect(record.tax_breakdown?.rateBps).toBe(845);
    expect(record.tax_breakdown?.ratePercent).toBe('8.45%');
    expect(record.tax_breakdown?.taxableBaseCents).toBe(1977);
    expect(record.tax_breakdown?.shippingTaxed).toBe(false);
    expect(record.tax_breakdown?.provenance).toContain(
      'Utah State Tax Commission',
    );
    expect(record.total_cents).toBe(2739);
    expect(record.delivery_address?.state).toBe('UT');
    expect(record.delivery_address?.postalCode).toBe('84101');
    expect(record.delivery_address?.country).toBe('US');
  });

  it('(b) Utah order at $45+: free shipping, tax still applies', () => {
    // 3 × 1977 = 5931 ≥ 4500 → shipping 0; tax 5931 → 501.
    const record = validateAndBuildOrder({
      items: [{ ...CAPSULE, quantity: 3 }],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      client_total_cents: 5931 + 0 + 501,
    });
    expect(record.subtotal_cents).toBe(5931);
    expect(record.shipping_cents).toBe(0);
    expect(record.shipping_status).toBe('FREE');
    expect(record.tax_cents).toBe(501);
    expect(record.total_cents).toBe(6432);
  });

  it('(c) out-of-state order: $0 tax with the assumption recorded, shipping rule unchanged', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: CO_ADDRESS,
      client_total_cents: 1977 + 595,
    });
    expect(record.tax_cents).toBe(0);
    expect(record.tax_breakdown?.collected).toBe(false);
    expect(record.tax_breakdown?.rateBps).toBe(0);
    expect(record.tax_breakdown?.notes.join(' ')).toContain('ASSUMPTION');
    expect(record.tax_breakdown?.notes.join(' ')).toContain(
      'not legal advice',
    );
    expect(record.shipping_cents).toBe(595);
    expect(record.shipping_status).toBe('FLAT');
    expect(record.total_cents).toBe(2572);
  });

  it('(d) verified subscriber: free shipping + 10% discount, tax on the discounted subtotal', () => {
    // discount = 1977 − round(1977 × 0.9) = 198; base 1779 → tax 150;
    // total = 1977 − 198 + 0 + 150 = 1929.
    const record = validateAndBuildOrder(
      {
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: UT_ADDRESS,
        is_subscriber: true,
        client_total_cents: 1929,
      },
      { isSubscriberVerified: true },
    );
    expect(record.subscriber_discount_cents).toBe(198);
    expect(record.shipping_cents).toBe(0);
    expect(record.shipping_status).toBe('FREE');
    expect(record.tax_breakdown?.taxableBaseCents).toBe(1779);
    expect(record.tax_cents).toBe(150);
    expect(record.total_cents).toBe(1929);
  });

  it('(d2) FIRST10 coupon in Utah: tax on the coupon-discounted subtotal, shipping unchanged', () => {
    // Same discount math as (d) via the coupon; the coupon never
    // changes shipping: total = 1977 − 198 + 595 + 150 = 2524.
    const record = validateAndBuildOrder(
      {
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: UT_ADDRESS,
        coupon_code: 'FIRST10',
        client_total_cents: 2524,
      },
      { couponEligibility: { hasPriorOrder: false, hasUsedCoupon: false } },
    );
    expect(record.coupon_discount_cents).toBe(198);
    expect(record.shipping_cents).toBe(595);
    expect(record.tax_cents).toBe(150);
    expect(record.total_cents).toBe(2524);
  });

  it('(e) a Utah client total that omits the tax is rejected (server authority)', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: UT_ADDRESS,
        client_total_cents: 1977 + 595, // the pre-tax total — not server-computable for a Utah order
      }),
    ).toThrow(/Total mismatch/);
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: UT_ADDRESS,
        client_total_cents: 1,
      }),
    ).toThrow(/Total mismatch/);
  });

  it('a malformed delivery address is a hard error, never a silent zero-tax order', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: { ...UT_ADDRESS, state: 'XX' },
        client_total_cents: 2739,
      }),
    ).toThrow(/state/);
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE],
        customer: CUSTOMER,
        delivery_address: { ...UT_ADDRESS, postal_code: '8410' },
        client_total_cents: 2739,
      }),
    ).toThrow(/ZIP/);
  });

  it('the dormant card rail ignores the address and records no site tax (no double tax)', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'stripe_card_embedded',
      client_total_cents: 1977 + 595, // pre-tax, as the dormant flow has always been
    });
    expect(record.payment_method).toBe('stripe_card_embedded');
    expect(record.tax_cents).toBeUndefined();
    expect(record.tax_breakdown).toBeUndefined();
    expect(record.delivery_address).toBeUndefined();
    expect(record.total_cents).toBe(2572);
  });

  it('a legacy order with no address keeps the exact legacy behavior (no tax fields)', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE],
      customer: CUSTOMER,
      client_total_cents: 1977 + 595,
    });
    expect(record.tax_cents).toBeUndefined();
    expect(record.tax_breakdown).toBeUndefined();
    expect(record.delivery_address).toBeUndefined();
    expect(record.total_cents).toBe(2572);
  });
});

describe('checkout tax + shipping — route (worked example end-to-end)', () => {
  it('POST a Utah order: response + ledger carry the full breakdown', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      payment_method: 'bookipi_invoice',
      client_total_cents: 2739,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.subtotal_cents).toBe(1977);
    expect(json.shipping_cents).toBe(595);
    expect(json.shipping_status).toBe('FLAT');
    expect(json.tax_cents).toBe(167);
    const breakdown = json.tax_breakdown as Record<string, unknown>;
    expect(breakdown.rateBps).toBe(845);
    expect(breakdown.taxableBaseCents).toBe(1977);
    // The amount owed by invoice / Cash App / Venmo is tax-inclusive.
    expect(json.total_cents).toBe(2739);

    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<
      string,
      unknown
    >;
    expect(last.order_id).toBe(json.order_id);
    expect(last.tax_cents).toBe(167);
    expect(last.total_cents).toBe(2739);
    const savedBreakdown = last.tax_breakdown as Record<string, unknown>;
    expect(savedBreakdown.rateBps).toBe(845);
    const savedAddress = last.delivery_address as Record<string, unknown>;
    expect(savedAddress.state).toBe('UT');
    expect(savedAddress.city).toBe('Salt Lake City');
  });

  it('POST a Utah order claiming the pre-tax total is rejected with 422', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE],
      customer: CUSTOMER,
      delivery_address: UT_ADDRESS,
      client_total_cents: 2572,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /Total mismatch/,
    );
  });
});

describe('checkout tax preview — shared engine, no drift', () => {
  const cartItems: CartItem[] = [
    {
      id: 'capsule-1',
      product_handle: 'chill-pill-capsules',
      variant_id: 'chill-pill-capsules-2wk',
      quantity: 1,
      unit_price_cents: 1977,
    },
  ];

  it('preview for a Utah delivery equals the server total for the same basket', () => {
    const preview = previewCartTotals(cartItems, null, false, null, {
      state: 'UT',
    });
    expect(preview.taxCents).toBe(167);
    expect(preview.taxRatePercent).toBe('8.45%');
    expect(preview.shippingCents).toBe(595);
    expect(preview.totalCents).toBe(2739);
  });

  it('subscriber-claimed preview equals the verified-subscriber server total', () => {
    const preview = previewCartTotals(cartItems, null, true, null, {
      state: 'ut', // case-insensitive, like the server parser
    });
    expect(preview.taxCents).toBe(150);
    expect(preview.totalCents).toBe(1929);
  });

  it('no delivery state yet: tax stays 0 and the preview total is the legacy figure', () => {
    const preview = previewCartTotals(cartItems, null, false, null);
    expect(preview.taxCents).toBe(0);
    expect(preview.taxRatePercent).toBeNull();
    expect(preview.totalCents).toBe(2572);
  });
});
