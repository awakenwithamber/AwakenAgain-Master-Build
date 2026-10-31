/**
 * Canonical shared types for Amber's Alchemy Apothecary.
 * Status vocabulary: CURRENT / SUPERSEDED / NEEDS_VERIFICATION / PROPOSED /
 * IMPLEMENTED / BROKEN / BLOCKED / MISSING_ASSET.
 * No `any` — open-ended record fields are typed as Record<string, unknown>.
 */

export type VerificationStatus =
  | 'CURRENT'
  | 'SUPERSEDED'
  | 'NEEDS_VERIFICATION'
  | 'PROPOSED'
  | 'IMPLEMENTED'
  | 'BROKEN'
  | 'BLOCKED'
  | 'MISSING_ASSET';

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export interface ProductVariant {
  /** Canonical soap variants always carry variant_id; legacy records may not. */
  variant_id?: string;
  size?: string;
  shape?: string;
  weight_oz?: number;
  price?: number | null;
  subscriber_price?: number | null;
  image_ids?: string[];
  availability?: string;
  sku?: string | null;
  name?: string;
  [key: string]: unknown;
}

export interface Product {
  handle: string;
  title: string;
  category: string;
  subcategory?: string | null;
  price?: number | null;
  subscriber_price?: number | null;
  compare_at_price?: number | null;
  variants?: ProductVariant[];
  sku?: string | null;
  formula_name?: string | null;
  short_description?: string | null;
  extended_description?: string | null;
  /** Heterogeneous in source JSON (string or {status, note}) — keep unknown. */
  field_verification?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  last_verified?: string | null;
  /**
   * Catalog lifecycle marker carried by the source record (vocabulary in
   * VerificationStatus above). 'SUPERSEDED' products stay in the catalog
   * for reference but must never be sold, sitemap-listed, or returned by
   * search — the single enforcement predicate is isSupersededProduct in
   * lib/catalog/status.ts. Absent/null = a current product.
   */
  verification_status?: string | null;
  /** Handle of the product that replaced this one, when superseded. */
  superseded_by?: string | null;
  /**
   * Owner-ruled fixed-formula marker (2026-10-30): the product is sold
   * exactly as pictured/made — no builder or customizer may add scents,
   * botanicals, or other options to it, even when its category would
   * normally route to a customizer. The single enforcement predicate is
   * isFixedFormulaProduct in lib/catalog/status.ts, consulted by the
   * product page's purchase section and by the server order gate
   * (isSoapProduct in lib/checkout/order.ts). Absent/false = a normal,
   * customizable-where-applicable product.
   */
  fixed_formula?: boolean | null;
  [key: string]: unknown;
}

/** Owner-confirmed soap shape — the price authority for the soap line. */
export interface SoapShape {
  id: string;
  name: string;
  weightOz: number;
  /** Integer cents. Server-authoritative; UI never invents prices. */
  priceCents: number;
  subscriberPriceCents: number;
}

export type SoapBaseId = 'double-layer' | 'goat-milk-shea' | 'glycerin-castor';

export interface SoapBase {
  id: SoapBaseId;
  name: string;
  description: string;
  /** True when the base is translucent (required for Natural/Clear color). */
  translucent: boolean;
}

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  /** When true, this color is only offered on translucent bases. */
  requiresTranslucentBase?: boolean;
}

export interface BotanicalOption {
  id: string;
  name: string;
  role: string;
}

/* ------------------------------------------------------------------ */
/* Herbs (custom formula builders)                                       */
/* ------------------------------------------------------------------ */

/** Formula forms a herb can be used in. Data-driven from the herb catalog. */
export type HerbUse = 'tea' | 'capsule' | 'balm' | 'serum';

export type HerbCategory =
  | 'sleep'
  | 'digestive'
  | 'spiritual'
  | 'pain'
  | 'energy'
  | 'adaptogen'
  | 'immune'
  | 'hormonal'
  | 'beauty'
  | 'mushroom'
  | 'detox'
  | 'stress'
  | 'focus'
  | 'cognitive'
  | 'mood'
  | 'emotional';

/** Reference kinds for Herb.references (Herbal Index Phase 1 plan §3.1). */
export type HerbReferenceKind =
  | 'monograph'
  | 'safety'
  | 'taxonomy'
  | 'evidence'
  | 'traditional';

/**
 * One sourced reference for a herb record (Herbal Index Phase 1).
 * Populated ONLY from the sourced overlay in lib/catalog/herb-references.ts
 * and rendered on herb detail pages as "References & further reading".
 * `url` is absent when no canonical URL could be verified; such entries
 * carry `unverified: true` and render with the honest marking
 * "unverified — search by title" instead of a link.
 */
export interface HerbReference {
  /** Which tier of the Phase 1 reference set this source belongs to. */
  kind: HerbReferenceKind;
  /** Short citation title (the link text when `url` is set). */
  label: string;
  /** Publisher / issuing body, plus what the source supports. */
  body: string;
  url?: string;
  unverified?: boolean;
}

/**
 * One botanical from the apothecary encyclopedia, as used by the custom
 * formula builders. Descriptions are framed as TRADITIONAL USE — not
 * medical advice. Per-herb add-on price in integer cents (PROPOSED).
 */
export interface Herb {
  id: string;
  name: string;
  latin: string;
  emoji: string;
  categories: HerbCategory[];
  uses: HerbUse[];
  /** Integer cents. Server-authoritative; UI never invents prices. */
  priceCents: number;
  traditionalNote: string;
  traditionalBenefits: string[];
  /**
   * Per-herb caution (Fix-All Stage 4, audit R-21) — OPTIONAL. Populated
   * ONLY where text already in this repo states a caution naming the
   * herb (see lib/catalog/herb-cautions.ts for the sourced values and
   * their provenance). Absent = no caution is rendered anywhere; a
   * missing caution is never filled in by invention.
   */
  caution?: string;
  /**
   * Sourced references (Herbal Index Phase 1) — OPTIONAL. Populated
   * ONLY from the overlay in lib/catalog/herb-references.ts, applied
   * in lib/catalog/herbs.ts; rendered on herb detail pages only.
   * Absent = no references are rendered; a missing reference is never
   * filled in by invention.
   */
  references?: HerbReference[];
}

/* ------------------------------------------------------------------ */
/* Scents                                                              */
/* ------------------------------------------------------------------ */

export type EvidenceLevel = 'STRONG' | 'MODERATE' | 'ANECDOTAL';

export interface ScentRecipe {
  /** e.g. 'SCENT_RECIPE_01' — stable ID used in order payloads. */
  id: string;
  name: string;
  /** Human-readable oil list, e.g. ['Lavender (lead)', 'vanilla-mimic (warmth)']. */
  oils: string[];
  profile: string;
  sensory: string;
  palette: string[];
  botanical: string;
  mood: string;
  bestBase: string;
  safety: string;
  evidence: EvidenceLevel;
  evidenceNote: string;
}

export interface Oil {
  id: string;
  name: string;
  profileTags: string[];
}

/** A customer-built blend: 1–3 exact oil IDs. Enforced by validation. */
export interface CustomBlend {
  oils: string[];
}

/**
 * The §14 order-record rule: a scent selection is stored as EITHER a
 * signature recipe ID OR the exact custom-blend oil IDs — never prose.
 */
export type ScentSelection =
  | { type: 'signature'; recipe_id: string }
  | { type: 'custom_blend'; oils: string[] };

/* ------------------------------------------------------------------ */
/* Customization, cart, orders                                         */
/* ------------------------------------------------------------------ */

export interface Customization {
  base: SoapBaseId;
  /** SoapShape id, e.g. 'small-rose'. */
  shape: string;
  scent: ScentSelection;
  /** BotanicalOption id, or null for none. */
  botanical: string | null;
  /**
   * ColorOption id — or an owner-approved custom builder color encoded as
   * `custom#RRGGBB` (accepted by validateCustomization in lib/cart).
   */
  color: string;
}

export interface BundleSlot extends Customization {
  slot_index: number;
}

/**
 * A customer-built herbal formula (capsule, tea, or custom balm builder).
 *
 * The §14 order-record rule, extended: exact herb IDs are persisted —
 * never prose. The server recomputes the price from canonical data
 * (size base + per-herb add-ons, integer cents); browser values never
 * determine order totals.
 */
export interface FormulaCustomization {
  /** Exact herb IDs from lib/catalog/herbs.ts, in selection order. */
  herb_ids: string[];
  /** Formula size option id (see lib/pricing/pricing.ts). */
  size_id: string;
  creation_name?: string;
  intention?: string;
  notes?: string;
  /**
   * Custom balm ONLY (additive, 2026-10-30): the balm base/wax choice —
   * a BalmBaseId from lib/custom-formula/balm.ts ('soy-wax' |
   * 'beeswax'). REQUIRED on balm formulas, FORBIDDEN on capsule/tea
   * formulas (enforced in validateFormulaCustomization). Price-neutral
   * by owner ruling: both finishes cost the same.
   */
  base_id?: string;
  /**
   * Custom balm ONLY: the intended-purpose preference — a BalmPurpose
   * id from lib/custom-formula/balm.ts (preference/ritual language
   * only, never an efficacy claim). Persisted as an exact ID.
   */
  purpose_id?: string;
  /**
   * Custom balm ONLY: the scent preference — a signature scent recipe
   * ID from lib/catalog/scents.ts, or 'unscented'. Persisted as an
   * exact ID, never prose (mirrors the §14 scent rule).
   */
  scent_id?: string;
}

export interface CartItem {
  id: string;
  product_handle: string;
  variant_id?: string;
  quantity: number;
  customization?: Customization;
  /** Custom capsule/tea/balm formula — mutually exclusive with customization. */
  formula?: FormulaCustomization;
  /** Server-computed integer cents. The client never determines totals. */
  unit_price_cents: number;
}

export interface BundleConfiguration {
  bundle_id: string;
  slots: BundleSlot[];
  /** Server-computed. */
  price_cents: number;
  savings_cents: number;
}

/**
 * The authoritative order payload. Built and priced server-side;
 * analytics systems may observe it but never define it.
 */
export interface OrderConfiguration {
  items: CartItem[];
  bundle?: BundleConfiguration;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  computed_at: string;
  computed_by: 'server';
}

/* ------------------------------------------------------------------ */
/* Seasonal                                                            */
/* ------------------------------------------------------------------ */

export interface SeasonalFeature {
  id: string;
  month: number;
  year: number;
  name: string;
  tagline: string;
  /**
   * Confirmation status. 'confirmed' entries are owner-approved and may be
   * served by getSeasonalFeature(). 'proposed' entries are planning data —
   * they are NEVER returned by getSeasonalFeature(); use
   * getProposedSeasonalFeature() for planning/preview. Absent = confirmed
   * (back-compat with the October 2026 owner-verified entry).
   */
  status?: 'confirmed' | 'proposed';
  /**
   * When the seasonal theme follows a curated signature recipe (which may
   * use the owner's full inventory, including finished blends), link it
   * here. Customer custom blends still use only the 12 blendable oils —
   * the two paths must never be confused.
   */
  recipe_id?: string;
  oils: string[];
  palette: string[];
  copy: string;
  /** Honesty rule, e.g. "scent-theme naming only — pumpkin is not an ingredient". */
  copyRule: string;
  safetyNote?: string;
  availability?: string;
}

/* ------------------------------------------------------------------ */
/* Analytics (generic envelope; concrete taxonomy in lib/analytics)    */
/* ------------------------------------------------------------------ */

export interface AnalyticsEvent<E extends string = string> {
  event: E;
  properties: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
