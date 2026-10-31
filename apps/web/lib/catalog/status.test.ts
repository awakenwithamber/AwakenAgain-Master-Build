/**
 * Catalog lifecycle predicates — superseded + fixed-formula markers.
 *
 * The fixed-formula marker (owner ruling 2026-10-30) is what lets the
 * Shea & Goat Milk Small Rose Soap live in the 'Soaps' category — on
 * the shop's soap shelf and the home page Soap Shelf — while every
 * customization surface refuses to modify it: it is sold exactly as
 * pictured, at its own record price, never through the SoapCustomizer
 * or the soap shape table.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCTS, getProductByHandle } from './products';
import { isFixedFormulaProduct, isSupersededProduct } from './status';

describe('isFixedFormulaProduct', () => {
  it('is true for the Shea & Goat Milk Small Rose Soap', () => {
    const smallRose = getProductByHandle('shea-goat-milk-small-rose-soap');
    expect(smallRose).toBeDefined();
    expect(isFixedFormulaProduct(smallRose!)).toBe(true);
  });

  it('the Small Rose shelves with the soaps (category Soaps)', () => {
    const smallRose = getProductByHandle('shea-goat-milk-small-rose-soap');
    expect(smallRose?.category).toBe('Soaps');
  });

  it('is false for a customizable soap (Gaia\u2019s Rose)', () => {
    const gaiasRose = getProductByHandle('gaias-rose-soap');
    expect(gaiasRose).toBeDefined();
    expect(gaiasRose?.category).toBe('Soaps');
    expect(isFixedFormulaProduct(gaiasRose!)).toBe(false);
  });

  it('is false for products without the marker', () => {
    const balm = getProductByHandle('radiance-renewal-balm');
    expect(balm).toBeDefined();
    expect(isFixedFormulaProduct(balm!)).toBe(false);
  });

  it('exactly one catalog product carries the marker today', () => {
    const marked = PRODUCTS.filter((p) => isFixedFormulaProduct(p));
    expect(marked.map((p) => p.handle)).toEqual([
      'shea-goat-milk-small-rose-soap',
    ]);
  });
});

describe('isSupersededProduct (unchanged behavior)', () => {
  it('the Small Rose is not superseded', () => {
    const smallRose = getProductByHandle('shea-goat-milk-small-rose-soap');
    expect(isSupersededProduct(smallRose!)).toBe(false);
  });
});
