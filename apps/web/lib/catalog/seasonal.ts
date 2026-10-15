/**
 * Seasonal features as CONFIGURABLE DATA — never hard-coded into components.
 * Change the featured scent by editing this array, not the UI.
 */
import type { SeasonalFeature } from '../../types';

/**
 * CONFIRMED seasonal features only — owner-approved entries that the
 * SeasonalBanner may serve. October 2026 = Pumpkin Spice (owner-verified).
 * November 2026 = Cedar & Hearth and December 2026 = Alpine Frost were
 * confirmed on 2026-10-15 by the owner's approval of the Fall 2026 soap
 * collection proposal — that approval carried their signature recipes
 * (SCENT_RECIPE_11 and SCENT_RECIPE_04) with them.
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
  {
    id: 'cedar-hearth-nov-2026',
    month: 11,
    year: 2026,
    name: 'Cedar & Hearth',
    status: 'confirmed',
    tagline: 'November Soap of the Month',
    recipe_id: 'SCENT_RECIPE_11',
    oils: ['Cedarwood', 'Frankincense'],
    palette: ['Amber / Gold'],
    copy: 'Dry warm wood wrapped in sacred resin — a cabin-in-the-pines bar for the turn toward winter.',
    copyRule: 'Theme naming only.',
    safetyNote: 'No major flags per recipe (SCENT_RECIPE_11).',
    availability: 'Seasonal limited run — small batch.',
  },
  {
    id: 'alpine-frost-dec-2026',
    month: 12,
    year: 2026,
    name: 'Alpine Frost',
    status: 'confirmed',
    tagline: 'December Soap of the Month',
    recipe_id: 'SCENT_RECIPE_04',
    oils: ['doTERRA Deep Blue (wintergreen, camphor, peppermint)'],
    palette: ['Teal', 'Blue'],
    copy: 'A cooling mint-wintergreen rush — cold mountain air in a winter bar.',
    copyRule: 'Theme naming only.',
    safetyNote: 'Cooling oils — moderate dose; not for young children (per SCENT_RECIPE_04).',
    availability: 'Seasonal limited run — small batch.',
  },
];

/**
 * Fall 2026 slot guide for The Alchemy Soap Collection — owner-approved
 * 2026-10-15 (Fall 2026 soap collection proposal §3). DATA only: a
 * suggested fall theme for each of the collection's five slots, drawn
 * entirely from existing catalog soap profiles plus the confirmed
 * October Pumpkin Spice theme. The collection itself (price, slots,
 * customization) is unchanged — this guide invents no products, prices,
 * or combinations; customers may still make every slot their own.
 */
export interface FallCollectionSlotGuide {
  /** SOAP_SHAPES id of the collection slot. */
  shape_id: string;
  shape: string;
  size: string;
  /** Suggested fall theme for the slot, in the proposal's words. */
  theme: string;
  /** Catalog handle of the soap whose profile the slot follows. */
  profile_handle?: string;
  /** SEASONAL_SCENTS id when the slot follows a Soap of the Month theme. */
  seasonal_feature_id?: string;
}

export const FALL_ALCHEMY_COLLECTION_GUIDE: {
  collection_handle: string;
  season: string;
  copy: string;
  slots: readonly FallCollectionSlotGuide[];
} = {
  collection_handle: 'soap-style-collection-5',
  season: 'Fall 2026',
  copy: 'For fall, start with our suggested hearth-and-harvest guide — spice, forest, rose, and one bright citrus note — or make every slot entirely your own.',
  slots: [
    {
      shape_id: 'small-rose',
      shape: 'Small Rose',
      size: '2 oz',
      theme: "Gaia's Rose profile — rose and hibiscus",
      profile_handle: 'gaias-rose-soap',
    },
    {
      shape_id: 'medium-rose',
      shape: 'Medium Rose',
      size: '3 oz',
      theme: 'Warm Cinnamon Comfort profile — cinnamon and clove',
      profile_handle: 'warm-cinnamon-comfort-soap',
    },
    {
      shape_id: 'plain-rectangle',
      shape: 'Large Plain Rectangle',
      size: '4 oz',
      theme: 'Sacred Forest Ritual profile — rosemary, forest botanicals',
      profile_handle: 'sacred-forest-ritual-soap',
    },
    {
      shape_id: 'wave-rectangle',
      shape: 'Large Wave Rectangle',
      size: '4.5 oz',
      theme: 'Pumpkin Spice theme',
      seasonal_feature_id: 'pumpkin-spice-oct-2026',
    },
    {
      shape_id: 'floral-round',
      shape: 'Large Floral Round',
      size: '4.5 oz',
      theme: 'Citrus Goddess Glow profile — lemon peel and citrus botanicals, the bright note',
      profile_handle: 'citrus-goddess-glow-soap',
    },
  ],
};

/**
 * PROPOSED seasonal features (Jan 2027) — planning data, NOT served to
 * customers. (Nov/Dec 2026 stood here until the owner confirmed them on
 * 2026-10-15; they now live in SEASONAL_SCENTS above.) The remaining
 * entry:
 * - references a REAL recipe id from lib/catalog/scents.ts (recipes are
 *   themselves PROPOSED, pending owner approval — the chain of approval
 *   is explicit, not hidden),
 * - carries status: 'proposed' and an availability line stating the
 *   pending-confirmation state,
 * - invents no products, no prices, no availability claims.
 *
 * getSeasonalFeature() NEVER returns these; getProposedSeasonalFeature()
 * exists for planning/preview surfaces only.
 */
export const PROPOSED_SEASONAL_FEATURES: readonly SeasonalFeature[] = [
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
