/**
 * REGRESSION SUITE — checkout Route Handler.
 *
 * Laws under test:
 * - SERVER = AUTHORITY: tampered unit prices and tampered client totals are
 *   REJECTED (422), never silently accepted.
 * - Every customization is validated server-side: unknown oil IDs rejected,
 *   Natural/Clear restricted to translucent bases, per-slot bundle integrity.
 * - Unknown products / variants / unpriced products rejected.
 * - Order record schema: order_id, computed_by: 'server', integer-cent
 *   totals, payment_method, shipping rule (FREE / TO_BE_CONFIRMED).
 * - Payment instructions contain ONLY Cash App + Venmo — no other provider
 *   names, handles, or links.
 * - Successful orders append exactly one JSON line to the ledger.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { POST } from '../app/api/checkout/route';
import { validateAndBuildOrder } from '../lib/checkout/order';

const LEDGER = join(mkdtempSync(join(tmpdir(), 'orders-test-')), 'orders.jsonl');
process.env.ORDERS_LEDGER_PATH = LEDGER;

const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };

const VALID_SOAP_ITEM = {
  product_handle: 'gaias-rose-soap',
  quantity: 2,
  customization: {
    base: 'glycerin-castor',
    shape: 'wave-rectangle',
    scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
    botanical: 'lavender',
    color: 'amber-gold',
  },
  unit_price_cents: 1177,
};

const VALID_CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};

function bundlePayload() {
  const shapes = [
    'small-rose',
    'medium-rose',
    'plain-rectangle',
    'wave-rectangle',
    'floral-round',
  ];
  return {
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

describe('checkout route', () => {
  beforeAll(() => {
    // ledger path is read at write time; env set at module top suffices
    expect(process.env.ORDERS_LEDGER_PATH).toBe(LEDGER);
  });

  it('accepts a valid order, records it, and returns payment instructions', async () => {
    const body = {
      items: [VALID_SOAP_ITEM, VALID_CAPSULE_ITEM],
      bundle: bundlePayload(),
      customer: CUSTOMER,
      is_subscriber: false,
      client_total_cents: 1177 * 2 + 1977 + 3577,
    };
    const { status, json } = await postCheckout(body);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.order_id).toMatch(/^AWK-\d{8}-[A-Z0-9]{6}$/);
    expect(json.total_cents).toBe(1177 * 2 + 1977 + 3577);
    // $79.08 < $100 general free-shipping threshold — shipping confirmed later
    expect(json.shipping_status).toBe('TO_BE_CONFIRMED');

    const payment = json.payment as Record<string, string>;
    expect(payment.cash_app).toBe('$AmberPatten347');
    expect(payment.venmo).toBe('@AwakenwithAmber');
    const paymentText = JSON.stringify(payment).toLowerCase();
    for (const banned of ['stripe', 'shopify', 'paypal', 'square']) {
      expect(paymentText).not.toContain(banned);
    }

    // ledger got exactly one valid JSON line with the same order
    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    expect(last.order_id).toBe(json.order_id);
    expect(last.computed_by).toBe('server');
    expect(last.ledger_version).toBe(1);
    expect(last.total_cents).toBe(json.total_cents);
    expect(last.payment_method).toBe('cash_app_or_venmo');
    expect(typeof last.subtotal_cents).toBe('number');
    expect(Number.isInteger(last.subtotal_cents)).toBe(true);
  });

  it('rejects a tampered client total', async () => {
    const { status, json } = await postCheckout({
      items: [VALID_SOAP_ITEM],
      customer: CUSTOMER,
      client_total_cents: 1, // server computes 2354
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Total mismatch/);
  });

  it('rejects a tampered unit price', async () => {
    const { status, json } = await postCheckout({
      items: [{ ...VALID_SOAP_ITEM, unit_price_cents: 1 }],
      customer: CUSTOMER,
      client_total_cents: 2,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Price mismatch/);
  });

  it('rejects an invalid blend oil ID', async () => {
    const bad = {
      ...VALID_SOAP_ITEM,
      customization: {
        ...VALID_SOAP_ITEM.customization,
        scent: { type: 'custom_blend', oils: ['oregano'] },
      },
    };
    const { status, json } = await postCheckout({
      items: [bad],
      customer: CUSTOMER,
      client_total_cents: 2354,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/Unknown blendable oil/);
  });

  it('rejects a custom blend over the 3-oil limit', async () => {
    const bad = {
      ...VALID_SOAP_ITEM,
      customization: {
        ...VALID_SOAP_ITEM.customization,
        scent: {
          type: 'custom_blend',
          oils: ['lavender', 'lemon', 'peppermint', 'cedarwood'],
        },
      },
    };
    const { status, json } = await postCheckout({
      items: [bad],
      customer: CUSTOMER,
      client_total_cents: 2354,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/at most 3 oils/);
  });

  it('rejects Natural/Clear on a non-translucent base', async () => {
    const bad = {
      ...VALID_SOAP_ITEM,
      customization: {
        ...VALID_SOAP_ITEM.customization,
        base: 'double-layer',
        color: 'natural-clear',
      },
    };
    const { status, json } = await postCheckout({
      items: [bad],
      customer: CUSTOMER,
      client_total_cents: 2354,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/translucent base/);
  });

  it('rejects unknown products and variants', async () => {
    const noProduct = await postCheckout({
      items: [{ product_handle: 'not-a-real-product', quantity: 1, unit_price_cents: 100 }],
      customer: CUSTOMER,
      client_total_cents: 100,
    });
    expect(noProduct.status).toBe(422);

    const noVariant = await postCheckout({
      items: [
        {
          product_handle: 'chill-pill-capsules',
          variant_id: 'made-up-variant',
          quantity: 1,
          unit_price_cents: 1977,
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 1977,
    });
    expect(noVariant.status).toBe(422);
  });

  it('rejects products with no established price', async () => {
    const { status } = await postCheckout({
      items: [{ product_handle: 'energy-work', quantity: 1, unit_price_cents: 0 }],
      customer: CUSTOMER,
      client_total_cents: 0,
    });
    expect(status).toBe(422);
  });

  it('rejects a bundle with a wrong-shape slot', async () => {
    const bundle = bundlePayload();
    bundle.slots[2] = { ...bundle.slots[2], shape: 'small-rose' };
    const { status, json } = await postCheckout({
      items: [],
      bundle,
      customer: CUSTOMER,
      client_total_cents: 3577,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/must be shape/);
  });

  it('rejects empty orders and invalid customer data', async () => {
    const empty = await postCheckout({
      items: [],
      customer: CUSTOMER,
      client_total_cents: 0,
    });
    expect(empty.status).toBe(422);

    const badEmail = await postCheckout({
      items: [VALID_SOAP_ITEM],
      customer: { name: 'Test', email: 'not-an-email' },
      client_total_cents: 2354,
    });
    expect(badEmail.status).toBe(422);
  });

  it('applies the subscriber free-shipping threshold honestly', () => {
    // $99.98 order: below the $100 general threshold, above the $75 subscriber one.
    const item = {
      product_handle: 'stress-relief-ritual',
      quantity: 2,
      unit_price_cents: 4999,
    };
    const general = validateAndBuildOrder({
      items: [{ ...item }],
      customer: CUSTOMER,
      is_subscriber: false,
      client_total_cents: 9998,
    });
    expect(general.shipping_status).toBe('TO_BE_CONFIRMED');
    const subscriber = validateAndBuildOrder({
      items: [{ ...item }],
      customer: CUSTOMER,
      is_subscriber: true,
      client_total_cents: 9998,
    });
    expect(subscriber.shipping_status).toBe('FREE');
    expect(subscriber.shipping_cents).toBe(0);
    // shipping is never added to the total — no flat rate exists in source
    expect(subscriber.total_cents).toBe(9998);
  });

  it('stores exact oil IDs in the order record, never "custom scent"', () => {
    const record = validateAndBuildOrder({
      items: [
        {
          ...VALID_SOAP_ITEM,
          customization: {
            ...VALID_SOAP_ITEM.customization,
            scent: { type: 'custom_blend', oils: ['cedarwood', 'frankincense'] },
          },
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 2354,
    });
    const scent = record.items[0].customization!.scent;
    expect(scent).toEqual({
      type: 'custom_blend',
      oils: ['cedarwood', 'frankincense'],
    });
  });

  /**
   * PERMANENT REGRESSION — DO NOT WEAKEN OR REMOVE (owner directive
   * 2026-10-05). Original bug: a customization attached to a non-soap
   * product was once charged at the customization's soap price ($5.77
   * for small-rose) instead of the product's real price — a silent
   * underpayment that produced internally inconsistent order records
   * (capsule title + soap price). The server gate (isSoapProduct in
   * lib/checkout/order.ts) must keep rejecting these; relaxing it
   * reopens the money leak.
   */
  it('rejects a customization attached to a non-soap product', async () => {
    // Attack: a $19.77 capsule variant priced at the $5.77 small-rose soap
    // price by attaching a valid soap customization. The record would be
    // internally inconsistent (capsule title + soap price), so it must fail.
    const { status, json } = await postCheckout({
      items: [
        {
          product_handle: 'chill-pill-capsules',
          quantity: 1,
          customization: {
            base: 'goat-milk-shea',
            shape: 'small-rose',
            scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
            botanical: null,
            color: 'amber-gold',
          },
          unit_price_cents: 577,
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 577,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /not a soap product/,
    );
  });

  it('rejects an item carrying both a variant and a customization', async () => {
    const { status, json } = await postCheckout({
      items: [
        {
          ...VALID_SOAP_ITEM,
          variant_id: 'gaias-rose-soap-wave-rect',
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 2354,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /mutually exclusive/,
    );
  });

  it('rejects a non-object item with a clean error, not a TypeError', async () => {
    const { status, json } = await postCheckout({
      items: [null],
      customer: CUSTOMER,
      client_total_cents: 0,
    });
    expect(status).toBe(422);
    const message = String((json.errors as string[]).join(' '));
    expect(message).toMatch(/Order item must be an object/);
    expect(message).not.toMatch(/destructure|TypeError/i);
  });

  it('accepts the custom-builder handle with a valid customization', async () => {
    // The "Create Your Own Alchemy Soap" builder posts
    // product_handle 'custom-alchemy-soap' (not in the generated catalog).
    // It must validate as a soap, priced from the shape table.
    const { status, json } = await postCheckout({
      items: [
        {
          product_handle: 'custom-alchemy-soap',
          quantity: 1,
          customization: {
            base: 'glycerin-castor',
            shape: 'floral-round',
            scent: { type: 'custom_blend', oils: ['rose', 'jasmine'] },
            botanical: 'rose-petals',
            color: 'amber-gold',
          },
          unit_price_cents: 1177,
        },
      ],
      customer: CUSTOMER,
      client_total_cents: 1177,
    });
    expect(status).toBe(200);
    expect(json.total_cents).toBe(1177);
    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    const line = (last.items as Record<string, unknown>[])[0];
    expect(line.title).toBe('Custom Alchemy Soap (your creation)');
    expect(line.customization).toMatchObject({
      scent: { type: 'custom_blend', oils: ['rose', 'jasmine'] },
    });
  });

  it('accepts a bundle with mixed signature + custom-blend slots', async () => {
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
        scent:
          i % 2 === 0
            ? { type: 'signature', recipe_id: 'SCENT_RECIPE_01' }
            : { type: 'custom_blend', oils: ['lavender', 'cedarwood'] },
        botanical: i === 0 ? 'rose-petals' : null,
        color: 'amber-gold',
      })),
    };
    const { status, json } = await postCheckout({
      items: [],
      bundle,
      customer: CUSTOMER,
      client_total_cents: 3577,
    });
    expect(status).toBe(200);
    expect(json.total_cents).toBe(3577);
    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    const saved = (last.bundle as Record<string, unknown>).slots as Record<
      string,
      unknown
    >[];
    expect(saved[0].scent).toEqual({
      type: 'signature',
      recipe_id: 'SCENT_RECIPE_01',
    });
    expect(saved[1].scent).toEqual({
      type: 'custom_blend',
      oils: ['lavender', 'cedarwood'],
    });
    expect(last.bundle).toMatchObject({
      bundle_id: 'soap-style-collection-5',
      price_cents: 3577,
      savings_cents: 1208,
    });
  });

  it('sanitizes customer fields before they enter the order record', () => {
    const record = validateAndBuildOrder({
      items: [VALID_SOAP_ITEM],
      customer: {
        name: '  <b>Amber</b> Patten  ',
        email: 'Amber@Example.COM',
        phone: '(801) 414-8984',
        notes: 'x'.repeat(2000),
      },
      client_total_cents: 2354,
    });
    expect(record.customer.name).toBe('Amber Patten');
    expect(record.customer.email).toBe('amber@example.com');
    expect(record.customer.phone).toBe('8014148984');
    expect(record.customer.notes).toHaveLength(1000);
  });

  it('rejects an invalid phone number', async () => {
    const { status, json } = await postCheckout({
      items: [VALID_SOAP_ITEM],
      customer: { name: 'Test', email: 'test@example.com', phone: 'abc' },
      client_total_cents: 2354,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(/phone/i);
  });
});
