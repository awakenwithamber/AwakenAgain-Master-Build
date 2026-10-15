/**
 * Owner order tracking entry — POST /api/admin/orders/tracking (Phase 2).
 *
 * Laws under test:
 * - The route FAILS CLOSED: with OWNER_ADMIN_SECRET unset it answers 404
 *   and changes nothing; with a wrong/absent secret it answers 401 and
 *   changes nothing (the same contract as subscription confirmation).
 * - A valid entry APPENDS a tracking event; the order ledger is
 *   byte-identical afterward (order records are never mutated).
 * - An unknown order ID creates nothing (404).
 * - The carrier defaults to USPS and the response carries the public
 *   USPS tracking link; re-recording the same carrier + number is a 200
 *   no-op, while a corrected number appends a superseding event and the
 *   latest one wins.
 * - Malformed bodies are 422 in the codebase's { ok:false, errors } shape.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/admin/orders/tracking/route';
import { findLatestTracking } from '../lib/orders/tracking';

const DIR = mkdtempSync(join(tmpdir(), 'admin-tracking-'));
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
  customer: { name: 'Test Buyer', email: 'buyer@example.com' },
  items: [
    {
      product_handle: 'gaias-rose-soap',
      title: "Gaia's Rose Soap",
      quantity: 1,
      unit_price_cents: 1177,
      line_total_cents: 1177,
    },
  ],
  bundle: null,
  subtotal_cents: 1177,
  subscriber_discount_cents: 0,
  shipping_cents: 0,
  shipping_status: 'FREE',
  free_shipping_threshold_cents: 4500,
  total_cents: 1177,
  is_subscriber_asserted: false,
  is_subscriber_verified: false,
  payment_method: 'cash_app_or_venmo',
  status: 'pending_payment',
};

function seedOrders(): string {
  const content = `${JSON.stringify(ORDER)}\n`;
  writeFileSync(ORDERS_LEDGER, content, 'utf8');
  writeFileSync(TRACKING_LEDGER, '', 'utf8');
  return content;
}

function trackingContent(): string {
  return readFileSync(TRACKING_LEDGER, 'utf8');
}

async function postTracking(
  body: unknown,
  options: { secret?: string; rawBody?: string } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.secret !== undefined) headers['x-owner-secret'] = options.secret;
  const res = await POST(
    new Request('http://localhost/api/admin/orders/tracking', {
      method: 'POST',
      headers,
      body: options.rawBody ?? JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

describe('POST /api/admin/orders/tracking', () => {
  it('fails closed when OWNER_ADMIN_SECRET is unset: 404, nothing recorded', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    seedOrders();

    const res = await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(trackingContent()).toBe('');
  });

  it('rejects a wrong or absent secret: 401, nothing recorded', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    const wrong = await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400111899223397865891' },
      { secret: 'not-the-secret' },
    );
    expect(wrong.status).toBe(401);

    const absent = await postTracking({
      order_id: ORDER.order_id,
      tracking_number: '9400111899223397865891',
    });
    expect(absent.status).toBe(401);

    expect(trackingContent()).toBe('');
  });

  it('records tracking: 201, event appended, order ledger byte-identical, USPS link returned', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const ordersBefore = seedOrders();

    const res = await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400 1118 9922 3397 8658 91' },
      { secret: SECRET },
    );
    expect(res.status).toBe(201);
    expect(res.json.ok).toBe(true);
    expect(res.json.already_recorded).toBe(false);
    const tracking = res.json.tracking as Record<string, unknown>;
    expect(tracking.carrier).toBe('usps'); // default carrier
    expect(tracking.carrier_label).toBe('USPS');
    expect(tracking.tracking_number).toBe('9400111899223397865891');
    expect(tracking.tracking_url).toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223397865891',
    );

    // Append-only: exactly one event; the order ledger is untouched.
    const lines = trackingContent().trim().split('\n');
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(event.order_id).toBe(ORDER.order_id);
    expect(event.recorded_by).toBe('owner');
    expect(readFileSync(ORDERS_LEDGER, 'utf8')).toBe(ordersBefore);

    expect(findLatestTracking(ORDER.order_id)?.tracking_number).toBe(
      '9400111899223397865891',
    );
  });

  it('matches the order ID case-insensitively but records the canonical ID', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    const res = await postTracking(
      { order_id: 'awk-20261014-test01', tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    expect(res.status).toBe(201);
    expect(res.json.order_id).toBe(ORDER.order_id);
    expect(findLatestTracking(ORDER.order_id)).toBeDefined();
  });

  it('same carrier + number again: 200 no-op, no second event', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    const first = await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    expect(first.status).toBe(201);
    const before = trackingContent();

    const again = await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    expect(again.status).toBe(200);
    expect(again.json.already_recorded).toBe(true);
    expect(trackingContent()).toBe(before);
  });

  it('a corrected number appends a superseding event; the latest wins', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    await postTracking(
      { order_id: ORDER.order_id, tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    const corrected = await postTracking(
      {
        order_id: ORDER.order_id,
        carrier: 'ups',
        tracking_number: '1Z999AA10123456784',
      },
      { secret: SECRET },
    );
    expect(corrected.status).toBe(201);

    const lines = trackingContent().trim().split('\n');
    expect(lines).toHaveLength(2); // history preserved
    const latest = findLatestTracking(ORDER.order_id);
    expect(latest?.carrier).toBe('ups');
    expect(latest?.tracking_number).toBe('1Z999AA10123456784');
  });

  it('unknown order ID: 404 and nothing is recorded', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    const res = await postTracking(
      { order_id: 'AWK-19990101-NOPE99', tracking_number: '9400111899223397865891' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(res.json.ok).toBe(false);
    expect(trackingContent()).toBe('');
  });

  it('malformed bodies are 422 and record nothing', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedOrders();

    const notJson = await postTracking(null, {
      secret: SECRET,
      rawBody: 'this is not json',
    });
    expect(notJson.status).toBe(422);

    const missingNumber = await postTracking(
      { order_id: ORDER.order_id },
      { secret: SECRET },
    );
    expect(missingNumber.status).toBe(422);

    const badNumber = await postTracking(
      { order_id: ORDER.order_id, tracking_number: 'x' },
      { secret: SECRET },
    );
    expect(badNumber.status).toBe(422);

    const badCarrier = await postTracking(
      {
        order_id: ORDER.order_id,
        tracking_number: '9400111899223397865891',
        carrier: 'carrier-pigeon',
      },
      { secret: SECRET },
    );
    expect(badCarrier.status).toBe(422);

    expect(trackingContent()).toBe('');
  });
});
