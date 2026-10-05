/**
 * REGRESSION SUITE — §19: shared deterministic pricing specification.
 *
 * Business laws under test:
 * - CLIENT PRICE = PREVIEW, SERVER PRICE = AUTHORITY (documented in the
 *   module; these tests guard the shared spec both sides consume).
 * - All money in integer cents. $35.77 bundle and $12.08 savings DERIVE
 *   from canonical component prices — never hard-coded.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_ID,
  BUNDLE_NAME,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SLOT_SHAPES,
  CANONICAL_PRICES,
  bundleComponentSumCents,
  bundleSavingsCents,
  bundleSavingsPct,
  formatPrice,
  toCents,
} from './pricing';
import { SOAP_SHAPES, getShape } from '../catalog/shapes';

describe('canonical owner-confirmed prices (integer cents)', () => {
  it('standard botanical capsules: 2-week $19.77 / 30-day $47.77', () => {
    expect(CANONICAL_PRICES.capsuleTwoWeekCents).toBe(1977);
    expect(CANONICAL_PRICES.capsuleThirtyDayCents).toBe(4777);
  });

  it('wild-caught Omega-3: $54.77 (explicit exception)', () => {
    expect(CANONICAL_PRICES.omega3Cents).toBe(5477);
  });

  it('Living Grimoire: $7.77/month', () => {
    expect(CANONICAL_PRICES.grimoireMonthlyCents).toBe(777);
  });

  it('all five soap shapes carry owner-confirmed per-shape prices', () => {
    expect(SOAP_SHAPES).toHaveLength(5);
    const expected: Record<string, number> = {
      'small-rose': 577, // 2 oz
      'medium-rose': 877, // 3 oz
      'plain-rectangle': 977, // 4 oz Large Plain Rectangle
      'wave-rectangle': 1177, // 4.5 oz Large Wave Rectangle
      'floral-round': 1177, // 4.5 oz Large Floral Round
    };
    for (const [id, cents] of Object.entries(expected)) {
      expect(getShape(id)?.priceCents).toBe(cents);
    }
  });

  it('shape sizes follow the proportion rule: Small < Medium < Large', () => {
    const sizes = SOAP_SHAPES.map((s) => s.weightOz);
    expect(sizes).toEqual([2, 3, 4, 4.5, 4.5]);
  });

  it('subscriber prices are a 10% discount, rounded to the cent', () => {
    for (const shape of SOAP_SHAPES) {
      expect(shape.subscriberPriceCents).toBe(Math.round(shape.priceCents * 0.9));
    }
  });
});

describe('bundle pricing — derived, never hard-coded', () => {
  it('bundle identity and owner-confirmed price $35.77', () => {
    expect(BUNDLE_ID).toBe('soap-style-collection-5');
    expect(BUNDLE_NAME).toBe('The Alchemy Soap Collection');
    expect(BUNDLE_PRICE_CENTS).toBe(3577);
    expect(formatPrice(BUNDLE_PRICE_CENTS)).toBe('$35.77');
  });

  it('bundle covers exactly one of each of the 5 styles', () => {
    expect(BUNDLE_SLOT_SHAPES).toEqual([
      'small-rose',
      'medium-rose',
      'plain-rectangle',
      'wave-rectangle',
      'floral-round',
    ]);
  });

  it('component sum derives from the canonical shape table: $47.85', () => {
    expect(bundleComponentSumCents()).toBe(4785);
    expect(formatPrice(bundleComponentSumCents())).toBe('$47.85');
  });

  it('savings derive live: $12.08 (4785 − 3577)', () => {
    expect(bundleSavingsCents()).toBe(1208);
    expect(bundleSavingsCents()).toBe(bundleComponentSumCents() - BUNDLE_PRICE_CENTS);
    expect(formatPrice(bundleSavingsCents())).toBe('$12.08');
  });

  it('savings percentage derives live: 25.2% (1208/4785 = 25.245…%)', () => {
    // The business record's "25.3%" was a rounding approximation; the
    // derived one-decimal value is 25.2%. The spec — not copy — is truth.
    expect(bundleSavingsPct()).toBe(25.2);
  });

  it('savings are not hard-coded anywhere in the pricing module source', () => {
    const src = readFileSync(new URL('./pricing.ts', import.meta.url), 'utf8');
    // The literal savings value must only ever appear as a *derived* result,
    // never as a constant the code or tests could drift from.
    expect(src).not.toMatch(/(?:savingsCents|SAVINGS)\s*=\s*1208/i);
    expect(src).not.toContain('"1208"');
  });

  it('bundle price + savings always reconcile with the component sum', () => {
    // If any per-shape price changes, this identity must still hold —
    // the bundle can never silently drift into negative or fake savings.
    expect(BUNDLE_PRICE_CENTS + bundleSavingsCents()).toBe(bundleComponentSumCents());
    expect(bundleSavingsCents()).toBeGreaterThan(0);
  });
});

describe('integer-cents discipline', () => {
  it('toCents converts dollars without float drift', () => {
    expect(toCents(35.77)).toBe(3577);
    expect(toCents(4.77)).toBe(477);
    expect(toCents(11.77)).toBe(1177);
  });

  it('formatPrice renders exact dollars', () => {
    expect(formatPrice(577)).toBe('$5.77');
    expect(formatPrice(1208)).toBe('$12.08');
    expect(formatPrice(3577)).toBe('$35.77');
  });

  it('every canonical price is an integer', () => {
    const all = [
      ...Object.values(CANONICAL_PRICES),
      BUNDLE_PRICE_CENTS,
      ...SOAP_SHAPES.map((s) => s.priceCents),
      ...SOAP_SHAPES.map((s) => s.subscriberPriceCents),
    ];
    for (const cents of all) {
      expect(Number.isInteger(cents)).toBe(true);
    }
  });
});
