/**
 * POST /api/admin/orders/payment — route tests (audit 2026-10-15 GAP-1).
 *
 * Laws under test (mirroring the subscription-confirm contract):
 * - Secret unset → 404 (route does not exist); wrong/absent → 401.
 * - Unknown order → 404 and NOTHING is appended.
 * - A valid confirmation appends one event → 201, status 'paid'; the
 *   identical repeat is a 200 no-op (idempotent).
 * - The customer order-status lookup then reports the order as paid.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as confirmPayment } from './route';
import { POST as orderStatus } from '../../../orders/status/route';

const SECRET = 'test-owner-secret';

let ordersPath: string;
let paymentsPath: string;

function seedOrder(): void {
  writeFileSync(
    ordersPath,
    JSON.stringify({
      order_id: 'AWK-20261015-TEST01',
      created_at: '2026-10-15T10:00:00.000Z',
      computed_by: 'server',
      ledger_version: 1,
      customer: { name: 'Test', email: 'buyer@example.com' },
      items: [],
      bundle: null,
      subtotal_cents: 1977,
      shipping_cents: 0,
      shipping_status: 'FREE',
      free_shipping_threshold_cents: 4500,
      total_cents: 1977,
      is_subscriber_asserted: false,
      payment_method: 'bookipi_card_invoice',
    }) + '\n',
    'utf8',
  );
}

function request(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/admin/orders/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-owner-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

function paymentLines(): string[] {
  try {
    return readFileSync(paymentsPath, 'utf8').trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'payment-route-'));
  ordersPath = join(dir, 'orders.jsonl');
  paymentsPath = join(dir, 'payments.jsonl');
  process.env.ORDERS_LEDGER_PATH = ordersPath;
  process.env.ORDER_PAYMENTS_LEDGER_PATH = paymentsPath;
  process.env.OWNER_ADMIN_SECRET = SECRET;
  seedOrder();
});

afterEach(() => {
  delete process.env.ORDERS_LEDGER_PATH;
  delete process.env.ORDER_PAYMENTS_LEDGER_PATH;
  delete process.env.OWNER_ADMIN_SECRET;
});

describe('owner payment confirmation', () => {
  it('fails closed: no secret configured → 404; wrong/absent secret → 401', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    const unconfigured = await confirmPayment(
      request({ order_id: 'AWK-20261015-TEST01' }, SECRET),
    );
    expect(unconfigured.status).toBe(404);

    process.env.OWNER_ADMIN_SECRET = SECRET;
    const absent = await confirmPayment(
      request({ order_id: 'AWK-20261015-TEST01' }),
    );
    expect(absent.status).toBe(401);
    const wrong = await confirmPayment(
      request({ order_id: 'AWK-20261015-TEST01' }, 'nope'),
    );
    expect(wrong.status).toBe(401);
    expect(paymentLines()).toEqual([]);
  });

  it('unknown order → 404, nothing appended', async () => {
    const res = await confirmPayment(
      request({ order_id: 'AWK-00000000-NOPE99' }, SECRET),
    );
    expect(res.status).toBe(404);
    expect(paymentLines()).toEqual([]);
  });

  it('unknown method → 422, nothing appended', async () => {
    const res = await confirmPayment(
      request({ order_id: 'AWK-20261015-TEST01', method: 'stripe' }, SECRET),
    );
    expect(res.status).toBe(422);
    expect(paymentLines()).toEqual([]);
  });

  it('confirms → 201 paid with the order method by default; repeat is a 200 no-op', async () => {
    const res = await confirmPayment(
      request(
        { order_id: 'AWK-20261015-TEST01', reference: 'INV-1042' },
        SECRET,
      ),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe('paid');
    expect(json.already_recorded).toBe(false);
    expect(json.payment.method).toBe('bookipi_card_invoice');
    expect(json.payment.method_label).toBe('Card — Bookipi invoice');
    expect(json.payment.reference).toBe('INV-1042');
    expect(paymentLines()).toHaveLength(1);

    const again = await confirmPayment(
      request(
        { order_id: 'AWK-20261015-TEST01', reference: 'INV-1042' },
        SECRET,
      ),
    );
    expect(again.status).toBe(200);
    expect((await again.json()).already_recorded).toBe(true);
    expect(paymentLines()).toHaveLength(1); // no duplicate event
  });

  it('the customer order-status lookup reports paid after confirmation', async () => {
    const statusReq = (body: unknown) =>
      new Request('http://localhost/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const lookup = { order_id: 'AWK-20261015-TEST01', email: 'buyer@example.com' };

    const before = await orderStatus(statusReq(lookup));
    expect((await before.json()).order.status).toBe('pending_payment');

    await confirmPayment(request({ order_id: 'AWK-20261015-TEST01' }, SECRET));

    const after = await orderStatus(statusReq(lookup));
    const afterJson = await after.json();
    expect(afterJson.order.status).toBe('paid');
    expect(afterJson.order.payment_confirmed_at).toBeTruthy();
  });
});
