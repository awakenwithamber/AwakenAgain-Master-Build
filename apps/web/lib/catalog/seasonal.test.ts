/**
 * Tests — seasonal data (Nov+ extension).
 * Laws: getSeasonalFeature() serves CONFIRMED entries only; proposed
 * entries are never served, always carry status 'proposed' + a pending
 * copyRule, and reference real recipe IDs from lib/catalog/scents.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  SEASONAL_SCENTS,
  PROPOSED_SEASONAL_FEATURES,
  getProposedSeasonalFeature,
  getSeasonalFeature,
} from './seasonal';
import { SIGNATURE_SCENTS } from './scents';

const RECIPE_IDS = new Set(SIGNATURE_SCENTS.map((r) => r.id));

describe('confirmed seasonal features', () => {
  it('October 2026 resolves to Pumpkin Spice (owner-verified)', () => {
    const f = getSeasonalFeature(10, 2026);
    expect(f?.name).toBe('Pumpkin Spice');
    expect(f?.recipe_id).toBe('SCENT_RECIPE_08');
    expect(f?.status ?? 'confirmed').toBe('confirmed');
  });

  it('months with no confirmed feature resolve to undefined', () => {
    expect(getSeasonalFeature(11, 2026)).toBeUndefined();
    expect(getSeasonalFeature(12, 2026)).toBeUndefined();
    expect(getSeasonalFeature(1, 2027)).toBeUndefined();
  });

  it('every confirmed entry is confirmed (never proposed)', () => {
    for (const s of SEASONAL_SCENTS) {
      expect(s.status ?? 'confirmed').toBe('confirmed');
    }
  });
});

describe('proposed seasonal features (Nov 2026 – Jan 2027)', () => {
  it('resolves Nov/Dec/Jan via the planning lookup only', () => {
    expect(getProposedSeasonalFeature(11, 2026)?.id).toBe('cedar-hearth-nov-2026');
    expect(getProposedSeasonalFeature(12, 2026)?.id).toBe('alpine-frost-dec-2026');
    expect(getProposedSeasonalFeature(1, 2027)?.id).toBe('sacred-stillness-jan-2027');
  });

  it('are never served by the customer-facing lookup', () => {
    for (const s of PROPOSED_SEASONAL_FEATURES) {
      expect(getSeasonalFeature(s.month, s.year)).toBeUndefined();
    }
  });

  it('all carry status proposed + pending copyRule + pending availability', () => {
    expect(PROPOSED_SEASONAL_FEATURES.length).toBe(3);
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
