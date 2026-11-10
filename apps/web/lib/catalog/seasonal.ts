/**
 * Seasonal features as CONFIGURABLE DATA — never hard-coded into components.
 * Change the featured scent by editing this array, not the UI.
 */
import type { SeasonalFeature } from '../../types';

/**
 * Seasonal features as data — CONFIRMED entries are owner-approved and
 * servable; getSeasonalFeature() filters on status, so the SUPERSEDED
 * record retained in this array is never served. October 2026 = Pumpkin
 * Spice (owner-verified). December 2026 = Alpine Frost was confirmed on
 * 2026-10-15 by the owner's approval of the Fall 2026 soap collection
 * proposal (SCENT_RECIPE_04).
 * November 2026 history: Cedar & Hearth (SCENT_RECIPE_11), confirmed
 * 2026-10-15, is November's live feature until this stage ships. On
 * 2026-11-09 the owner superseded it with Pecan Pie — binding to
 * SCENT_RECIPE_05 approved the same day — as a standalone mid-month
 * stage. The Cedar & Hearth record is retained below with status
 * 'superseded': the month's history stays truthful, and nothing
 * back-dates Pecan Pie.
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
    /**
     * SUPERSEDED RECORD — retained for history, never served.
     * Cedar & Hearth was November 2026's confirmed feature from
     * 2026-10-15 until the owner's 2026-11-09 supersession (below).
     * The record is preserved verbatim apart from its status; the
     * recipe itself (SCENT_RECIPE_11 "Cedar Hollow") remains in the
     * signature-scent catalog untouched.
     */
    id: 'cedar-hearth-nov-2026',
    month: 11,
    year: 2026,
    name: 'Cedar & Hearth',
    status: 'superseded',
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
    id: 'pecan-pie-nov-2026',
    month: 11,
    year: 2026,
    name: 'Pecan Pie',
    status: 'confirmed',
    tagline: 'November Soap of the Month',
    /**
     * Curated signature path: this theme follows SCENT_RECIPE_05
     * ("Sweet Serenity" — jasmine measured + vanilla-mimic warmth, best
     * base Goat Milk + Shea Butter), the only recipe in a creamy, warm,
     * sweet register. Theme binding approved by the owner 2026-11-09.
     * The theme is the story; the scent is the recipe's own truth — an
     * exotic soft floral with creamy warmth, not a nut or baked-goods
     * scent. Oils and palette below are the recipe's own fields.
     */
    recipe_id: 'SCENT_RECIPE_05',
    /**
     * Feature image: the owner's own photograph of the actual bar
     * (supplied 2026-11-09; confirmed by her the same day as a real
     * photo of her soap), registered in lib/media/image-manifest.ts
     * under this slot id as REAL_PRODUCT_PHOTO. Per the owner's
     * standing rule, a feature uses an image we already have; a
     * generated image is made only when nothing existing matches
     * close enough.
     */
    image_slot_id: 'slot_seasonal_pecan_pie_nov_2026',
    oils: ['Jasmine (measured)', 'vanilla-mimic (warmth)'],
    palette: ['Rose / Pink', 'Amber / Gold'],
    copy: 'Soft blossoms and golden warmth — jasmine over creamy vanilla in a rich goat milk and shea bar. A cozy late-autumn theme, named for the pie on the holiday table.',
    copyRule:
      'Scent-theme naming only — NEVER state or imply pecan, butter, or brown sugar is an ingredient. None is in the formula.',
    safetyNote: 'Jasmine is potent — measured dose (per SCENT_RECIPE_05).',
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
 * Only confirmed entries are served — proposed entries are planning
 * data, and superseded records are retained history; neither is ever
 * returned. This status filter is what keeps a month with both a
 * superseded record and a confirmed successor (November 2026)
 * unambiguous: exactly the confirmed entry can match.
 */
export function getSeasonalFeature(month: number, year: number): SeasonalFeature | undefined {
  return SEASONAL_SCENTS.find(
    (s) => s.month === month && s.year === year && (s.status ?? 'confirmed') === 'confirmed',
  );
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
