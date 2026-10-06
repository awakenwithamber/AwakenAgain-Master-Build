/**
 * Formula payload tests — cart builders (lib/cart/validation.ts) and the
 * server checkout path (lib/checkout/order.ts, validateAndBuildOrder).
 *
 * Laws under test:
 * - buildFormulaCartItem validates before building; exact herb IDs
 *   persisted (defensive copy).
 * - buildOrderConfiguration recomputes formula totals authoritatively;
 *   tampered client totals are rejected; customization+formula are
 *   mutually exclusive.
 * - The server checkout accepts formula lines (title, totals) and rejects
 *   mismatches; customer free-text is sanitized before the ledger.
 */
import { describe, expect, it } from 'vitest';
import {
  buildFormulaCartItem,
  buildOrderConfiguration,
  validateFormulaCustomization,
} from '../cart/validation';
import {
  CUSTOM_CAPSULE_HANDLE,
  CUSTOM_TEA_HANDLE,
} from '../pricing/pricing';
import { validateAndBuildOrder } from '../checkout/order';
import type { FormulaCustomization } from '../../types';

const CAPSULE_FORMULA: FormulaCustomization = {
  herb_ids: ['andrographis', 'garlic'],
  size_id: 'capsule-28',
  creation_name: 'Morning Clarity',
};

const TEA_FORMULA: FormulaCustomization = {
  herb_ids: ['lavender', 'chamomile'],
  size_id: 'tea-bags-20',
};

describe('validateFormulaCustomization', () => {
  it('accepts a complete valid formula', () => {
    expect(validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA).valid).toBe(true);
    expect(validateFormulaCustomization(CUSTOM_TEA_HANDLE, TEA_FORMULA).valid).toBe(true);
  });

  it('rejects formulas on non-formula products', () => {
    const r = validateFormulaCustomization('custom-alchemy-soap', CAPSULE_FORMULA);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/not a custom-formula product/);
  });

  it('rejects unknown sizes', () => {
    const r = validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, {
      herb_ids: ['andrographis'],
      size_id: 'nope',
    });
    expect(r.valid).toBe(false);
  });

  it('rejects empty, duplicate, unknown, and form-mismatched herbs', () => {
    expect(
      validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, { herb_ids: [], size_id: 'capsule-28' })
        .valid,
    ).toBe(false);
    expect(
      validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, {
        herb_ids: ['andrographis', 'andrographis'],
        size_id: 'capsule-28',
      }).errors.join(' '),
    ).toMatch(/Duplicate herb/);
    expect(
      validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, {
        herb_ids: ['nope'],
        size_id: 'capsule-28',
      }).errors.join(' '),
    ).toMatch(/Unknown herb/);
    expect(
      validateFormulaCustomization(CUSTOM_TEA_HANDLE, {
        herb_ids: ['andrographis'], // capsule-only
        size_id: 'tea-loose-1oz',
      }).errors.join(' '),
    ).toMatch(/not usable in tea/);
  });

  it('rejects over-length free text', () => {
    const r = validateFormulaCustomization(CUSTOM_CAPSULE_HANDLE, {
      herb_ids: ['andrographis'],
      size_id: 'capsule-28',
      creation_name: 'x'.repeat(81),
    });
    expect(r.valid).toBe(false);
  });
});

describe('buildFormulaCartItem', () => {
  it('builds a cart item with exact herb IDs and the server-computed price', () => {
    const item = buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA, 2);
    expect(item.product_handle).toBe(CUSTOM_CAPSULE_HANDLE);
    expect(item.quantity).toBe(2);
    expect(item.formula?.herb_ids).toEqual(['andrographis', 'garlic']);
    expect(item.formula?.size_id).toBe('capsule-28');
    expect(item.unit_price_cents).toBe(3333 + 23 + 23);
    expect(item.customization).toBeUndefined();
  });

  it('defensive-copies herb ids (caller mutation cannot corrupt the item)', () => {
    const herbIds = ['andrographis'];
    const item = buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, { herb_ids: herbIds, size_id: 'capsule-28' }, 1);
    herbIds.push('garlic');
    expect(item.formula?.herb_ids).toEqual(['andrographis']);
  });

  it('throws on invalid formulas and quantities', () => {
    expect(() =>
      buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, { herb_ids: [], size_id: 'capsule-28' }, 1),
    ).toThrow(/at least 1 botanical/);
    expect(() => buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA, 0)).toThrow(
      /Invalid quantity/,
    );
  });
});

describe('buildOrderConfiguration with formula items', () => {
  it('totals recompute authoritatively from canonical data', () => {
    const item = buildFormulaCartItem(CUSTOM_TEA_HANDLE, TEA_FORMULA, 2);
    const order = buildOrderConfiguration([item], undefined, 0);
    expect(order.subtotal_cents).toBe((1199 + 29 + 29) * 2);
    expect(order.total_cents).toBe(order.subtotal_cents);
    expect(order.computed_by).toBe('server');
  });

  it('a tampered unit price is rejected', () => {
    const item = buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA, 1);
    const tampered = { ...item, unit_price_cents: item.unit_price_cents - 100 };
    expect(() => buildOrderConfiguration([tampered], undefined, 0)).toThrow(/Price mismatch/);
  });

  it('customization + formula on one item is rejected (mutually exclusive)', () => {
    const item = buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA, 1);
    const bad = {
      ...item,
      customization: {
        base: 'double-layer',
        shape: 'wave-rectangle',
        scent: { type: 'custom_blend', oils: ['lavender'] },
        botanical: null,
        color: 'emerald',
      },
    } as typeof item;
    expect(() => buildOrderConfiguration([bad], undefined, 0)).toThrow(/mutually exclusive/);
  });
});

describe('validateAndBuildOrder — server checkout with formula lines', () => {
  function checkoutBody(itemOverrides: Record<string, unknown> = {}) {
    const item = buildFormulaCartItem(CUSTOM_CAPSULE_HANDLE, CAPSULE_FORMULA, 1);
    return {
      items: [
        {
          product_handle: item.product_handle,
          quantity: item.quantity,
          formula: item.formula,
          unit_price_cents: item.unit_price_cents,
          ...itemOverrides,
        },
      ],
      customer: { name: 'Test Customer', email: 'test@example.com' },
      client_total_cents: item.unit_price_cents,
    };
  }

  it('accepts a valid formula line with the customer-facing title', () => {
    const record = validateAndBuildOrder(checkoutBody());
    expect(record.items).toHaveLength(1);
    expect(record.items[0]?.title).toBe(
      'Custom Herbal Capsules — Two Week — 28 capsules (your formula)',
    );
    expect(record.items[0]?.unit_price_cents).toBe(3333 + 23 + 23);
    expect(record.items[0]?.formula?.herb_ids).toEqual(['andrographis', 'garlic']);
    expect(record.total_cents).toBe(3333 + 23 + 23);
    expect(record.computed_by).toBe('server');
    expect(record.payment_method).toBe('cash_app_or_venmo');
  });

  it('rejects a client-tampered unit price', () => {
    expect(() => validateAndBuildOrder(checkoutBody({ unit_price_cents: 100 }))).toThrow(
      /Price mismatch/,
    );
  });

  it('rejects a formula on a non-formula product', () => {
    const body = checkoutBody();
    (body.items[0] as Record<string, unknown>).product_handle = 'dreamease-capsules';
    expect(() => validateAndBuildOrder(body)).toThrow(/not a custom-formula product/);
  });

  it('rejects a formula combined with a variant', () => {
    const body = checkoutBody({ variant_id: 'capsule-28' });
    expect(() => validateAndBuildOrder(body)).toThrow(/mutually exclusive/);
  });

  it('sanitizes customer free-text before the ledger', () => {
    const item = buildFormulaCartItem(
      CUSTOM_TEA_HANDLE,
      { ...TEA_FORMULA, creation_name: '<b>Evening</b> Unwind<script>' },
      1,
    );
    const record = validateAndBuildOrder({
      items: [
        {
          product_handle: item.product_handle,
          quantity: 1,
          formula: item.formula,
          unit_price_cents: item.unit_price_cents,
        },
      ],
      customer: { name: 'Test Customer', email: 'test@example.com' },
      client_total_cents: item.unit_price_cents,
    });
    const name = record.items[0]?.formula?.creation_name ?? '';
    expect(name).not.toMatch(/<|>/);
  });
});
