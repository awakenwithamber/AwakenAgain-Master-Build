/**
 * Custom Balm Builder data — grounded, additive, no invented content.
 *
 * Owner approval 2026-10-30: a Custom Balm Builder where the customer
 * chooses (1) a balm base — Soy Wax (standard) / Beeswax (soy-free
 * alternative) at IDENTICAL prices; (2) botanical ingredients; (3) an
 * intended purpose in preference/ritual language only; (4) a scent
 * preference; (5) a size.
 *
 * GROUNDING RULES (binding):
 * - Botanicals: ONLY the featured_ingredients of the three existing
 *   balm/serum catalog records that also exist in the herb library
 *   (lib/catalog/herbs.ts). The provenance of every entry is named in
 *   BALM_BOTANICAL_SOURCES below. Nothing is invented: "Vitamin E" and
 *   "Castor Oil" are included because they are featured ingredients of
 *   a source record AND herb-library entries (ids 'vitamin-e' /
 *   'castor-oil').
 * - Allergen wording mirrors the two balm records' own warnings /
 *   allergens text (soy wax = soy; beeswax = a bee product; the balm
 *   records also state both versions contain coconut oil — the slow
 *   infusion base in their page_banner / complete_ingredients).
 * - Purpose options are preference/ritual language ONLY (site copy
 *   rule, strengthened 2026-10-27): nothing here presents a product as
 *   a remedy or treatment, and no efficacy claim is made.
 * - Scent preferences reference the existing signature scent recipes
 *   (lib/catalog/scents.ts) by ID — plus an unscented option — exactly
 *   the way soap scent selections persist a recipe ID, never prose.
 * - Prices live in lib/pricing/pricing.ts (CUSTOM_BALM_SIZES), mirrored
 *   from the balm records' variant prices. The wax/base choice is
 *   never priced: both bases carry a $0 add-on by owner ruling.
 */
import { getHerb } from '../catalog/herbs';
import type { Herb } from '../../types';
import { getScentRecipe } from '../catalog/scents';
import { RECORD as RADIANCE_BALM } from '../catalog/products/rec-radiance-renewal-balm';
import { RECORD as SOOTHE_BALM } from '../catalog/products/rec-soothe-restore-botanical-balm';
import { RECORD as SCALP_SERUM } from '../catalog/products/rec-root-scalp-revival-serum';

/* ------------------------------------------------------------------ */
/* Balm bases (wax choice) — price-neutral by owner ruling 2026-10-30  */
/* ------------------------------------------------------------------ */

export type BalmBaseId = 'soy-wax' | 'beeswax';

export interface BalmBase {
  id: BalmBaseId;
  name: string;
  /** Short customer-facing descriptor (preference language only). */
  description: string;
  /**
   * Allergen disclosure surfaced the moment this base is chosen.
   * Mirrors the balm records' warnings/allergens wording.
   */
  allergenNote: string;
  /** Price effect of the base choice — always 0 (owner ruling). */
  priceDeltaCents: 0;
}

export const BALM_BASES: readonly BalmBase[] = [
  {
    id: 'soy-wax',
    name: 'Soy Wax (standard)',
    description:
      'The standard finish — soy wax blended in for a smooth, balanced texture.',
    allergenNote:
      'Contains soy wax (soy). Individuals with soy sensitivities should choose the beeswax finish instead and patch test. Both finishes also contain coconut oil.',
    priceDeltaCents: 0,
  },
  {
    id: 'beeswax',
    name: 'Beeswax (soy-free alternative)',
    description:
      'The soy-free alternative finish — beeswax replaces the soy wax.',
    allergenNote:
      'Contains beeswax (a bee product) instead of soy. Individuals with bee-product sensitivities should choose the standard soy-wax finish instead and patch test. Both finishes also contain coconut oil.',
    priceDeltaCents: 0,
  },
];

export function getBalmBase(id: string): BalmBase | undefined {
  return BALM_BASES.find((b) => b.id === id);
}

/** Allergen disclosure for a base choice; null for an unknown base. */
export function balmAllergenNote(baseId: string): string | null {
  return getBalmBase(baseId)?.allergenNote ?? null;
}

/* ------------------------------------------------------------------ */
/* Botanicals — grounded in the balm/serum records + the herb library  */
/* ------------------------------------------------------------------ */

/**
 * Provenance per selectable botanical: the featured_ingredients name on
 * the source record(s). A botanical is selectable ONLY when its name
 * appears in a source record's featured_ingredients AND the herb id
 * resolves in the herb library — the groundedness test enforces both
 * directions against the live records, so this list cannot drift.
 */
export const BALM_BOTANICAL_SOURCES: Readonly<
  Record<string, { featuredName: string; sourceHandles: readonly string[] }>
> = {
  rose: {
    featuredName: 'Rose',
    sourceHandles: ['radiance-renewal-balm'],
  },
  lavender: {
    featuredName: 'Lavender',
    sourceHandles: ['radiance-renewal-balm'],
  },
  calendula: {
    featuredName: 'Calendula',
    sourceHandles: ['radiance-renewal-balm'],
  },
  'gotu-kola': {
    featuredName: 'Gotu Kola',
    sourceHandles: ['radiance-renewal-balm'],
  },
  'vitamin-e': {
    featuredName: 'Vitamin E',
    sourceHandles: ['radiance-renewal-balm'],
  },
  arnica: {
    featuredName: 'Arnica',
    sourceHandles: ['soothe-restore-botanical-balm'],
  },
  cayenne: {
    featuredName: 'Cayenne',
    sourceHandles: ['soothe-restore-botanical-balm'],
  },
  ginger: {
    featuredName: 'Ginger',
    sourceHandles: ['soothe-restore-botanical-balm'],
  },
  peppermint: {
    featuredName: 'Peppermint',
    sourceHandles: ['soothe-restore-botanical-balm', 'root-scalp-revival-serum'],
  },
  comfrey: {
    featuredName: 'Comfrey',
    sourceHandles: ['soothe-restore-botanical-balm'],
  },
  rosemary: {
    featuredName: 'Rosemary',
    sourceHandles: ['root-scalp-revival-serum'],
  },
  nettle: {
    featuredName: 'Nettle',
    sourceHandles: ['root-scalp-revival-serum'],
  },
  fenugreek: {
    featuredName: 'Fenugreek',
    sourceHandles: ['root-scalp-revival-serum'],
  },
  'castor-oil': {
    featuredName: 'Castor Oil',
    sourceHandles: ['root-scalp-revival-serum'],
  },
};

/** Selectable botanical herb IDs, in apothecary (source-record) order. */
export const BALM_BOTANICAL_IDS: readonly string[] = Object.keys(
  BALM_BOTANICAL_SOURCES,
);

export function isBalmBotanical(id: string): boolean {
  return BALM_BOTANICAL_IDS.includes(id);
}

/** The selectable botanicals as herb-library records (all must resolve). */
export function balmBotanicals(): Herb[] {
  return BALM_BOTANICAL_IDS.map((id) => getHerb(id)).filter(
    (h): h is Herb => h !== undefined,
  );
}

/**
 * Every featured-ingredient name across the three source records —
 * exported for the groundedness test, which asserts the selectable list
 * is exactly the featured names that also exist in the herb library.
 */
export const BALM_SOURCE_RECORDS = [RADIANCE_BALM, SOOTHE_BALM, SCALP_SERUM] as const;

/* ------------------------------------------------------------------ */
/* Intended purpose — preference / ritual language ONLY (copy rule)    */
/* ------------------------------------------------------------------ */

export interface BalmPurpose {
  id: string;
  label: string;
}

export const BALM_PURPOSES: readonly BalmPurpose[] = [
  { id: 'evening-unwind-ritual', label: 'An evening unwind ritual' },
  { id: 'morning-glow-ritual', label: 'A morning glow ritual' },
  { id: 'massage-ritual', label: 'A massage ritual after a long day' },
  { id: 'scalp-hair-ritual', label: 'A scalp & hair ritual' },
  { id: 'everyday-moisture-ritual', label: 'Everyday moisture & softness' },
  { id: 'gift-for-someone', label: 'A gift for someone I love' },
];

export function getBalmPurpose(id: string): BalmPurpose | undefined {
  return BALM_PURPOSES.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* Scent preference — signature recipe IDs from lib/catalog/scents.ts  */
/* ------------------------------------------------------------------ */

/** Stored value for "no added scent preference" (never a recipe ID). */
export const BALM_SCENT_UNSENTED = 'unscented';

export function isValidBalmScent(scentId: string): boolean {
  return scentId === BALM_SCENT_UNSENTED || getScentRecipe(scentId) !== undefined;
}

/* ------------------------------------------------------------------ */
/* Educational voice — the balm records' own page_banner copy          */
/* ------------------------------------------------------------------ */

/**
 * "How every balm begins" — the educational banner copy carried on both
 * balm records (rendered on their pages by the BalmBanner component in
 * components/shop/ProductJourney.tsx). Reused verbatim here so the
 * builder speaks in the same voice; never paraphrased or extended.
 */
export const BALM_BANNER_TEXT: string =
  (RADIANCE_BALM.page_banner as string | undefined) ?? '';

/** External-use / patch-test line mirrored from the balm records. */
export const BALM_EXTERNAL_USE_NOTE =
  'For external use only. Avoid contact with eyes, mucous membranes, open wounds, and sensitive areas. Patch test before use. Discontinue use if irritation occurs. This cosmetic/topical product is not intended to diagnose, treat, cure, or prevent any disease. Keep out of reach of children.';
