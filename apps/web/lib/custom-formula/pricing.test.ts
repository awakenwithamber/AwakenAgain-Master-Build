/**
 * Custom-formula pricing tests — the shared integer-cents spec
 * (lib/pricing/pricing.ts) plus the server mirror
 * (priceFormulaCustomization in lib/cart/validation.ts).
 *
 * Laws under test:
 * - CLIENT=PREVIEW / SERVER=AUTHORITY: the client preview function and
 *   the server price function compute IDENTICALLY from canonical data.
 * - All money in integer cents; no floats leak into totals.
 * - Unknown sizes/herbs fail closed (throw), never price as zero.
 */
import { describe, expect, it } from 'vitest';
import {
  CUSTOM_CAPSULE_HANDLE,
  CUSTOM_CAPSULE_SIZES,
  CUSTOM_TEA_HANDLE,
  CUSTOM_TEA_SIZES,
  customFormulaPriceCents,
  formatPrice,
  formulaKindForHandle,
  getFormulaSize,
} from '../pricing/pricing';
import { herbPriceCents } from '../catalog/herbs';
import { priceFormulaCustomization } from '../cart/validation';

describe('formula size tables (PROPOSED — legacy variant prices)', () => {
  it('capsule sizes: 28-cap base 3333¢, 60-cap base 6000¢', () => {
    expect(getFormulaSize('capsule', 'capsule-28')?.baseCents).toBe(3333);
    expect(getFormulaSize('capsule', 'capsule-60')?.baseCents).toBe(6000);
    expect(CUSTOM_CAPSULE_SIZES).toHaveLength(2);
  });

  it('tea sizes: loose-leaf 1333¢, 20-bag 1199¢', () => {
    expect(getFormulaSize('tea', 'tea-loose-1oz')?.baseCents).toBe(1333);
    expect(getFormulaSize('tea', 'tea-bags-20')?.baseCents).toBe(1199);
    expect(CUSTOM_TEA_SIZES).toHaveLength(2);
  });

  it('sizes are kind-scoped: no cross-kind lookup', () => {
    expect(getFormulaSize('capsule', 'tea-loose-1oz')).toBeUndefined();
    expect(getFormulaSize('tea', 'capsule-28')).toBeUndefined();
  });

  it('formulaKindForHandle maps the two catalog handles', () => {
    expect(formulaKindForHandle(CUSTOM_CAPSULE_HANDLE)).toBe('capsule');
    expect(formulaKindForHandle(CUSTOM_TEA_HANDLE)).toBe('tea');
    expect(formulaKindForHandle('custom-alchemy-soap')).toBeNull();
    expect(formulaKindForHandle('dreamease-capsules')).toBeNull();
  });
});

describe('customFormulaPriceCents — client preview math', () => {
  it('capsule: base + per-herb add-ons', () => {
    // lavender 29¢ + chamomile 29¢ on the 28-cap base
    expect(herbPriceCents('lavender')).toBe(29);
    expect(herbPriceCents('chamomile')).toBe(29);
    expect(customFormulaPriceCents('capsule', 'capsule-28', ['lavender', 'chamomile'])).toBe(
      3333 + 29 + 29,
    );
    expect(formatPrice(3333 + 29 + 29)).toBe('$33.91');
  });

  it('tea: base + per-herb add-ons', () => {
    expect(customFormulaPriceCents('tea', 'tea-bags-20', ['lavender'])).toBe(1199 + 29);
  });

  it('empty herb list prices the bare base', () => {
    expect(customFormulaPriceCents('capsule', 'capsule-60', [])).toBe(6000);
  });

  it('unknown size throws — never prices as zero', () => {
    expect(() => customFormulaPriceCents('capsule', 'nope', ['lavender'])).toThrow(
      /Unknown formula size/,
    );
  });

  it('unknown herb throws — never silently skipped', () => {
    expect(() => customFormulaPriceCents('tea', 'tea-loose-1oz', ['nope'])).toThrow(
      /Unknown herb id/,
    );
  });

  it('results are always integer cents', () => {
    const cents = customFormulaPriceCents('capsule', 'capsule-28', [
      'lavender',
      'chamomile',
      'peppermint',
    ]);
    expect(Number.isInteger(cents)).toBe(true);
  });
});

describe('CLIENT=PREVIEW / SERVER=AUTHORITY parity', () => {
  it('server price mirrors the client preview exactly', () => {
    const herbIds = ['andrographis', 'garlic'];
    const preview = customFormulaPriceCents('capsule', 'capsule-28', herbIds);
    const server = priceFormulaCustomization(CUSTOM_CAPSULE_HANDLE, {
      herb_ids: herbIds,
      size_id: 'capsule-28',
    });
    expect(server).toBe(preview);
    expect(server).toBe(3333 + 23 + 23);
  });

  it('server price mirrors for tea', () => {
    const herbIds = ['lavender', 'chamomile'];
    expect(
      priceFormulaCustomization(CUSTOM_TEA_HANDLE, {
        herb_ids: herbIds,
        size_id: 'tea-loose-1oz',
      }),
    ).toBe(customFormulaPriceCents('tea', 'tea-loose-1oz', herbIds));
  });

  it('server rejects what the client cannot price', () => {
    expect(() =>
      priceFormulaCustomization(CUSTOM_TEA_HANDLE, {
        herb_ids: ['andrographis'], // capsule-only herb in a tea
        size_id: 'tea-loose-1oz',
      }),
    ).toThrow(/not usable in tea/);
    expect(() =>
      priceFormulaCustomization('custom-alchemy-soap', {
        herb_ids: ['lavender'],
        size_id: 'capsule-28',
      }),
    ).toThrow(/Not a custom-formula product/);
  });
});
