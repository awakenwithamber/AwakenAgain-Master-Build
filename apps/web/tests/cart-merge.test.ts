/**
 * REGRESSION — cart line merging.
 *
 * Bug (rendered re-verification, 2026-10-13): adding the same product twice
 * created two separate cart lines instead of one line with quantity 2 —
 * addItem in components/checkout/cart-store always appended a fresh line.
 * These tests pin the merge contract of the pure helper the store now uses:
 * identical lines (same product + variant + deeply-equal customization /
 * formula) merge with summed quantity; any difference stays a separate line.
 */
import { describe, expect, it } from 'vitest';
import { addItemToCart, cartLineKey } from '../components/checkout/cart-store';
import type { CartItem, Customization, FormulaCustomization } from '../types';

let seq = 0;
function line(partial: Partial<CartItem>): CartItem {
  seq += 1;
  return {
    id: `cart_test_${seq}`,
    product_handle: 'gaias-rose-soap',
    quantity: 1,
    unit_price_cents: 577,
    ...partial,
  };
}

const CUSTOM_SOAP: Customization = {
  base: 'goat-milk-shea',
  shape: 'small-rose',
  scent: { type: 'signature', recipe_id: 'rose-garden' },
  botanical: 'rose-petals',
  color: 'blush',
};

const FORMULA: FormulaCustomization = {
  herb_ids: ['ashwagandha', 'lemon-balm'],
  size_id: 'standard-60',
};

describe('cart line merging', () => {
  it('merges two adds of the same plain product into one line', () => {
    const items = addItemToCart([], line({}));
    const merged = addItemToCart(items, line({}));
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
    // The surviving line keeps the FIRST line's id (stable React key).
    expect(merged[0].id).toBe(items[0].id);
  });

  it('sums quantities greater than one', () => {
    const items = addItemToCart([], line({ quantity: 2 }));
    const merged = addItemToCart(items, line({ quantity: 3 }));
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
  });

  it('does not merge different products', () => {
    const items = addItemToCart([], line({}));
    const next = addItemToCart(items, line({ product_handle: 'chill-pill-capsules' }));
    expect(next).toHaveLength(2);
  });

  it('does not merge different variants of the same product', () => {
    const items = addItemToCart([], line({ variant_id: '2-week' }));
    const next = addItemToCart(items, line({ variant_id: '30-day' }));
    expect(next).toHaveLength(2);
    const merged = addItemToCart(next, line({ variant_id: '2-week' }));
    expect(merged).toHaveLength(2);
    expect(merged[0].quantity).toBe(2);
  });

  it('merges identical soap customizations even when object key order differs', () => {
    const reordered = {
      color: CUSTOM_SOAP.color,
      botanical: CUSTOM_SOAP.botanical,
      scent: CUSTOM_SOAP.scent,
      shape: CUSTOM_SOAP.shape,
      base: CUSTOM_SOAP.base,
    } as Customization;
    const items = addItemToCart(
      [],
      line({ product_handle: 'custom-alchemy-soap', customization: CUSTOM_SOAP }),
    );
    const merged = addItemToCart(
      items,
      line({ product_handle: 'custom-alchemy-soap', customization: reordered }),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
  });

  it('keeps different soap customizations on separate lines', () => {
    const items = addItemToCart(
      [],
      line({ product_handle: 'custom-alchemy-soap', customization: CUSTOM_SOAP }),
    );
    const other = addItemToCart(
      items,
      line({
        product_handle: 'custom-alchemy-soap',
        customization: { ...CUSTOM_SOAP, color: 'violet' },
      }),
    );
    expect(other).toHaveLength(2);
    const otherScent = addItemToCart(
      items,
      line({
        product_handle: 'custom-alchemy-soap',
        customization: {
          ...CUSTOM_SOAP,
          scent: { type: 'custom_blend', oils: ['lavender', 'cedarwood'] },
        },
      }),
    );
    expect(otherScent).toHaveLength(2);
  });

  it('merges identical formulas, keeps different formulas separate', () => {
    const items = addItemToCart(
      [],
      line({ product_handle: 'custom-herbal-capsules', formula: FORMULA }),
    );
    const merged = addItemToCart(
      items,
      line({ product_handle: 'custom-herbal-capsules', formula: { ...FORMULA } }),
    );
    expect(merged).toHaveLength(1);
    const different = addItemToCart(
      items,
      line({
        product_handle: 'custom-herbal-capsules',
        formula: { ...FORMULA, size_id: 'large-120' },
      }),
    );
    expect(different).toHaveLength(2);
  });

  it('never mutates the input list', () => {
    const items = addItemToCart([], line({}));
    const snapshot = [...items];
    addItemToCart(items, line({}));
    expect(items).toEqual(snapshot);
    expect(items[0].quantity).toBe(1);
  });

  it('cartLineKey is stable for equal lines and differs across identities', () => {
    expect(cartLineKey(line({}))).toBe(cartLineKey(line({})));
    expect(cartLineKey(line({}))).not.toBe(cartLineKey(line({ variant_id: 'x' })));
  });
});
