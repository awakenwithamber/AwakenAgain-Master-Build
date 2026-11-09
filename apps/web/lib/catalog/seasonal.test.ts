/**
 * Tests — seasonal data.
 * Laws: getSeasonalFeature() serves CONFIRMED entries only; proposed
 * entries are never served, always carry status 'proposed' + a pending
 * copyRule, and reference real recipe IDs from lib/catalog/scents.ts.
 * Superseded records (November 2026's Cedar & Hearth) are retained in
 * SEASONAL_SCENTS for history and are never served. Dec 2026 was
 * confirmed by the owner on 2026-10-15 (Fall 2026 collection approval);
 * Nov 2026's Cedar & Hearth (confirmed the same day) was superseded by
 * Pecan Pie on 2026-11-09, binding approved the same day; Jan 2027
 * remains proposed.
 */
import { describe, expect, it } from 'vitest';
import {
  FALL_ALCHEMY_COLLECTION_GUIDE,
  SEASONAL_SCENTS,
  PROPOSED_SEASONAL_FEATURES,
  getProposedSeasonalFeature,
  getSeasonalFeature,
} from './seasonal';
import { SIGNATURE_SCENTS } from './scents';
import { SOAP_SHAPES } from './shapes';
import { getProductByHandle } from './products';
import { isSupersededProduct } from './status';

const RECIPE_IDS = new Set(SIGNATURE_SCENTS.map((r) => r.id));

describe('confirmed seasonal features', () => {
  it('October 2026 resolves to Pumpkin Spice (owner-verified)', () => {
    const f = getSeasonalFeature(10, 2026);
    expect(f?.name).toBe('Pumpkin Spice');
    expect(f?.recipe_id).toBe('SCENT_RECIPE_08');
    expect(f?.status ?? 'confirmed').toBe('confirmed');
  });

  it('November 2026 resolves to Pecan Pie (owner-approved binding 2026-11-09)', () => {
    const f = getSeasonalFeature(11, 2026);
    expect(f?.id).toBe('pecan-pie-nov-2026');
    expect(f?.name).toBe('Pecan Pie');
    expect(f?.recipe_id).toBe('SCENT_RECIPE_05');
    expect(f?.status).toBe('confirmed');
    expect(f?.tagline).toBe('November Soap of the Month');
    expect(f?.copyRule).not.toMatch(/proposed/i);
    expect(f?.availability).not.toMatch(/proposed|pending/i);
  });

  it('Pecan Pie never states or implies pecan, butter, or brown sugar is an ingredient', () => {
    const f = getSeasonalFeature(11, 2026)!;
    // The honesty rule itself names the three theme foods as non-ingredients.
    expect(f.copyRule).toMatch(/never/i);
    expect(f.copyRule).toMatch(/pecan, butter, or brown sugar is an ingredient/i);
    // No customer-facing field may present a theme food as contents.
    const claims =
      /(contains|made with|infused with|real)\s+(pecan|butter|brown sugar)|(pecan|butter|brown sugar)\s+(oil|extract|puree|infused)/i;
    expect(f.copy).not.toMatch(claims);
    expect(f.tagline).not.toMatch(claims);
    expect(f.availability ?? '').not.toMatch(claims);
    // The scent description stays the recipe's truth: floral + vanilla warmth.
    expect(f.copy.toLowerCase()).toMatch(/jasmine/);
    expect(f.copy.toLowerCase()).toMatch(/vanilla/);
  });

  it('Pecan Pie entry derives from SCENT_RECIPE_05 fields (no invented content)', () => {
    const f = getSeasonalFeature(11, 2026)!;
    const recipe = SIGNATURE_SCENTS.find((r) => r.id === 'SCENT_RECIPE_05')!;
    expect(recipe.name).toBe('Sweet Serenity');
    expect(f.oils).toEqual(recipe.oils);
    expect(f.palette).toEqual(recipe.palette);
  });

  it('Cedar & Hearth is retained as a superseded record — present, never served', () => {
    const record = SEASONAL_SCENTS.find((s) => s.id === 'cedar-hearth-nov-2026');
    expect(record).toBeDefined();
    expect(record?.status).toBe('superseded');
    expect(record?.name).toBe('Cedar & Hearth');
    expect(record?.recipe_id).toBe('SCENT_RECIPE_11');
    expect(getSeasonalFeature(11, 2026)?.id).not.toBe('cedar-hearth-nov-2026');
  });

  it('exactly one servable (confirmed) entry exists for each confirmed month', () => {
    for (const [month, year] of [
      [10, 2026],
      [11, 2026],
      [12, 2026],
    ] as const) {
      const servable = SEASONAL_SCENTS.filter(
        (s) => s.month === month && s.year === year && (s.status ?? 'confirmed') === 'confirmed',
      );
      expect(servable).toHaveLength(1);
    }
  });

  it('December 2026 resolves to Alpine Frost (owner-confirmed 2026-10-15)', () => {
    const f = getSeasonalFeature(12, 2026);
    expect(f?.id).toBe('alpine-frost-dec-2026');
    expect(f?.name).toBe('Alpine Frost');
    expect(f?.recipe_id).toBe('SCENT_RECIPE_04');
    expect(f?.status).toBe('confirmed');
    expect(f?.tagline).toBe('December Soap of the Month');
    expect(f?.copyRule).not.toMatch(/proposed/i);
    expect(f?.availability).not.toMatch(/proposed|pending/i);
  });

  it('months with no confirmed feature resolve to undefined', () => {
    expect(getSeasonalFeature(1, 2027)).toBeUndefined();
    expect(getSeasonalFeature(10, 2027)).toBeUndefined();
  });

  it('every SEASONAL_SCENTS entry is confirmed or a retained superseded record (never proposed)', () => {
    for (const s of SEASONAL_SCENTS) {
      expect(['confirmed', 'superseded']).toContain(s.status ?? 'confirmed');
    }
  });

  it('entry recipe_ids reference real catalog recipes (no invented themes)', () => {
    for (const s of SEASONAL_SCENTS) {
      expect(s.recipe_id).toBeDefined();
      expect(RECIPE_IDS.has(s.recipe_id as string)).toBe(true);
    }
  });
});

describe('Fall 2026 Alchemy Collection slot guide (owner-approved 2026-10-15)', () => {
  const guide = FALL_ALCHEMY_COLLECTION_GUIDE;

  it('targets the existing Alchemy Soap Collection record', () => {
    expect(guide.collection_handle).toBe('soap-style-collection-5');
    expect(getProductByHandle(guide.collection_handle)).toBeDefined();
    expect(guide.season).toBe('Fall 2026');
  });

  it('carries the approved guide copy verbatim', () => {
    expect(guide.copy).toBe(
      'For fall, start with our suggested hearth-and-harvest guide — spice, forest, rose, and one bright citrus note — or make every slot entirely your own.',
    );
  });

  it('guides all five slots, in canonical shape order', () => {
    expect(guide.slots).toHaveLength(5);
    expect(guide.slots.map((s) => s.shape_id)).toEqual(SOAP_SHAPES.map((s) => s.id));
    for (const slot of guide.slots) {
      const shape = SOAP_SHAPES.find((s) => s.id === slot.shape_id);
      expect(shape).toBeDefined();
      expect(slot.shape).toBe(shape!.name);
      expect(slot.size).toBe(`${shape!.weightOz} oz`);
    }
  });

  it('profile slots name real, current catalog soaps (nothing invented, nothing superseded)', () => {
    const byShape = new Map(guide.slots.map((s) => [s.shape_id, s]));
    expect(byShape.get('small-rose')?.profile_handle).toBe('gaias-rose-soap');
    expect(byShape.get('medium-rose')?.profile_handle).toBe('warm-cinnamon-comfort-soap');
    expect(byShape.get('plain-rectangle')?.profile_handle).toBe('sacred-forest-ritual-soap');
    expect(byShape.get('floral-round')?.profile_handle).toBe('citrus-goddess-glow-soap');
    for (const slot of guide.slots) {
      if (slot.profile_handle) {
        const product = getProductByHandle(slot.profile_handle);
        expect(product).toBeDefined();
        expect(isSupersededProduct(product!)).toBe(false);
      }
    }
  });

  it('the Large Wave Rectangle slot follows the confirmed Pumpkin Spice theme', () => {
    const slot = guide.slots.find((s) => s.shape_id === 'wave-rectangle');
    expect(slot?.seasonal_feature_id).toBe('pumpkin-spice-oct-2026');
    expect(slot?.profile_handle).toBeUndefined();
    const feature = SEASONAL_SCENTS.find((s) => s.id === slot!.seasonal_feature_id);
    expect(feature?.name).toBe('Pumpkin Spice');
    expect(feature?.recipe_id).toBe('SCENT_RECIPE_08');
  });
});

describe('proposed seasonal features (Jan 2027)', () => {
  it('resolves Jan via the planning lookup only', () => {
    expect(getProposedSeasonalFeature(1, 2027)?.id).toBe('sacred-stillness-jan-2027');
  });

  it('Nov/Dec 2026 are no longer proposed (confirmed 2026-10-15)', () => {
    expect(getProposedSeasonalFeature(11, 2026)).toBeUndefined();
    expect(getProposedSeasonalFeature(12, 2026)).toBeUndefined();
  });

  it('are never served by the customer-facing lookup', () => {
    for (const s of PROPOSED_SEASONAL_FEATURES) {
      expect(getSeasonalFeature(s.month, s.year)).toBeUndefined();
    }
  });

  it('all carry status proposed + pending copyRule + pending availability', () => {
    expect(PROPOSED_SEASONAL_FEATURES.length).toBe(1);
    for (const s of PROPOSED_SEASONAL_FEATURES) {
      expect(s.status).toBe('proposed');
      expect(s.copyRule).toMatch(/PROPOSED/i);
      expect(s.availability).toMatch(/pending owner confirmation/i);
    }
  });

  it('recipe_ids reference real catalog recipes (no invented themes)', () => {
    for (const s of PROPOSED_SEASONAL_FEATURES) {
      expect(s.recipe_id).toBeDefined();
      expect(RECIPE_IDS.has(s.recipe_id as string)).toBe(true);
    }
  });

  it('copy never invents products or prices', () => {
    for (const s of PROPOSED_SEASONAL_FEATURES) {
      expect(s.copy).not.toMatch(/\$\d/);
    }
  });
});
