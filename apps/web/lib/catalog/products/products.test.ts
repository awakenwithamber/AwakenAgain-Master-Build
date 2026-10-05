/**
 * REGRESSION SUITE — §19: generated catalog port fidelity.
 *
 * The catalog is generated from products.canonical.v3.json via
 * `node scripts/port-catalog.mjs` (provenance header, re-runnable).
 * These tests pin the port's fidelity: record count, bundle price
 * consistency with the shared pricing spec, and — critically — that no
 * superseded price (e.g. the stale $55 bundle variant) can sneak back in.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_PROVENANCE, PRODUCTS, getProductByHandle } from './index';
import { BUNDLE_PRICE_CENTS, bundleComponentSumCents } from '../../pricing/pricing';

describe('catalog port provenance', () => {
  it('carries a provenance header: source, count, status', () => {
    expect(CATALOG_PROVENANCE.source).toBe('products.canonical.v3.json');
    expect(CATALOG_PROVENANCE.recordCount).toBe(45);
    expect(CATALOG_PROVENANCE.status).toBe('PROPOSED');
  });

  it('contains exactly 45 records', () => {
    expect(PRODUCTS).toHaveLength(45);
  });

  it('handles are unique', () => {
    const handles = PRODUCTS.map((p) => p.handle);
    expect(new Set(handles).size).toBe(45);
  });
});

describe('bundle record consistency with the pricing spec', () => {
  it('bundle record price matches the owner-confirmed $35.77', () => {
    const bundle = getProductByHandle('soap-style-collection-5');
    expect(bundle).toBeDefined();
    expect(Math.round((bundle!.price as number) * 100)).toBe(BUNDLE_PRICE_CENTS);
  });

  it('compare_at_price matches the computed component sum ($47.85)', () => {
    const bundle = getProductByHandle('soap-style-collection-5');
    expect(Math.round((bundle!.compare_at_price as number) * 100)).toBe(
      bundleComponentSumCents(),
    );
  });

  it('NO variant carries the superseded $55 bundle price', () => {
    // Regression: the v3 JSON once carried price 55 on the bundle variant
    // after the top-level price was corrected to 35.77. This test fails the
    // build if a stale price ever returns via the port script.
    const bad: string[] = [];
    for (const p of PRODUCTS) {
      for (const v of p.variants ?? []) {
        if (v.price === 55 || v.price === 55.0) {
          bad.push(`${p.handle}/${v.variant_id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('bundle variant price agrees with the bundle record price', () => {
    const bundle = getProductByHandle('soap-style-collection-5');
    for (const v of bundle!.variants ?? []) {
      if (v.price != null) {
        expect(Math.round(v.price * 100)).toBe(BUNDLE_PRICE_CENTS);
      }
    }
  });
});
