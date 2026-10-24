/**
 * REGRESSION SUITE — payment method at checkout (owner decisions
 * 2026-10-13 + 2026-10-21, SUPERSEDED by the owner directive
 * 2026-10-24: Stripe parked dormant, Bookipi invoices + Bluevine
 * direct ACH become the customer payment flow).
 *
 * Laws under test:
 * - 'bookipi_invoice' is ACCEPTED — the primary method since
 *   2026-10-24 (order placed on site, Bookipi invoice emailed, paid by
 *   ACH bank transfer to Bluevine, Venmo, or Cash App with the order
 *   number as reference; order prepared once payment is confirmed).
 * - 'bookipi_card_invoice' (the legacy 2026-10-13 name) is REJECTED
 *   (422) for new orders — it survives only on stored historical
 *   records; it is never accepted, recorded, or coerced.
 * - An unknown payment_method is REJECTED (422) — never silently coerced.
 * - An absent payment_method defaults to 'cash_app_or_venmo' with the
 *   exact instruction shape the original flow returned.
 * - The payment method NEVER affects pricing: a verified subscriber gets
 *   identical totals/discount/shipping via either method.
 * - The checkout UI no longer offers the Stripe card method: the form
 *   source carries no stripe_card_embedded choice, no embedded Stripe
 *   component, and no checkout-session call (Stripe is parked dormant,
 *   its routes/library retained but unreachable from the UI).
 * - The order-intake pipeline (POST /api/orders) accepts the same field
 *   with the same default and carries it to the review-queue entry.
 */
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
  it('accepts a bookipi invoice order with honest invoice instructions (primary, 2026-10-24)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
      payment_method: 'bookipi_invoice',
      client_total_cents: 1977 + 595,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.payment_method).toBe('bookipi_invoice');
    expect(json.total_cents).toBe(1977 + 595);
    const payment = json.payment as Record<string, unknown>;
    expect(payment.method).toBe('bookipi_invoice');
    expect(payment.cash_app).toBe('$AmberPatten347');
    expect(payment.venmo).toBe('@AwakenwithAmber');
    expect(payment.order_id).toBe(json.order_id);
    expect(String(payment.note)).toMatch(/invoice will be emailed/i);
    expect(String(payment.note)).toMatch(/ACH bank transfer to Bluevine/);
    expect(String(payment.note)).toMatch(/order number as the payment reference/);
    expect(String(payment.note)).toMatch(/prepared once payment is confirmed/);
    expect(String(payment.note)).not.toMatch(/card/i);
    expect(lastOrder().payment_method).toBe('bookipi_invoice');
  });

  it('the checkout UI offers no Stripe card method (parked dormant, 2026-10-24)', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    expect(form).toContain('bookipi_invoice');
    expect(form).not.toContain('stripe_card_embedded');
    expect(form).not.toContain('StripeEmbeddedCheckout');
    expect(form).not.toContain('/api/stripe/checkout-session');
    expect(form).not.toMatch(/credit or debit card/i);
  });

  it('rejects the legacy bookipi card-invoice name for new orders (removed 2026-10-21)', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
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
        payment_method: 'bookipi_card_invoice',
        client_total_cents: 1977 + 595,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('rejects an unknown payment method (422), at route and core level', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
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
        payment_method: 'card',
        client_total_cents: 1977,
      }),
    ).toThrow(/Unknown payment method/);
  });

  it('defaults to cash_app_or_venmo with the original instruction shape when absent', async () => {
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: CUSTOMER,
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
      is_subscriber: true,
      client_total_cents: 1779,
    });
    const viaInvoice = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      is_subscriber: true,
      payment_method: 'bookipi_invoice',
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
    expect(viaInvoice.json.payment_method).toBe('bookipi_invoice');

    // Core-level: the two persisted records differ ONLY in payment method
    // (and their generated ids/timestamps).
    const base = {
      items: [CAPSULE_ITEM],
      customer,
      is_subscriber: true,
      client_total_cents: 1779,
    };
    const a = validateAndBuildOrder(base, { isSubscriberVerified: true });
    const b = validateAndBuildOrder(
      { ...base, payment_method: 'bookipi_invoice' },
      { isSubscriberVerified: true },
    );
    expect(b.payment_method).toBe('bookipi_invoice');
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

    const bookipi = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        payment_method: 'bookipi_card_invoice',
        client_total_cents: 1977 + 595,
      },
      store,
    );
    // The LEGACY name fails intake validation (removed 2026-10-21);
    // new invoice orders use 'bookipi_invoice' (accepted — next test).
    expect(bookipi.ok).toBe(false);
    if (!bookipi.ok) {
      expect(bookipi.stage).toBe('validation');
      expect(bookipi.errors.join(' ')).toMatch(/Unknown payment method/);
    }

    const invoice = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        payment_method: 'bookipi_invoice',
        client_total_cents: 1977 + 595,
      },
      store,
    );
    expect(invoice.ok).toBe(true);
    if (invoice.ok) {
      expect(invoice.reviewEntry.payment_method).toBe('bookipi_invoice');
    }

    const defaulted = await intakeOrder(
      {
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
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
