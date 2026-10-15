/**
 * Customer order status lookup — POST /api/orders/status (Phase 2).
 *
 * Laws under test:
 * - The lookup answers ONLY when order ID + the order's email both
 *   match. Unknown ID and wrong email return the SAME generic 404 —
 *   the endpoint cannot enumerate orders or probe emails.
 * - Before any tracking is recorded, tracking is null; after the owner
 *   records tracking (via the real admin endpoint), the SAME lookup
 *   returns the number and its public USPS link — the customer view of
 *   the append-only tracking ledger.
 * - The summary never carries address/phone/notes fields.
 * - Malformed bodies are 422 in the codebase's error shape.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/orders/status/route';
import { POST as trackingPOST } from '../app/api/admin/orders/tracking/route';

const DIR = mkdtempSync(join(tmpdir(), 'order-status-'));
const ORDERS_LEDGER = join(DIR, 'orders.jsonl');
const TRACKING_LEDGER = join(DIR, 'tracking.jsonl');
process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
process.env.ORDER_TRACKING_LEDGER_PATH = TRACKING_LEDGER;

const SECRET = 'test-owner-secret-not-a-real-one';
const ORIGINAL_SECRET = process.env.OWNER_ADMIN_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.OWNER_ADMIN_SECRET;
  else process.env.OWNER_ADMIN_SECRET = ORIGINAL_SECRET;
});

const ORDER = {
  order_id: 'AWK-20261014-TEST01',
  created_at: '2026-10-14T12:00:00.000Z',
  computed_by: 'server',
  ledger_version: 1,
  customer: {
    name: 'Test Buyer',
    email: 'Buyer@Example.com',
    phone: '(801) 555-0100',
    notes: 'leave at the door',
  },
  items: [
    {
      product_handle: 'gaias-rose-soap',
      title: "Gaia's Rose Soap",
      quantity: 2,
      unit_price_cents: 1177,
      line_total_cents: 2354,
    },
  ],
  bundle: null,
  subtotal_cents: 2354,
  subscriber_discount_cents: 0,
  shipping_cents: 0,
  shipping_status: 'FREE',
  free_shipping_threshold_cents: 4500,
  total_cents: 2354,
  is_subscriber_asserted: false,
  is_subscriber_verified: false,
  payment_method: 'cash_app_or_venmo',
  status: 'paid',
};

function seed(): void {
  writeFileSync(ORDERS_LEDGER, `${JSON.stringify(ORDER)}\n`, 'utf8');
  writeFileSync(TRACKING_LEDGER, '', 'utf8');
}

async function postStatus(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/orders/status', {
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

describe('POST /api/orders/status', () => {
  it('returns the summary with tracking null before any tracking exists', async () => {
    seed();
    const res = await postStatus({
      order_id: ORDER.order_id,
      email: 'buyer@example.com', // case-insensitive vs the stored record
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    const order = res.json.order as Record<string, unknown>;
    expect(order.order_id).toBe(ORDER.order_id);
    expect(order.status).toBe('paid');
    expect(order.item_count).toBe(2);
    expect(order.total_cents).toBe(2354);
    expect(res.json.tracking).toBeNull();
    // Nothing beyond the summary leaks — no phone, no notes, no email echo.
    expect(JSON.stringify(res.json)).not.toContain('555-0100');
    expect(JSON.stringify(res.json)).not.toContain('leave at the door');
  });

  it('unknown ID and wrong email are the same generic 404', async () => {
    seed();
    const unknown = await postStatus({
      order_id: 'AWK-19990101-NOPE99',
      email: 'buyer@example.com',
    });
    expect(unknown.status).toBe(404);

    const wrongEmail = await postStatus({
      order_id: ORDER.order_id,
      email: 'someone-else@example.com',
    });
    expect(wrongEmail.status).toBe(404);

    expect(unknown.json).toEqual(wrongEmail.json);
  });

  it('after the owner records tracking, the lookup shows number + USPS link', async () => {
    seed();
    process.env.OWNER_ADMIN_SECRET = SECRET;

    const recorded = await trackingPOST(
      new Request('http://localhost/api/admin/orders/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-secret': SECRET,
        },
        body: JSON.stringify({
          order_id: ORDER.order_id,
          tracking_number: '9400111899223397865891',
        }),
      }),
    );
    expect(recorded.status).toBe(201);

    const res = await postStatus({
      order_id: ORDER.order_id,
      email: 'buyer@example.com',
    });
    expect(res.status).toBe(200);
    const tracking = res.json.tracking as Record<string, unknown>;
    expect(tracking.carrier).toBe('usps');
    expect(tracking.carrier_label).toBe('USPS');
    expect(tracking.tracking_number).toBe('9400111899223397865891');
    expect(tracking.tracking_url).toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223397865891',
    );
  });

  it('malformed bodies are 422', async () => {
    seed();
    const missing = await postStatus({});
    expect(missing.status).toBe(422);
    const badEmail = await postStatus({
      order_id: ORDER.order_id,
      email: 'not-an-email',
    });
    expect(badEmail.status).toBe(422);
  });
});
