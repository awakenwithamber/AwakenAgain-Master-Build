/**
 * Seasonal features as CONFIGURABLE DATA — never hard-coded into components.
 * Change the featured scent by editing this array, not the UI.
 */
import type { SeasonalFeature } from '../../types';

/**
 * CONFIRMED seasonal features only — owner-approved entries that the
 * SeasonalBanner may serve. October 2026 = Pumpkin Spice (owner-verified).
 */
export const SEASONAL_SCENTS: readonly SeasonalFeature[] = [
  {
    id: 'pumpkin-spice-oct-2026',
    month: 10,
    year: 2026,
    name: 'Pumpkin Spice',
    status: 'confirmed',
    tagline: 'October Soap of the Month',
    /**
     * Curated signature path: this theme follows SCENT_RECIPE_08
     * ("Spice of the Earth" — doTERRA On Guard backbone), per the recipe's
     * own evidence note ("Backbone of the October Pumpkin Spice soap").
     * Curated recipes may use the owner's full inventory including finished
     * blends; the customer custom-blend path (12 blendable oils only) is
     * separate and must never inherit this.
     */
    recipe_id: 'SCENT_RECIPE_08',
    oils: ['on-guard', 'lemon', 'vanilla-mimic'],
    palette: ['Amber / Gold', 'Orange', 'Copper tones'],
    copy: 'Warm. Cozy. Enchanting. A seasonal favorite inspired by pumpkin pie spice — cinnamon, clove, sweet orange, and vanilla warmth in a rich autumn bar.',
    copyRule:
      'Scent-theme naming only — NEVER state or imply pumpkin is an ingredient. It is not in the formula.',
    safetyNote: 'Clove/cinnamon are dermal sensitizers — kept proportioned; sensitive-skin patch-test note.',
    availability: 'Seasonal limited run — small batch.',
  },
];

/**
 * PROPOSED seasonal features (Nov 2026 → Jan 2027) — planning data, NOT
 * served to customers. Every entry:
 * - references a REAL recipe id from lib/catalog/scents.ts (recipes are
 *   themselves PROPOSED, pending owner approval — the chain of approval is
 *   explicit, not hidden),
 * - carries status: 'proposed' and an availability line stating the
 *   pending-confirmation state,
 * - invents no products, no prices, no availability claims.
 *
 * getSeasonalFeature() NEVER returns these; getProposedSeasonalFeature()
 * exists for planning/preview surfaces only.
 */
export const PROPOSED_SEASONAL_FEATURES: readonly SeasonalFeature[] = [
  {
    id: 'cedar-hearth-nov-2026',
    month: 11,
    year: 2026,
    name: 'Cedar & Hearth',
    status: 'proposed',
    tagline: 'November Soap of the Month (proposed)',
    recipe_id: 'SCENT_RECIPE_11',
    oils: ['Cedarwood', 'Frankincense'],
    palette: ['Amber / Gold'],
    copy: 'Dry warm wood wrapped in sacred resin — a cabin-in-the-pines bar for the turn toward winter.',
    copyRule:
      'PROPOSED — pending owner confirmation of the November theme and of SCENT_RECIPE_11 itself. Theme naming only.',
    safetyNote: 'No major flags per recipe (SCENT_RECIPE_11).',
    availability: 'Proposed — pending owner confirmation.',
  },
  {
    id: 'alpine-frost-dec-2026',
    month: 12,
    year: 2026,
    name: 'Alpine Frost',
    status: 'proposed',
    tagline: 'December Soap of the Month (proposed)',
    recipe_id: 'SCENT_RECIPE_04',
    oils: ['doTERRA Deep Blue (wintergreen, camphor, peppermint)'],
    palette: ['Teal', 'Blue'],
    copy: 'A cooling mint-wintergreen rush — cold mountain air in a winter bar.',
    copyRule:
      'PROPOSED — pending owner confirmation of the December theme and of SCENT_RECIPE_04 itself. Theme naming only.',
    safetyNote: 'Cooling oils — moderate dose; not for young children (per SCENT_RECIPE_04).',
    availability: 'Proposed — pending owner confirmation.',
  },
  {
    id: 'sacred-stillness-jan-2027',
    month: 1,
    year: 2027,
    name: 'Sacred Stillness',
    status: 'proposed',
    tagline: 'January Soap of the Month (proposed)',
    recipe_id: 'SCENT_RECIPE_07',
    oils: ['Frankincense', 'Lavender'],
    palette: ['Amber / Gold', 'Lavender'],
    copy: 'Resinous warmth wrapped in floral calm — a grounding bar for the new year.',
    copyRule:
      'PROPOSED — pending owner confirmation of the January theme and of SCENT_RECIPE_07 itself. Theme naming only.',
    safetyNote: 'No major flags per recipe (SCENT_RECIPE_07).',
    availability: 'Proposed — pending owner confirmation.',
  },
];

/**
 * Resolve the CONFIRMED featured seasonal scent for a given month/year.
 * Proposed entries are never served — this is the customer-facing lookup.
 */
export function getSeasonalFeature(month: number, year: number): SeasonalFeature | undefined {
  return SEASONAL_SCENTS.find((s) => s.month === month && s.year === year);
}

/**
 * Planning-only lookup for proposed seasonal features. Not for
 * customer-facing surfaces.
 */
export function getProposedSeasonalFeature(
  month: number,
  year: number,
): SeasonalFeature | undefined {
  return PROPOSED_SEASONAL_FEATURES.find((s) => s.month === month && s.year === year);
}
