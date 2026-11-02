/**
 * REGRESSION SUITE — payment method at checkout (owner decisions
 * 2026-10-13 + 2026-10-21; the 2026-10-24 Bookipi flow SUPERSEDED by
 * the owner directive 2026-11-01: "Replace our checkout with the
 * bluevine set up", Stripe still parked dormant).
 *
 * Laws under test:
 * - 'bluevine_invoice' is ACCEPTED — the primary method since
 *   2026-11-01 (order placed on site, Bluevine invoice emailed, paid
 *   by ACH bank transfer or check per the invoice, or Venmo / Cash
 *   App with the order number as reference; order prepared once
 *   payment is confirmed).
 * - 'bookipi_invoice' (the primary method's name 2026-10-24 →
 *   2026-11-01) is accepted ONLY as an alias and NORMALIZED to
 *   'bluevine_invoice' — responses and stored records never carry it
 *   from a new order.
 * - 'bookipi_card_invoice' (the legacy 2026-10-13 name) is REJECTED
 *   (422) for new orders — it survives only on stored historical
 *   records; it is never accepted, recorded, or coerced.
 * - 'bluevine_card_link' is REJECTED while no Bluevine payment link
 *   is configured (the default) — the gated card option does not
 *   exist until a verified link is set (see
 *   tests/checkout-bluevine-card-gate.test.ts for the configured case).
 * - An unknown payment_method is REJECTED (422) — never silently coerced.
 * - An absent payment_method defaults to 'cash_app_or_venmo' with the
 *   exact instruction shape the original flow returned.
 * - The payment method NEVER affects pricing: a verified subscriber gets
 *   identical totals/discount/shipping via either method.
 * - The checkout UI offers no Stripe card method and renders the
 *   Bluevine card choice only behind its configuration gate: the form
 *   source carries no stripe_card_embedded choice, no embedded Stripe
 *   component, and no checkout-session call (Stripe is parked dormant,
 *   its routes/library retained but unreachable from the UI).
 * - The order-intake pipeline (POST /api/orders) accepts the same field
 *   with the same default and carries it to the review-queue entry.
 * - Phase 2 (Workstream 1a, merged): a physical cart requires every
 *   order body to carry a valid shipping_address (the merged
 *   lib/checkout/order validates it with lib/checkout/shipping-address
 *   and stores it on the record) — so every physical-order body below
 *   sends the shared SHIPPING_ADDRESS fixture. The fixture changes no
 *   total: sales tax keys off delivery_address, which these bodies
 *   deliberately omit (the legacy no-address, no-tax behavior the
 *   admin tax build preserves for address-less API bodies). */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POST } from '../app/api/checkout/route';
import { validateAndBuildOrder } from '../lib/checkout/order';
import { intakeOrder } from '../lib/orders/intake';
import { JsonlRecordStore, toOrderReviewEntry } from '../lib/orders/store';

const DIR = mkdtempSync(join(tmpdir(), 'checkout-payment-method-'));
const ORDERS_LEDGER = join(DIR, 'orders.jsonl');
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;

const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };

/** Phase 2 (WS1a): physical carts require a shipping address — the
 * shared valid fixture every physical-order body in this file sends. */
const SHIPPING_ADDRESS = {
  name: 'Test Customer',
  street: '239 S 1200 W',
  city: 'Salt Lake City',
  state: 'UT',
  postal_code: '84104',
  country: 'US',
};
const CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
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

function lastOrder(): Record<string, unknown> {
  const lines = readFileSync(ORDERS_LEDGER, 'utf8').trim().split('\n');
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
}

describe('checkout payment method', () => {
  it('accepts a Bluevine invoice order with honest invoice instructions (primary, 2026-11-01)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'bluevine_invoice',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.payment_method).toBe('bluevine_invoice');
    expect(json.total_cents).toBe(1977 + 595);
    const payment = json.payment as Record<string, unknown>;
    expect(payment.method).toBe('bluevine_invoice');
    expect(payment.cash_app).toBe('$AmberPatten347');
    expect(payment.venmo).toBe('@AwakenwithAmber');
    expect(payment.order_id).toBe(json.order_id);
    expect(String(payment.note)).toMatch(/Bluevine invoice will be emailed/i);
    expect(String(payment.note)).toMatch(/ACH bank transfer or check/);
    expect(String(payment.note)).toMatch(/order number as the payment reference/);
    expect(String(payment.note)).toMatch(/prepared once payment is confirmed/);
    expect(String(payment.note)).not.toMatch(/card/i);
    expect(String(payment.note)).not.toMatch(/Bookipi/);
    expect(lastOrder().payment_method).toBe('bluevine_invoice');
    // Phase 2 (WS1a): the validated shipping address is stored on the
    // record, exactly as submitted (the fulfillment authority).
    expect(lastOrder().shipping_address).toEqual(SHIPPING_ADDRESS);
  });

  it('normalizes the retired bookipi_invoice name to bluevine_invoice (alias, never stored)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'bookipi_invoice',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(200);
    expect(json.payment_method).toBe('bluevine_invoice');
    const payment = json.payment as Record<string, unknown>;
    expect(payment.method).toBe('bluevine_invoice');
    expect(lastOrder().payment_method).toBe('bluevine_invoice');

    const record = validateAndBuildOrder({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'bookipi_invoice',
      client_total_cents: 1977 + 595,
    });
    expect(record.payment_method).toBe('bluevine_invoice');
  });

  it('rejects bluevine_card_link while no Bluevine payment link is configured (gated off)', async () => {
    delete process.env.NEXT_PUBLIC_BLUEVINE_PAYMENT_LINK_URL;
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'bluevine_card_link',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /Unknown payment method/,
    );
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'bluevine_card_link',
        client_total_cents: 1977 + 595,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('the checkout UI offers Bluevine, no Stripe card method, and the Bluevine card choice only behind its gate', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    expect(form).toContain('bluevine_invoice');
    expect(form).toContain('Pay by Bluevine invoice');
    expect(form).not.toContain('bookipi_invoice');
    // Stripe stays parked dormant and unreachable from the UI.
    expect(form).not.toContain('stripe_card_embedded');
    expect(form).not.toContain('StripeEmbeddedCheckout');
    expect(form).not.toContain('/api/stripe/checkout-session');
    expect(form).not.toMatch(/credit or debit card/i);
    // The Bluevine card choice renders ONLY behind the config gate.
    expect(form).toContain('bluevineCardConfigured()');
    expect(form).toContain('BLUEVINE_CARD_AVAILABLE ?');
    expect(form).toContain('value="bluevine_card_link"');
  });

  it('rejects the legacy bookipi card-invoice name for new orders (removed 2026-10-21)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'bookipi_card_invoice',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(422);
    expect(json.ok).toBe(false);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /Unknown payment method/,
    );

    // Core level: the removed method is never accepted or coerced.
    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'bookipi_card_invoice',
        client_total_cents: 1977 + 595,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('rejects an unknown payment method (422), at route and core level', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'carrier_pigeon',
      client_total_cents: 1977,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /Unknown payment method/,
    );

    expect(() =>
      validateAndBuildOrder({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'card',
        client_total_cents: 1977,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('defaults to cash_app_or_venmo with the original instruction shape when absent', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(200);
    expect(json.payment_method).toBe('cash_app_or_venmo');
    expect(json.payment).toEqual({
      method: 'cash_app_or_venmo',
      cash_app: '$AmberPatten347',
      venmo: '@AwakenwithAmber',
      note:
        'Send your payment with Cash App or Venmo — whichever you prefer. ' +
        'Amber confirms every order personally before fulfillment.',
    });
    expect(lastOrder().payment_method).toBe('cash_app_or_venmo');
  });

  it('an explicit cash_app_or_venmo choice behaves identically to the default', () => {
    const record = validateAndBuildOrder({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      payment_method: 'cash_app_or_venmo',
      client_total_cents: 1977 + 595,
    });
    expect(record.payment_method).toBe('cash_app_or_venmo');
    expect(record.total_cents).toBe(1977 + 595);
  });

  it('verified subscriber pricing is identical across payment methods', async () => {
    // Seed an owner-confirmed ('active') subscription for the order email.
    writeFileSync(
      SUBS_LEDGER,
      JSON.stringify({
        subscription_id: 'SUB-TEST-0002',
        created_at: '2026-10-13T00:00:00.000Z',
        computed_by: 'server',
        plan_id: 'living-grimoire-monthly',
        plan_name: 'Living Grimoire',
        price_cents: 777,
        interval: 'month',
        status: 'active',
        customer: { name: 'Parity Member', email: 'parity@example.com' },
        confirmed_at: '2026-10-13T01:00:00.000Z',
        confirmed_by: 'owner',
        recurring_mechanic: 'NEEDS_VERIFICATION',
        ledger_version: 1,
      }) + '\n',
      'utf8',
    );
    const customer = { name: 'Parity Member', email: 'parity@example.com' };
    // $19.77 item, verified subscriber: discount 198, total 1779, FREE ship.
    const viaHandles = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      shipping_address: SHIPPING_ADDRESS,
      is_subscriber: true,
      client_total_cents: 1779,
    });
    const viaInvoice = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      shipping_address: SHIPPING_ADDRESS,
      is_subscriber: true,
      payment_method: 'bluevine_invoice',
      client_total_cents: 1779,
    });
    expect(viaHandles.status).toBe(200);
    expect(viaInvoice.status).toBe(200);
    for (const json of [viaHandles.json, viaInvoice.json]) {
      expect(json.subtotal_cents).toBe(1977);
      expect(json.subscriber_discount_cents).toBe(198);
      expect(json.total_cents).toBe(1779);
      expect(json.shipping_status).toBe('FREE');
      expect(json.is_subscriber_verified).toBe(true);
    }
    expect(viaInvoice.json.payment_method).toBe('bluevine_invoice');

    // Core-level: the two persisted records differ ONLY in payment method
    // (and their generated ids/timestamps).
    const base = {
      items: [CAPSULE_ITEM],
      customer,
      shipping_address: SHIPPING_ADDRESS,
      is_subscriber: true,
      client_total_cents: 1779,
    };
    const a = validateAndBuildOrder(base, { isSubscriberVerified: true });
    const b = validateAndBuildOrder(
      { ...base, payment_method: 'bluevine_invoice' },
      { isSubscriberVerified: true },
    );
    expect(b.payment_method).toBe('bluevine_invoice');
    expect(b.subtotal_cents).toBe(a.subtotal_cents);
    expect(b.subscriber_discount_cents).toBe(a.subscriber_discount_cents);
    expect(b.total_cents).toBe(a.total_cents);
    expect(b.shipping_status).toBe(a.shipping_status);
    expect(b.free_shipping_threshold_cents).toBe(
      a.free_shipping_threshold_cents,
    );
  });

  it('intake accepts the same field: carried to the review entry; invalid rejected at validation', async () => {
    const store = new JsonlRecordStore({
      path: join(DIR, 'intake-orders.jsonl'),
      getId: (r: { order_id: string }) => r.order_id,
      toSummary: toOrderReviewEntry,
    });

    const legacy = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'bookipi_card_invoice',
        client_total_cents: 1977 + 595,
      },
      store,
    );
    // The LEGACY card-invoice name fails intake validation (removed
    // 2026-10-21); new invoice orders use 'bluevine_invoice'
    // (accepted — next test).
    expect(legacy.ok).toBe(false);
    if (!legacy.ok) {
      expect(legacy.stage).toBe('validation');
      expect(legacy.errors.join(' ')).toMatch(/Unknown payment method/);
    }

    const invoice = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'bluevine_invoice',
        client_total_cents: 1977 + 595,
      },
      store,
    );
    expect(invoice.ok).toBe(true);
    if (invoice.ok) {
      expect(invoice.reviewEntry.payment_method).toBe('bluevine_invoice');
    }

    // The retired primary name still intakes — normalized to Bluevine.
    const aliased = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'bookipi_invoice',
        client_total_cents: 1977 + 595,
      },
      store,
    );
    expect(aliased.ok).toBe(true);
    if (aliased.ok) {
      expect(aliased.reviewEntry.payment_method).toBe('bluevine_invoice');
    }

    const defaulted = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        client_total_cents: 1977 + 595,
      },
      store,
    );
    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) {
      expect(defaulted.reviewEntry.payment_method).toBe('cash_app_or_venmo');
    }

    const invalid = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        shipping_address: SHIPPING_ADDRESS,
        payment_method: 'beads',
        client_total_cents: 1977,
      },
      store,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.stage).toBe('validation');
      expect(invalid.errors.join(' ')).toMatch(/Unknown payment method/);
    }
  });
});
