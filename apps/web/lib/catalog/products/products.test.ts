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
import { isSupersededProduct } from '../status';

describe('catalog port provenance', () => {
  it('carries a provenance header: source, count, status', () => {
    expect(CATALOG_PROVENANCE.source).toBe('products.canonical.v3.json');
    expect(CATALOG_PROVENANCE.recordCount).toBe(62);
    expect(CATALOG_PROVENANCE.status).toBe('PROPOSED');
  });

  it('contains exactly 62 records (46 prior records + 13 owner-directed specialty teas + the Collagen Supplement split record + the owner-directed Small Rose listing + the owner-approved Custom Botanical Balm record)', () => {
    expect(PRODUCTS).toHaveLength(62);
  });

  it('handles are unique', () => {
    const handles = PRODUCTS.map((p) => p.handle);
    expect(new Set(handles).size).toBe(62);
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

interface TrioMember {
  handle: string;
  shape: string;
  price: number;
}

describe('Hearth & Harvest Trio record (owner-approved 2026-10-15)', () => {
  const trio = getProductByHandle('hearth-harvest-trio');
  const members = (trio?.member_products ?? []) as unknown as TrioMember[];

  it('exists and is a current (not superseded) bundle', () => {
    expect(trio).toBeDefined();
    expect(trio!.category).toBe('Bundles');
    expect(isSupersededProduct(trio!)).toBe(false);
    expect(trio!.price_status as string).toBe('OWNER_CONFIRMED');
  });

  it('price is the owner-confirmed $26.77; subscriber $24.09', () => {
    expect(Math.round((trio!.price as number) * 100)).toBe(2677);
    expect(Math.round((trio!.subscriber_price as number) * 100)).toBe(2409);
  });

  it('names exactly the three approved member soaps, each Large Wave Rectangle', () => {
    expect(members.map((m) => m.handle)).toEqual([
      'warm-cinnamon-comfort-soap',
      'sacred-forest-ritual-soap',
      'gaias-rose-soap',
    ]);
    for (const m of members) {
      expect(m.shape).toBe('Large Wave Rectangle');
    }
  });

  it('compare_at_price equals the member sum computed from the member records', () => {
    let sumCents = 0;
    for (const m of members) {
      const product = getProductByHandle(m.handle);
      expect(product).toBeDefined();
      expect(isSupersededProduct(product!)).toBe(false);
      const variant = (product!.variants ?? []).find(
        (v) => v.shape === 'Large Wave Rectangle',
      );
      expect(variant).toBeDefined();
      expect(Math.round((variant!.price as number) * 100)).toBe(
        Math.round(m.price * 100),
      );
      sumCents += Math.round((variant!.price as number) * 100);
    }
    expect(sumCents).toBe(3531);
    expect(Math.round((trio!.compare_at_price as number) * 100)).toBe(sumCents);
  });

  it('bundle_savings_computed is internally consistent with the approved math', () => {
    const savings = trio!.bundle_savings_computed as unknown as {
      component_sum: number;
      bundle_price: number;
      savings_amount: number;
      savings_pct: number;
    };
    expect(Math.round(savings.component_sum * 100)).toBe(3531);
    expect(Math.round(savings.bundle_price * 100)).toBe(2677);
    expect(savings.component_sum - savings.bundle_price).toBeCloseTo(
      savings.savings_amount,
      2,
    );
    expect((savings.savings_amount / savings.component_sum) * 100).toBeCloseTo(
      24.2,
      1,
    );
    expect(savings.savings_pct).toBe(24.2);
  });

  it('trio variant price agrees with the trio record price', () => {
    for (const v of trio!.variants ?? []) {
      if (v.price != null) {
        expect(Math.round(v.price * 100)).toBe(2677);
      }
    }
  });
});
