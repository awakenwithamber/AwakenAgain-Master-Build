/**
 * REGRESSION SUITE — subscriber entitlement at checkout (route level).
 *
 * Laws under test:
 * - (a) An UNVERIFIED is_subscriber claim (no server-held record) receives
 *   standard shipping pricing and NO discount — and the order is NOT
 *   blocked, whether the client claimed the standard total or the
 *   discounted preview total (the server recomputes authoritatively).
 * - (b) A VERIFIED entitled record (latest subscription for the order
 *   email is 'active' — owner-confirmed) receives free shipping with no
 *   minimum AND the advertised 10% storewide discount, reflected in the
 *   response and in the persisted order record.
 * - (c) A pending_payment (or otherwise non-entitled) record receives
 *   neither benefit.
 * - (d) Tampered client totals and tampered unit prices are still
 *   REJECTED, including for verified subscribers.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/checkout/route';
import { validateAndBuildOrder } from '../lib/checkout/order';

const DIR = mkdtempSync(join(tmpdir(), 'checkout-entitlement-'));
const ORDERS_LEDGER = join(DIR, 'orders.jsonl');
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;

const CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};
// $19.77 item: below the $45 general free-shipping threshold.
// Verified subscriber figures: round(1977 * 0.9) = 1779; discount = 198.

function subscriptionLine(email: string, status: string) {
  return JSON.stringify({
    subscription_id: 'SUB-TEST-0001',
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

function setSubscriptions(lines: string[]): void {
  writeFileSync(SUBS_LEDGER, lines.length ? lines.join('\n') + '\n' : '', 'utf8');
}

async function postCheckout(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function lastOrder(): Record<string, unknown> {
  const lines = readFileSync(ORDERS_LEDGER, 'utf8').trim().split('\n');
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
}

describe('checkout subscriber entitlement', () => {
  it('(a) unverified claim: standard pricing, no discount, order not blocked', async () => {
    setSubscriptions([]); // server holds NO record for this email
    const customer = { name: 'Claimer', email: 'claimer@example.com' };

    const standardClaim = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      is_subscriber: true,
      client_total_cents: 1977,
    });
    expect(standardClaim.status).toBe(200);
    expect(standardClaim.json.shipping_status).toBe('TO_BE_CONFIRMED');
    expect(standardClaim.json.total_cents).toBe(1977);
    expect(standardClaim.json.subscriber_discount_cents).toBe(0);
    expect(standardClaim.json.is_subscriber_verified).toBe(false);

    // The real client preview shows the claimed discount, so its total is
    // the discounted figure — that must ALSO be accepted (not blocked),
    // with the server recording the standard total.
    const discountedClaim = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      is_subscriber: true,
      client_total_cents: 1779,
    });
    expect(discountedClaim.status).toBe(200);
    expect(discountedClaim.json.total_cents).toBe(1977);
    expect(discountedClaim.json.shipping_status).toBe('TO_BE_CONFIRMED');
    const saved = lastOrder();
    expect(saved.total_cents).toBe(1977);
    expect(saved.is_subscriber_asserted).toBe(true);
    expect(saved.is_subscriber_verified).toBe(false);
  });

  it('(b) verified active record: free shipping + 10% discount, persisted', async () => {
    // Ledger stores the email in mixed case; matching is case-insensitive.
    setSubscriptions([subscriptionLine('Member@Example.com', 'active')]);
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Member', email: 'member@example.com' },
      is_subscriber: true,
      client_total_cents: 1779,
    });
    expect(status).toBe(200);
    expect(json.shipping_status).toBe('FREE');
    expect(json.subscriber_discount_cents).toBe(198);
    expect(json.is_subscriber_verified).toBe(true);
    expect(json.subtotal_cents).toBe(1977);
    expect(json.total_cents).toBe(1779);

    const saved = lastOrder();
    expect(saved.is_subscriber_verified).toBe(true);
    expect(saved.subscriber_discount_cents).toBe(198);
    expect(saved.total_cents).toBe(1779);
    expect(saved.shipping_status).toBe('FREE');
    expect(saved.free_shipping_threshold_cents).toBe(0);
  });

  it('(c) pending_payment record: neither benefit', async () => {
    setSubscriptions([subscriptionLine('pending@example.com', 'pending_payment')]);
    const { status, json } = await postCheckout({
      items: [CAPSULE_ITEM],
      customer: { name: 'Pending', email: 'pending@example.com' },
      is_subscriber: true,
      client_total_cents: 1977,
    });
    expect(status).toBe(200);
    expect(json.shipping_status).toBe('TO_BE_CONFIRMED');
    expect(json.subscriber_discount_cents).toBe(0);
    expect(json.is_subscriber_verified).toBe(false);
    expect(json.total_cents).toBe(1977);
  });

  it('(d) tampering is still rejected — arbitrary totals and unit prices', async () => {
    setSubscriptions([subscriptionLine('member@example.com', 'active')]);
    const customer = { name: 'Member', email: 'member@example.com' };

    const badTotal = await postCheckout({
      items: [CAPSULE_ITEM],
      customer,
      is_subscriber: true,
      client_total_cents: 1, // neither the standard nor the subscriber total
    });
    expect(badTotal.status).toBe(422);
    expect(String((badTotal.json.errors as string[]).join(' '))).toMatch(
      /Total mismatch/,
    );

    const badPrice = await postCheckout({
      items: [{ ...CAPSULE_ITEM, unit_price_cents: 100 }],
      customer,
      is_subscriber: true,
      client_total_cents: 90,
    });
    expect(badPrice.status).toBe(422);
    expect(String((badPrice.json.errors as string[]).join(' '))).toMatch(
      /Price mismatch/,
    );
  });

  it('verified discount applies to the bundle as a storewide purchase', () => {
    const shapes = [
      'small-rose',
      'medium-rose',
      'plain-rectangle',
      'wave-rectangle',
      'floral-round',
    ];
    const bundle = {
      bundle_id: 'soap-style-collection-5',
      slots: shapes.map((shape, i) => ({
        slot_index: i,
        shape,
        base: 'double-layer',
        scent: { type: 'custom_blend', oils: ['lavender'] },
        botanical: null,
        color: 'amber-gold',
      })),
    };
    // Bundle $35.77: round(3577 * 0.9) = 3219; discount = 358.
    const record = validateAndBuildOrder(
      {
        items: [],
        bundle,
        customer: { name: 'Member', email: 'member@example.com' },
        is_subscriber: true,
        client_total_cents: 3219,
      },
      { isSubscriberVerified: true },
    );
    expect(record.subscriber_discount_cents).toBe(358);
    expect(record.total_cents).toBe(3219);
    expect(record.shipping_status).toBe('FREE');
  });
});
