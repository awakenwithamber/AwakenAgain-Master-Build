/**
 * Product safety surface helpers (Stage 4, R-07/R-18).
 *
 * Laws: complete ingredients come from the record verbatim; an
 * allergen statement renders ONLY for a real determination —
 * provenance states ("None listed in source materials",
 * NEEDS_VERIFICATION, NOT_APPLICABLE, "Varies by…") render no claim;
 * ingestibility derives from the record's format fields.
 */
import { describe, expect, it } from 'vitest';
import { getProductByHandle, PRODUCTS } from '../catalog/products';
import {
  FDA_STATEMENT,
  allergenStatement,
  completeIngredients,
  isIngestibleProduct,
  productSafetyText,
  safetyTextMentionsMedication,
} from './product-safety';

describe('FDA_STATEMENT', () => {
  it('is the full statutory sentence, verbatim', () => {
    expect(FDA_STATEMENT).toBe(
      'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.',
    );
  });
});

describe('completeIngredients', () => {
  it('returns the record complete_ingredients verbatim', () => {
    const fish = getProductByHandle('wild-caught-omega-3-fish-oil')!;
    expect(completeIngredients(fish)).toBe(fish.complete_ingredients);
    const gut = getProductByHandle('seasonal-gut-reset')!;
    expect(completeIngredients(gut)).toContain('Clove');
    expect(completeIngredients(gut)).toContain('oregano');
  });

  it('returns null for services (NOT_APPLICABLE) and empty lists', () => {
    expect(
      completeIngredients(getProductByHandle('custom-remedy-consultation')!),
    ).toBeNull();
    expect(
      completeIngredients(getProductByHandle('hearth-harvest-trio')!),
    ).toBeNull();
  });
});

describe('allergenStatement', () => {
  it('renders a real determination verbatim (fish)', () => {
    const fish = getProductByHandle('wild-caught-omega-3-fish-oil')!;
    expect(allergenStatement(fish)).toBe(fish.allergens);
    expect(allergenStatement(fish)).toContain('Contains fish');
  });

  it('renders a real determination verbatim (goat milk / shea soaps)', () => {
    const soap = getProductByHandle('gaias-rose-soap')!;
    expect(allergenStatement(soap)).toContain(
      'Contains goat milk (milk) and shea butter',
    );
  });

  it('renders NO claim for "None listed in source materials" records', () => {
    for (const handle of [
      'seasonal-gut-reset',
      'chill-pill-capsules',
      'happy-pill-capsules',
      'metabolic-wellness-formula',
    ]) {
      expect(allergenStatement(getProductByHandle(handle)!), handle).toBeNull();
    }
  });

  it('renders NO claim for NEEDS_VERIFICATION records (incl. bundles)', () => {
    for (const handle of [
      'alchemy-tea-blend',
      'custom-herbal-capsules',
      'custom-tea-blends',
      'gentle-detox-ritual',
      'focus-clarity-ritual',
      'full-soap-collection',
    ]) {
      expect(allergenStatement(getProductByHandle(handle)!), handle).toBeNull();
    }
  });

  it('renders NO claim for NOT_APPLICABLE services or "Varies by" records', () => {
    expect(
      allergenStatement(getProductByHandle('energy-work')!),
    ).toBeNull();
    expect(
      allergenStatement(getProductByHandle('soap-style-collection-5')!),
    ).toBeNull();
    expect(
      allergenStatement(getProductByHandle('custom-botanical-soap')!),
    ).toBeNull();
  });

  it('never renders an allergen claim that the record does not contain', () => {
    for (const product of PRODUCTS) {
      const statement = allergenStatement(product);
      if (statement !== null) {
        expect(statement).toBe(product.allergens);
      }
    }
  });
});

describe('isIngestibleProduct', () => {
  it('classifies the catalog from format fields (33 ingestible records)', () => {
    const ingestible = PRODUCTS.filter(isIngestibleProduct).map((p) => p.handle);
    expect(ingestible).toEqual(
      expect.arrayContaining([
        'dreamease-capsules',
        'alchemy-tea-blend',
        'gentle-detox-ritual', // bundle whose sizes list capsules + tea bags
        'radiance-support-capsules', // sizes state "30 capsules"
        'custom-herbal-capsules',
        'wild-caught-omega-3-fish-oil',
      ]),
    );
    expect(ingestible).toHaveLength(33);
  });

  it('topicals, soaps, services, and digital products are not ingestible', () => {
    for (const handle of [
      'soothe-restore-botanical-balm',
      'radiance-renewal-balm',
      'root-scalp-revival-serum',
      'gaias-rose-soap',
      'full-soap-collection',
      'hearth-harvest-trio',
      'energy-work',
      'grimoire-subscription',
      'personalized-herbal-protocols',
      'custom-remedy-consultation',
    ]) {
      expect(isIngestibleProduct(getProductByHandle(handle)!), handle).toBe(false);
    }
  });
});

describe('medication matching against the record’s own safety text', () => {
  it('flattens string and array warnings', () => {
    expect(
      productSafetyText(getProductByHandle('seasonal-gut-reset')!),
    ).toContain('May interact with medications');
    expect(
      productSafetyText(getProductByHandle('alchemy-tea-blend')!).length,
    ).toBeGreaterThan(0);
  });

  it('matches records whose warnings mention medication', () => {
    expect(
      safetyTextMentionsMedication(getProductByHandle('seasonal-gut-reset')!),
    ).toBe(true);
    expect(
      safetyTextMentionsMedication(getProductByHandle('dreamease-capsules')!),
    ).toBe(true);
  });
});
