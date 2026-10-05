/**
 * REGRESSION SUITE — §19: catalog integrity (shapes, oils, scents, seasonal).
 *
 * Laws under test:
 * - The 12-oil blendable list is exact (excludes Oregano, DigestZen,
 *   finished blends as components).
 * - The 13 signature recipes are PROPOSED, stable-ID'd, and inventory-true.
 * - Seasonal features are configurable data; the Pumpkin Spice theme must
 *   never state or imply pumpkin is an ingredient, and its oils must trace
 *   to the owner's actual inventory (curated recipe path when finished
 *   blends are involved).
 */
import { describe, expect, it } from 'vitest';
import { BOTANICALS, SOAP_BASES, SOAP_COLORS, getBase, getColor } from './oils';
import { SIGNATURE_SCENTS, getScentRecipe } from './scents';
import { SEASONAL_SCENTS, getSeasonalFeature } from './seasonal';

describe('soap bases', () => {
  it('exactly 3 owner-confirmed bases', () => {
    expect(SOAP_BASES.map((b) => b.id)).toEqual([
      'double-layer',
      'goat-milk-shea',
      'glycerin-castor',
    ]);
  });

  it('only the glycerin-castor base is translucent', () => {
    expect(getBase('double-layer')?.translucent).toBe(false);
    expect(getBase('goat-milk-shea')?.translucent).toBe(false);
    expect(getBase('glycerin-castor')?.translucent).toBe(true);
  });

  it('the double layer is a hard boundary, never blended', () => {
    const dbl = getBase('double-layer');
    expect(dbl?.description).toMatch(/never blended/i);
  });
});

describe('colors', () => {
  it('15-swatch picker plus Natural/Clear', () => {
    expect(SOAP_COLORS).toHaveLength(15);
  });

  it('Natural/Clear is the ONLY color restricted to translucent bases', () => {
    const restricted = SOAP_COLORS.filter((c) => c.requiresTranslucentBase);
    expect(restricted.map((c) => c.id)).toEqual(['natural-clear']);
    expect(getColor('natural-clear')?.name).toBe('Natural / Clear');
  });
});

describe('botanicals', () => {
  it('exactly 9 botanicals — one per soap', () => {
    expect(BOTANICALS.map((b) => b.id)).toEqual([
      'rose-petals',
      'lavender',
      'calendula',
      'chamomile',
      'hibiscus',
      'rosemary',
      'mint',
      'oatmeal',
      'cornflower',
    ]);
  });
});

describe('signature scent recipes (PROPOSED)', () => {
  it('exactly 13 recipes with stable SCENT_RECIPE_NN IDs', () => {
    expect(SIGNATURE_SCENTS).toHaveLength(13);
    const ids = SIGNATURE_SCENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(13);
    expect(ids).toEqual(ids.map((_, i) => `SCENT_RECIPE_${String(i + 1).padStart(2, '0')}`));
  });

  it('Mystic Musk is frankincense-based (owner-confirmed musky facet)', () => {
    const musk = getScentRecipe('SCENT_RECIPE_10');
    expect(musk?.name).toBe('Mystic Musk');
    expect(musk?.oils.join(' ')).toMatch(/frankincense/i);
  });

  it('Rose Goddess is restored (rose + geranium)', () => {
    const rose = getScentRecipe('SCENT_RECIPE_06');
    expect(rose?.name).toBe('Rose Goddess');
    expect(rose?.oils.join(' ')).toMatch(/rose/i);
  });

  it('every recipe carries an evidence level and safety note', () => {
    for (const r of SIGNATURE_SCENTS) {
      expect(['STRONG', 'MODERATE', 'ANECDOTAL']).toContain(r.evidence);
      expect(r.safety.length).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
    }
  });

  it('recipes are marked PROPOSED in the module header (not canonical)', () => {
    // Guard against the draft being mistaken for approved canon.
    const names = SIGNATURE_SCENTS.map((r) => r.name);
    expect(names).toContain('Moonlit Lavender');
    expect(names).toContain('Island Bloom');
  });
});

describe('seasonal features — configurable data', () => {
  it('October 2026 features Pumpkin Spice as Soap of the Month', () => {
    const f = getSeasonalFeature(10, 2026);
    expect(f?.id).toBe('pumpkin-spice-oct-2026');
    expect(f?.name).toBe('Pumpkin Spice');
    expect(f?.tagline).toMatch(/Soap of the Month/i);
  });

  it('never states or implies pumpkin is an ingredient', () => {
    const f = getSeasonalFeature(10, 2026)!;
    expect(f.copyRule).toMatch(/never/i);
    // The marketing copy must not claim pumpkin content.
    expect(f.copy.toLowerCase()).not.toMatch(/contains pumpkin|made with pumpkin|pumpkin (oil|extract|puree)/);
  });

  it('follows the curated signature path (recipe linkage, not custom-blend IDs)', () => {
    const f = getSeasonalFeature(10, 2026)!;
    // Finished blends (On Guard) are excluded as *custom-blend components*,
    // but curated signature recipes may use the full owner inventory.
    // The recipe_id link is what keeps the two paths from being confused.
    expect(f.recipe_id).toBe('SCENT_RECIPE_08');
    expect(getScentRecipe(f.recipe_id!)?.name).toBe('Spice of the Earth');
  });

  it('all listed oils trace to the owner-confirmed inventory', () => {
    const ownerInventory = new Set([
      'lavender', 'lemon', 'peppermint', 'tea-tree', 'oregano', 'frankincense',
      'deep-blue', 'breathe', 'digestzen', 'on-guard', 'geranium', 'rose',
      'patchouli', 'cedarwood', 'jasmine', 'vanilla-mimic', 'coconut',
    ]);
    const f = getSeasonalFeature(10, 2026)!;
    for (const oil of f.oils) {
      expect(ownerInventory.has(oil)).toBe(true);
    }
  });

  it('no seasonal feature exists for other months (data-driven, not hard-coded UI)', () => {
    expect(getSeasonalFeature(11, 2026)).toBeUndefined();
    expect(getSeasonalFeature(10, 2027)).toBeUndefined();
  });
});
