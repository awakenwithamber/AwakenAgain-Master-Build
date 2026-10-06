/**
 * REGRESSION SUITE — order-intake Route Handler (G3).
 *
 * Laws under test:
 * - POST /api/orders is the explicit intake contract: valid payload →
 *   200 + order_id + receipt + fulfillment review-queue entry.
 * - Tampered totals → 422; malformed JSON → 400; invalid bodies → 422 —
 *   same server-authority laws as /api/checkout, one shared validator.
 * - Review entries are pending_review until the fulfillment flow (G12).
 * - No payment instructions here — that is /api/checkout's job.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/orders/route';

const LEDGER = join(mkdtempSync(join(tmpdir(), 'orders-route-')), 'orders.jsonl');
process.env.ORDERS_LEDGER_PATH = LEDGER;

const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };

const VALID_SOAP_ITEM = {
  product_handle: 'gaias-rose-soap',
  quantity: 1,
  customization: {
    base: 'glycerin-castor',
    shape: 'wave-rectangle',
    scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
    botanical: 'lavender',
    color: 'amber-gold',
  },
  unit_price_cents: 1177,
};

async function postOrders(body: unknown, raw?: string) {
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('orders route', () => {
  it('accepts a valid order and returns receipt + review-queue entry', async () => {
    const { status, json } = await postOrders({
      items: [VALID_SOAP_ITEM],
      customer: CUSTOMER,
      client_total_cents: 1177,
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.order_id).toMatch(/^AWK-\d{8}-[A-Z0-9]{6}$/);

    const receipt = json.receipt as Record<string, unknown>;
    expect(receipt.id).toBe(json.order_id);
    expect(receipt.backend).toBe('jsonl');

    const entry = json.review_entry as Record<string, unknown>;
    expect(entry.order_id).toBe(json.order_id);
    expect(entry.review_status).toBe('pending_review');
    expect(entry.total_cents).toBe(1177);

    const fulfillment = json.fulfillment as Record<string, unknown>;
    expect(fulfillment.status).toBe('pending_review');

    // No payment instructions on the intake contract — checkout owns those.
    expect(json).not.toHaveProperty('payment');
  });

  it('rejects a tampered client total with 422', async () => {
    const { status, json } = await postOrders({
      items: [VALID_SOAP_ITEM],
      customer: CUSTOMER,
      client_total_cents: 1,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Total mismatch/);
  });

  it('rejects malformed JSON with 400', async () => {
    const { status, json } = await postOrders(null, '{not json');
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it('rejects an order with no items with 422', async () => {
    const { status } = await postOrders({
      items: [],
      customer: CUSTOMER,
      client_total_cents: 0,
    });
    expect(status).toBe(422);
  });

  it('rejects an invalid customization with 422', async () => {
    const { status, json } = await postOrders({
      items: [
        {
          ...VALID_SOAP_ITEM,
          customization: {
            ...VALID_SOAP_ITEM.customization,
            scent: { type: 'custom_blend', oils: ['not-an-oil'] },
          },
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 1177,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Unknown blendable oil/);
  });
});
