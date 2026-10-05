/**
 * Seasonal features as CONFIGURABLE DATA — never hard-coded into components.
 * Change the featured scent by editing this array, not the UI.
 */
import type { SeasonalFeature } from '../../types';

export const SEASONAL_SCENTS: readonly SeasonalFeature[] = [
  {
    id: 'pumpkin-spice-oct-2026',
    month: 10,
    year: 2026,
    name: 'Pumpkin Spice',
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

/** Resolve the featured seasonal scent for a given month/year. */
export function getSeasonalFeature(month: number, year: number): SeasonalFeature | undefined {
  return SEASONAL_SCENTS.find((s) => s.month === month && s.year === year);
}
