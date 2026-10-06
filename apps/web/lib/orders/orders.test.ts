/**
 * REGRESSION SUITE — order-intake pipeline + provider-neutral store (G3).
 *
 * Laws under test:
 * - intakeOrder unifies (not duplicates) checkout validation: tampered
 *   totals, tampered unit prices, unknown products, incompatible
 *   customizations (soap-only rule), and malformed bundle payloads all
 *   fail at the VALIDATION stage → mapped to 422 by the handler.
 * - Persistence failures surface as the PERSISTENCE stage (→ 500), never
 *   as validation errors.
 * - The RecordStore contract round-trips: append → get → reviewQueue
 *   (newest first), receipt proves durability, JSONL is the backend.
 * - The store is provider-neutral: the only implementation is local
 *   JSONL; a future implementation satisfies the same interface.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { intakeOrder } from './intake';
import {
  JsonlRecordStore,
  createOrderStore,
  toOrderReviewEntry,
  type OrderReviewEntry,
  type RecordStore,
} from './store';
import type { OrderRecord } from '../checkout/order';

const LEDGER = join(mkdtempSync(join(tmpdir(), 'intake-test-')), 'orders.jsonl');
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

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [VALID_SOAP_ITEM],
    customer: CUSTOMER,
    client_total_cents: 1177 * 2,
    ...overrides,
  };
}

describe('intakeOrder — validation stage', () => {
  it('accepts a valid order and returns record + receipt + review entry', async () => {
    const outcome = await intakeOrder(validBody(), createOrderStore());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.order_id).toMatch(/^AWK-\d{8}-[A-Z0-9]{6}$/);
    expect(outcome.record.computed_by).toBe('server');
    expect(outcome.record.total_cents).toBe(2354);
    expect(outcome.receipt.backend).toBe('jsonl');
    expect(outcome.receipt.id).toBe(outcome.record.order_id);
    expect(outcome.reviewEntry.order_id).toBe(outcome.record.order_id);
    expect(outcome.reviewEntry.review_status).toBe('pending_review');
    expect(outcome.reviewEntry.total_cents).toBe(2354);
  });

  it('rejects a tampered client total at the validation stage', async () => {
    const outcome = await intakeOrder(
      validBody({ client_total_cents: 1 }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/Total mismatch/);
  });

  it('rejects a tampered unit price at the validation stage', async () => {
    const outcome = await intakeOrder(
      validBody({
        items: [{ ...VALID_SOAP_ITEM, unit_price_cents: 1 }],
        client_total_cents: 2,
      }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/Price mismatch/);
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
  it('rejects a customization on a non-soap product (incompatible base rule)', async () => {
    const outcome = await intakeOrder(
      validBody({
        items: [
          {
            product_handle: 'chill-pill-capsules',
            quantity: 1,
            customization: VALID_SOAP_ITEM.customization,
            unit_price_cents: 1177,
          },
        ],
        client_total_cents: 1177,
      }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/not a soap product/);
  });

  /**
   * PERMANENT REGRESSION — DO NOT WEAKEN OR REMOVE (owner directive
   * 2026-10-05). Original bug: a customization attached to a non-soap
   * product was once charged at the customization's soap price ($5.77
   * for small-rose) instead of the product's real price — a silent
   * underpayment that produced internally inconsistent order records
   * (capsule title + soap price). This test proves the rejection happens
   * BEFORE any pricing: the pipeline must throw at the soap-product gate
   * in priceItem, so no line item is ever created and no price is ever
   * computed from the customization. The offending item is never silently
   * priced AND never silently dropped — the whole intake fails loudly.
   */
  it('PERMANENT: non-soap product with soap customization is rejected without pricing', async () => {
    // Isolated store — proves the rejected intake persisted NOTHING.
    const isoDir = mkdtempSync(join(tmpdir(), 'permanent-iso-'));
    const store: RecordStore<OrderRecord, OrderReviewEntry> =
      new JsonlRecordStore<OrderRecord, OrderReviewEntry>({
        path: join(isoDir, 'orders.jsonl'),
        getId: (r) => r.order_id,
        toSummary: toOrderReviewEntry,
      });
    const outcome = await intakeOrder(
      validBody({
        items: [
          {
            product_handle: 'chill-pill-capsules',
            quantity: 1,
            // A *valid* soap customization (small-rose = $5.77 shape price)
            // attached to a $19.77 capsule product — the exact attack shape
            // of the original underpayment bug.
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
        client_total_cents: 577,
      }),
      store,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/not a soap product/);
    // No record was produced — nothing priced, nothing persisted.
    expect('record' in outcome).toBe(false);
    expect('receipt' in outcome).toBe(false);
    expect(await store.reviewQueue()).toEqual([]);
  });

  it('rejects an unknown bundle id (malformed bundle payload)', async () => {
    const outcome = await intakeOrder(
      validBody({
        items: [],
        bundle: { ...bundlePayload(), bundle_id: 'not-a-bundle' },
        client_total_cents: 3577,
      }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/Unknown bundle/);
  });

  it('rejects a bundle with the wrong slot count (malformed bundle payload)', async () => {
    const four = bundlePayload();
    four.slots = four.slots.slice(0, 4);
    const outcome = await intakeOrder(
      validBody({ items: [], bundle: four, client_total_cents: 3577 }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/requires 5 slots/);
  });

  it('rejects a bundle slot with the wrong shape (malformed bundle payload)', async () => {
    const bad = bundlePayload();
    bad.slots[2] = { ...bad.slots[2], shape: 'wave-rectangle' };
    const outcome = await intakeOrder(
      validBody({ items: [], bundle: bad, client_total_cents: 3577 }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('validation');
    expect(outcome.errors.join(' ')).toMatch(/must be shape/);
  });

  it('accepts a valid bundle alongside items (bundle price is server-authoritative)', async () => {
    const outcome = await intakeOrder(
      validBody({
        items: [VALID_SOAP_ITEM],
        bundle: bundlePayload(),
        client_total_cents: 2354 + 3577,
      }),
      createOrderStore(),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.bundle?.price_cents).toBe(3577);
    expect(outcome.reviewEntry.bundle_included).toBe(true);
  });
});

describe('intakeOrder — persistence stage', () => {
  it('surfaces store failures as the persistence stage, never validation', async () => {
    // A store pointed at a directory (not a file) always fails to append.
    const dir = mkdtempSync(join(tmpdir(), 'intake-fail-'));
    const brokenStore: RecordStore<OrderRecord, OrderReviewEntry> =
      new JsonlRecordStore<OrderRecord, OrderReviewEntry>({
        path: dir,
        getId: (r) => r.order_id,
        toSummary: toOrderReviewEntry,
      });
    const outcome = await intakeOrder(validBody(), brokenStore);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('persistence');
    expect(outcome.errors.join(' ')).toMatch(/could not be recorded/);
  });

  it('never throws — every failure mode is an IntakeFailure', async () => {
    const outcomes = await Promise.all([
      intakeOrder(null, createOrderStore()),
      intakeOrder('garbage', createOrderStore()),
      intakeOrder({}, createOrderStore()),
    ]);
    for (const outcome of outcomes) {
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(['validation', 'persistence']).toContain(outcome.stage);
      }
    }
  });
});

describe('RecordStore contract — JSONL implementation', () => {
  let dir: string;
  let store: RecordStore<OrderRecord, OrderReviewEntry>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'store-rt-'));
    store = new JsonlRecordStore<OrderRecord, OrderReviewEntry>({
      path: join(dir, 'orders.jsonl'),
      getId: (r) => r.order_id,
      toSummary: toOrderReviewEntry,
    });
  });

  it('round-trips append → get → reviewQueue', async () => {
    const first = await intakeOrder(validBody(), store);
    const second = await intakeOrder(validBody(), store);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const fetched = await store.get(first.record.order_id);
    expect(fetched?.order_id).toBe(first.record.order_id);
    expect(fetched?.total_cents).toBe(2354);
    expect(fetched?.computed_by).toBe('server');

    const queue = await store.reviewQueue();
    expect(queue).toHaveLength(2);
    // Newest first.
    expect(queue[0]?.order_id).toBe(second.record.order_id);
    expect(queue[1]?.order_id).toBe(first.record.order_id);
    expect(queue[0]?.review_status).toBe('pending_review');
    expect(queue[0]?.shipping_status).toBe('TO_BE_CONFIRMED');
  });

  it('reviewQueue honors limit', async () => {
    await intakeOrder(validBody(), store);
    await intakeOrder(validBody(), store);
    const queue = await store.reviewQueue({ limit: 1 });
    expect(queue).toHaveLength(1);
  });

  it('get returns null for unknown ids; empty store reads cleanly', async () => {
    expect(await store.get('AWK-20990101-NOPE')).toBeNull();
    expect(await store.reviewQueue()).toEqual([]);
  });

  it('receipt proves durability through the provider-neutral interface', async () => {
    const outcome = await intakeOrder(validBody(), store);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.backend).toBe('jsonl');
    expect(typeof outcome.receipt.persisted_at).toBe('string');
  });
});
