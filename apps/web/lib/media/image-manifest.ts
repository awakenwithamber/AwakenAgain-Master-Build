/**
 * Image manifest — typed provenance registry for Amber's Alchemy Apothecary.
 *
 * Every visual asset the Next.js app may render is registered here with its
 * provenance, what it depicts, and whether it is a documentary photo of a
 * physical product. The UI must consult this registry and may NEVER render an
 * image path that has no entry here.
 *
 * Provenance vocabulary (exactly these 8 terms, nothing else):
 *   REAL_PRODUCT_PHOTO | OWNER_UPLOADED | AI_ENHANCED_PRODUCT_IMAGE |
 *   GENERATED_PRODUCT_REPRESENTATION | LICENSED_STOCK | ILLUSTRATION |
 *   ICON | MISSING_ASSET
 *
 * MISSING_ASSET entries are honest and renderable: they carry a label and a
 * UI slot so the app can render a labeled placeholder instead of a fake image.
 * Generated/styled representations carry notDocumentaryPhoto: true and must
 * never be presented as documentary photography of physical inventory.
 *
 * Sources: catalog-enrichment/IMAGE_MANIFEST.json (v3), soap-builder/images/MANIFEST.md,
 * soap-shop-build/assets/provenance.json, products.canonical.v3.json (45 records).
 * Audit: docs/migration/IMAGE_INTEGRITY_REPORT.md (2026-10-05).
 */

export type Provenance =
  | 'REAL_PRODUCT_PHOTO'
  | 'OWNER_UPLOADED'
  | 'AI_ENHANCED_PRODUCT_IMAGE'
  | 'GENERATED_PRODUCT_REPRESENTATION'
  | 'LICENSED_STOCK'
  | 'ILLUSTRATION'
  | 'ICON'
  | 'MISSING_ASSET';

export const PROVENANCE_VOCABULARY: readonly Provenance[] = [
  'REAL_PRODUCT_PHOTO',
  'OWNER_UPLOADED',
  'AI_ENHANCED_PRODUCT_IMAGE',
  'GENERATED_PRODUCT_REPRESENTATION',
  'LICENSED_STOCK',
  'ILLUSTRATION',
  'ICON',
  'MISSING_ASSET',
] as const;

export interface ImageAssetEntry {
  /** Stable asset id, never renamed once referenced. */
  id: string;
  /** App-served path (under nextjs-app/public once deployed). */
  path: string;
  /** Product/variant depicted, or slot description for MISSING_ASSET. */
  depicts: string;
  provenance: Provenance;
  /**
   * True for AI-generated or AI-styled imagery: NOT a documentary photo of a
   * physical product. UI must never present it as one.
   */
  notDocumentaryPhoto: boolean;
  /**
   * Canonical soap shape id this asset depicts (small-rose, medium-rose,
   * plain-rectangle, wave-rectangle, floral-round), when applicable.
   */
  shapeId?: string;
  /**
   * Catalog handle this entry covers (product card slot, etc.), when applicable.
   */
  slotKey?: string;
  /** Current workspace location of the source file, until copied into public/. */
  stagedFrom?: string;
  /** True once the file has been copied into nextjs-app/public/. */
  deployed: boolean;
  /** Renderable label for MISSING_ASSET slots. */
  label?: string;
  /** Renderable UI slot description for MISSING_ASSET slots. */
  slot?: string;
  notes?: string;
}

function real(
  id: string,
  path: string,
  depicts: string,
  provenance: Exclude<Provenance, 'MISSING_ASSET'>,
  opts: {
    notDocumentaryPhoto?: boolean;
    shapeId?: string;
    slotKey?: string;
    stagedFrom?: string;
    deployed?: boolean;
    notes?: string;
  } = {},
): ImageAssetEntry {
  return {
    id,
    path,
    depicts,
    provenance,
    notDocumentaryPhoto: opts.notDocumentaryPhoto ?? false,
    shapeId: opts.shapeId,
    slotKey: opts.slotKey,
    stagedFrom: opts.stagedFrom,
    deployed: opts.deployed ?? false,
    notes: opts.notes,
  };
}

function missing(
  id: string,
  path: string,
  depicts: string,
  label: string,
  slot: string,
  opts: { slotKey?: string; shapeId?: string; notes?: string } = {},
): ImageAssetEntry {
  return {
    id,
    path,
    depicts,
    provenance: 'MISSING_ASSET',
    notDocumentaryPhoto: false,
    shapeId: opts.shapeId,
    slotKey: opts.slotKey,
    deployed: false,
    label,
    slot,
    notes: opts.notes,
  };
}

const STAGE_SOAP_BUILDER = '~/workspace/awakenagain-migration/soap-builder/images';
const STAGE_SOAP_SHOP = '~/workspace/awakenagain-migration/soap-shop-build/assets';
const STAGE_UPLOADS = '~/workspace/user/files';

/* ---------------- Staged real assets (exist on disk, not yet in public/) ---------------- */

export const IMAGE_MANIFEST: readonly ImageAssetEntry[] = [
  // — Shape reference crops (owner-supplied infographic artwork, text bands excluded) —
  real(
    'asset_shape_small_rose',
    '/images/shapes/shape-small-rose.png',
    'Small Rose shape, 2 oz, $5.77 — red rose over white base (shape reference; does not depict any specific formula)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      shapeId: 'small-rose',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-small-rose.png`,
      notes:
        'Cropped from Amber\'s infographic artwork (AI-styled artwork she supplied). Thumbnail grade (160x133); not for hero use.',
    },
  ),
  real(
    'asset_shape_medium_rose',
    '/images/shapes/shape-medium-rose.png',
    'Medium Rose shape, 3 oz, $8.77 — green rose over white base (shape reference)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      shapeId: 'medium-rose',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-medium-rose.png`,
      notes: 'Visibly larger than the Small Rose crop, per the owner\'s size rule (162x133).',
    },
  ),
  real(
    'asset_shape_wave_rectangle',
    '/images/shapes/shape-wave-rectangle.png',
    'Large Wave Rectangle shape, 4.5 oz, $11.77 — purple/pink wave top over white base (shape reference; builder live-preview canvas)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      shapeId: 'wave-rectangle',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-wave-rectangle.png`,
      notes: '290x133. This is the fixed live-preview canvas for the soap builder.',
    },
  ),
  real(
    'asset_shape_floral_round',
    '/images/shapes/shape-floral-round.png',
    'Large Floral Round shape, 4.5 oz, $11.77 — green/gold floral top over white base (shape reference)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      shapeId: 'floral-round',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-floral-round.png`,
      notes: '250x133.',
    },
  ),
  real(
    'asset_shape_plain_rectangle',
    '/images/shapes/shape-plain-rectangle.png',
    'Large Plain Rectangle shape, 4 oz, $9.77 — red botanical top over white base (shape reference)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      shapeId: 'plain-rectangle',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-plain-rectangle.png`,
      notes: '253x133. Clean crop; no text or prices in image.',
    },
  ),

  // — Regenerations (replace artwork with superseded prices baked in) —
  real(
    'asset_shape_plain_rectangle_clean',
    '/images/shapes/shape-plain-rectangle-clean.png',
    'Large Plain Rectangle, 4 oz, $9.77 — three plain rectangular double-layer soaps, clear botanical top with dried red/orange petals, creamy white bottom, clean unblended layer boundary, twine bows, dark apothecary styling',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      shapeId: 'plain-rectangle',
      stagedFrom: `${STAGE_SOAP_BUILDER}/shape-plain-rectangle-clean.png`,
      notes:
        'Replaces 15308_226_2f09.jpg, which had superseded price $8.44 baked into the artwork (correct price $9.77). No text or prices in this image.',
    },
  ),
  real(
    'asset_shape_plain_rectangle_clean_web',
    '/images/shapes/shape-plain-rectangle-clean-web.jpg',
    'Same as asset_shape_plain_rectangle_clean (web-optimized derivative)',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      shapeId: 'plain-rectangle',
      stagedFrom: `${STAGE_SOAP_SHOP}/shape-plain-rectangle-clean-web.jpg`,
      notes: 'Web-optimized derivative (900px wide, JPEG q82) for <img> tags. Original retained.',
    },
  ),
  real(
    'asset_soap_lineup_5',
    '/images/soap/soap-lineup-5.png',
    'Five-soap lineup: small red rose, larger green rose, purple wave rectangle, green floral round, red plain rectangle — double-layer, correct relative sizes, dark enchanted-apothecary styling',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'soap-style-collection-5',
      stagedFrom: `${STAGE_SOAP_BUILDER}/soap-lineup-5.png`,
      deployed: true,
      notes:
        'Replaces 15316_227_zkei.jpg, the old collage with superseded prices/sizes baked in. No text or prices in this image. Deployed at public/images/soap/soap-lineup-5.png (verified on disk 2026-10-13) and registered 2026-10-13 as the Alchemy Soap Collection\'s primary representation — the product record (rec-soap-style-collection-5.ts) now points at this file; it is a generated representation, never bundle photography.',
    },
  ),
  real(
    'asset_soap_lineup_5_web',
    '/images/soap/soap-lineup-5-web.jpg',
    'Same as asset_soap_lineup_5 (web-optimized derivative)',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      stagedFrom: `${STAGE_SOAP_SHOP}/soap-lineup-5-web.jpg`,
      notes: 'Web-optimized derivative (1200px wide, JPEG q82) for hero <img>. Original retained.',
    },
  ),

  // — Owner-supplied formula-specific image (v3 IMAGE_MANIFEST, hand-mapped) —
  real(
    'asset_medrose_eucalyptus_mint',
    '/images/products/eucalyptus-mint-spa-renewal-soap.webp',
    'eucalyptus-mint-spa-renewal-soap — Medium Rose variant, 3 oz, $8.77 — regenerated green Medium Rose with visible mint/eucalyptus leaf inclusions, rose form retained',
    'AI_ENHANCED_PRODUCT_IMAGE',
    {
      notDocumentaryPhoto: true,
      shapeId: 'medium-rose',
      slotKey: 'eucalyptus-mint-spa-renewal-soap',
      stagedFrom: `${STAGE_UPLOADS}/20259_223_k5ey.png`,
      deployed: true,
      notes:
        'Owner-designated storefront primary for the Eucalyptus+Mint Medium Rose variant only (image_id img_medrose_eucalyptus_mint). The boxed Medium Rose photo is ARCHIVED_SOURCE. Formula-specific: do not use for other formulas\' Medium Rose variants. Path corrected 2026-10-13: the deployed file is the products-path webp (pixel-verified identical to the 20259_223_k5ey.png regeneration); the former /images/soaps/…medium-rose.png path was never deployed.',
    },
  ),

  // — Deployed product assets (verified against public/ 2026-10-13) —
  // Registered in the image-coverage truth table (audit-2026-10-13). Each
  // deployed file below was viewed and, where an owner-upload source exists,
  // pixel-verified identical to it. These entries replace MISSING_ASSET slots
  // that falsely claimed the imagery was missing or not yet staged.
  real(
    'asset_product_dreamease_capsules',
    '/images/products/dreamease-capsules.webp',
    'DreamEase Capsules — hand holding an open amber jar labeled "Amber\'s Alchemy DREAMEASE Capsules — Natural Sleep Support", capsules visible',
    'OWNER_UPLOADED',
    {
      slotKey: 'dreamease-capsules',
      stagedFrom: `${STAGE_UPLOADS}/17291_1_etho.webp`,
      deployed: true,
      notes:
        'Owner-supplied product photo: pixel-verified 2026-10-13 as identical to uploads/17291_1_etho.webp, which IMAGE_MAP.md maps to dreamease-capsules as "DreamEase capsules jar (product photo)". Replaces the former MISSING_ASSET slot that pointed at a never-staged dreamease-capsules-photo.webp path.',
    },
  ),
  real(
    'asset_product_gaias_rose_soap',
    '/images/products/gaias-rose-soap.webp',
    'Gaia\'s Rose Soap — red floral round double-layer soap (clear red botanical top over white base), candlelit apothecary styling',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'gaias-rose-soap',
      stagedFrom: `${STAGE_UPLOADS}/17297_5_ncac.webp`,
      deployed: true,
      notes:
        'Pixel-verified 2026-10-13 as identical to owner upload 17297_5_ncac.webp (IMAGE_MAP gallery for this product). AI-styled artwork supplied by the owner — not verified as a documentary photo. Second gallery upload 17300_8_ckj3.webp (red rose soap) exists in uploads but is NOT deployed.',
    },
  ),
  real(
    'asset_product_lavender_fairy_dream_soap',
    '/images/products/lavender-fairy-dream-soap.webp',
    'Lavender Fairy Dream Soap — painterly illustration of a soap bar with lavender sprigs, bubbles and a crescent moon',
    'ILLUSTRATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'lavender-fairy-dream-soap',
      stagedFrom: `${STAGE_UPLOADS}/15936_29_wrls.webp`,
      deployed: true,
      notes:
        'Pixel-verified 2026-10-13 as identical to owner upload 15936_29_wrls.webp (IMAGE_MAP: soap-category lifestyle art mapped to this formula). Digital illustration, not a photograph.',
    },
  ),
  real(
    'asset_product_alchemy_tea_blend',
    '/images/products/alchemy-tea-blend.webp',
    'Alchemy Tea Blend — AI-generated marketing graphic: labeled clamp-lid tea jar with baked-in caption text and steeping instructions',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'alchemy-tea-blend',
      deployed: true,
      notes:
        'Generated graphic with text baked in; not product photography. Registered 2026-10-13 (previously an unregistered file: the product record carried images: []).',
    },
  ),
  real(
    'asset_product_chill_pill_capsules',
    '/images/products/chill-pill-capsules.webp',
    'Chill Pill Capsules — AI-generated marketing graphic: labeled amber jar with baked-in caption text naming Chill Pill',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'chill-pill-capsules',
      deployed: true,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards.',
    },
  ),
  real(
    'asset_product_happy_pill_capsules',
    '/images/products/happy-pill-capsules.webp',
    'Happy Pill Capsules — AI-generated marketing graphic: labeled amber jar with baked-in caption text naming Happy Pill',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'happy-pill-capsules',
      deployed: true,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards.',
    },
  ),
  real(
    'asset_product_immune_at_ease_capsules',
    '/images/products/immune-at-ease-capsules.webp',
    'Immune-At-Ease Capsules — AI-generated marketing graphic: labeled amber jar with baked-in caption text',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'immune-at-ease-capsules',
      deployed: true,
      notes:
        'Generated graphic; not product photography. Registered 2026-10-13. Regenerated 2026-10-13 at the owner\'s direction (the original caption was garbled); replacement label and caption verified word-for-word.',
    },
  ),
  real(
    'asset_product_sacred_balance_capsules',
    '/images/products/sacred-balance-capsules.webp',
    'Sacred Balance Capsules — AI-generated marketing graphic: amber jar labeled "Sacred Balance — Hormone Balancing Formula"',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'sacred-balance-capsules',
      deployed: true,
      notes:
        'Generated graphic; not product photography. Registered 2026-10-13. Regenerated 2026-10-13 at the owner\'s direction (caption-only edit; jar and scene preserved): the original caption described Vital Connect; the replacement caption describes Sacred Balance and was verified word-for-word.',
    },
  ),
  real(
    'asset_product_vital_connect_capsules',
    '/images/products/vital-connect-capsules.webp',
    'Vital Connect Capsules — AI-generated marketing graphic: labeled amber jar with baked-in caption text naming Vital Connect',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-connect-capsules',
      deployed: true,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards.',
    },
  ),
  real(
    'asset_product_vital_flow_capsules',
    '/images/products/vital-flow-capsules.webp',
    'Vital Flow Capsules — AI-generated marketing graphic: labeled amber jar with baked-in caption text naming Vital Flow',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-flow-capsules',
      deployed: true,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards.',
    },
  ),
  real(
    'asset_product_vital_vitality_capsules',
    '/images/products/vital-vitality-capsules.webp',
    'Vital Vitality Capsules — AI-generated marketing graphic: amber jar labeled "Vital Vitality Vitamins" with baked-in caption text',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-vitality-capsules',
      deployed: true,
      notes:
        'Generated graphic; not product photography. Registered 2026-10-13. Regenerated 2026-10-13 at the owner\'s direction: the original jar label read "Vital Vitality Vitamins"; the replacement reads "Vital Vitality Capsules", verified word-for-word.',
    },
  ),
  real(
    'asset_product_grimoire_subscription',
    '/images/products/grimoire-subscription.webp',
    'Living Grimoire of Light & Magic Subscription — digital illustration of an open botanical grimoire under a moon-phase arch',
    'ILLUSTRATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'grimoire-subscription',
      deployed: true,
      notes:
        'Illustration for a digital product; not a photograph. Registered 2026-10-13. A different photo-style grimoire image serves this handle on /services (/images/services/grimoire-subscription.webp).',
    },
  ),
  real(
    'asset_product_full_soap_collection',
    '/images/products/full-soap-collection.webp',
    'Full Soap Collection (superseded) — AI-generated lineup of FIVE double-layer soaps on a candlelit apothecary table',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'full-soap-collection',
      deployed: true,
      notes:
        'Product SUPERSEDED by soap-style-collection-5; excluded from the shop grid and rendered nowhere in the shop flow. The image shows five bars; the catalog record alt text was corrected 2026-10-13 to describe the artwork accurately (the collection itself gathered nine bars). Do not use this image to depict a nine-bar collection.',
    },
  ),

  // — Owner-supplied service + brand artwork (owner-approved assignments,
  // image-mapping report 2026-10-22, applied 2026-10-23). Each entry below
  // fills a slot that was MISSING_ASSET / UNVERIFIED before this pass; the
  // filled handles were removed from productSlots() in the same change. —
  real(
    'asset_service_energy_work',
    '/images/products/energy-work.webp',
    'Energy Work — owner-supplied artwork: elemental triangles diagram (fire, water, earth, air) in gold linework on deep plum',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'energy-work',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19586_6_ga12.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #6 of the 2026-10-22 mapping report). Replaces the legacy images/elements-metaphysics.webp association, which the manifest marked UNVERIFIED — do not render. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_service_home_aura_space_cleansing',
    '/images/products/home-aura-space-cleansing.webp',
    'Home / Aura & Space Cleansing — owner-supplied artwork: a lit ritual smoking bowl with botanicals, candlelit apothecary styling',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'home-aura-space-cleansing',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19592_9_47yw.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #9 of the 2026-10-22 mapping report): a smoking cleansing bowl is the literal visual of this service. Replaces the former UNVERIFIED legacy association. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_service_personalized_botanical_consultation',
    '/images/products/personalized-botanical-consultation.webp',
    'Personalized Botanical Consultation — owner-supplied artwork: apothecary bottles and a mortar on a candlelit workbench',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'personalized-botanical-consultation',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19591_8_y4kk.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #8 of the 2026-10-22 mapping report). Replaces the legacy images/apothecary-shop.webp association, which the manifest marked UNVERIFIED — do not render. The same artwork also serves Custom Remedy Consultation (asset_service_custom_remedy_consultation), per the mapping report. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_service_custom_remedy_consultation',
    '/images/products/custom-remedy-consultation.webp',
    'Custom Remedy Consultation — owner-supplied artwork: apothecary bottles and a mortar on a candlelit workbench (shared with Personalized Botanical Consultation)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'custom-remedy-consultation',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19591_8_y4kk.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #8 of the 2026-10-22 mapping report, shared with Personalized Botanical Consultation — the apothecary-workbench artwork fits both consultation slots). The record formerly carried images: []. Overwrites a 19,602-byte placeholder fallback file previously deployed at this path. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_service_tarot_readings',
    '/images/products/tarot-readings.webp',
    'Tarot Readings — owner-supplied artwork: tarot cards fanned on a candlelit apothecary table',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'tarot-readings',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19590_10_zvwd.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #10 of the 2026-10-22 mapping report): the record carried images: [] exactly — a verified-empty slot. Overwrites a 15,884-byte catalog-safe placeholder fallback file previously deployed at this path. The same artwork also serves Tarot + Rune Reading (asset_service_tarot_rune_reading), per the mapping report. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_service_tarot_rune_reading',
    '/images/products/tarot-rune-reading.webp',
    'Tarot + Rune Reading — owner-supplied artwork: tarot cards fanned on a candlelit apothecary table (shared with Tarot Readings)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'tarot-rune-reading',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19590_10_zvwd.webp`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #10 of the 2026-10-22 mapping report, shared with Tarot Readings). Replaces the former UNVERIFIED legacy association (images/elements-metaphysics.webp). Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_soap_small_rose_promo',
    '/images/soap/small-rose-soap-promo.png',
    'Small Rose Soap promo card — red rose double-layer soap in candlelit apothecary styling, with corrected canon text baked in: "Small Rose Soap — 2 OZ | $5.77"',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'gaias-rose-soap',
      stagedFrom:
        '~/workspace/goals/amber-s-alchemy-apothecary-next-js-migration/files/regenerated-art/small-rose-soap-promo-corrected.png',
      deployed: true,
      notes:
        'Regenerated 2026-10-22 from owner upload #3, whose baked-in text read "3 OZ | $4.77" (superseded); the corrected values (2 oz, $5.77) were verified string-by-string against canon before deployment, and the owner approved deployment 2026-10-23. Renders as the figure in the Five Signature Shapes section of /soap-shop and as a gallery image on the Gaia\'s Rose Soap record (the Small Rose is that product\'s 2 oz / $5.77 variant). The product\'s primary image remains asset_product_gaias_rose_soap. Promo artwork with prices baked in: if per-shape canon prices ever change, this file must be regenerated or retired in the same change.',
    },
  ),
  real(
    'asset_soap_collection_grid',
    '/images/soap/soap-collection-grid.png',
    'The Alchemy Soap Collection grid — the five soap styles with canon sizes and prices baked in: Small Rose 2 oz $5.77, Medium Rose 3 oz $8.77, Classic Chic Rectangle 4 oz $9.77, Large Floral Round 4.5 oz $11.77, Wave Art Rectangle 4.5 oz $11.77',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'soap-style-collection-5',
      stagedFrom:
        '~/workspace/goals/amber-s-alchemy-apothecary-next-js-migration/files/regenerated-art/soap-collection-grid-corrected.png',
      deployed: true,
      notes:
        'Regenerated 2026-10-22 from owner upload #4, whose baked-in sizes/prices were superseded (Small Rose 3 oz/$4.77, Medium Rose 4 oz/$7.88, Classic Chic Rectangle 4 oz/$8.44, both large bars 5 oz); all ten corrected values were verified string-by-string against canon before deployment, and the owner approved deployment 2026-10-23. Renders in the Bundle section of /soap-shop and as a gallery image on the Collection record. The Collection\'s primary representation remains the text-free asset_soap_lineup_5. Promo artwork with prices baked in: if per-shape canon prices ever change, this file must be regenerated or retired in the same change.',
    },
  ),
  real(
    'asset_brand_living_grimoire_cover',
    '/images/brand/living-grimoire-cover.jpg',
    'Living Grimoire cover art — a gilt grimoire with a moon-and-sun emblem beside a candle and crystals, deep plum and gold (owner-supplied artwork; its baked-in title band is cropped off the placed copy — see notes)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_20375_1_ys90.jpg`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #1 of the 2026-10-22 mapping report, §3). The upload carries the words "THE LIVING GRIMOIRE" in a black band along its bottom edge; because GrimoireBook renders its own cover brand/title/subtitle, the placed copy is cropped at y=1000 of 1184 (band excluded — the same text-band-exclusion crop technique as the soap shape crops) and set as the .cover background-image in components/grimoire/grimoire.module.css, with the component text on top. The original upload is retained untouched in ~/workspace/user/files.',
    },
  ),
  real(
    'asset_brand_herbal_library_header',
    '/images/brand/herbal-library-header.jpg',
    'Herb & Ingredient Library header art — an open botanical herbal under a moon-phase arch, with the words "Herb & Ingredient Library" (owner-supplied artwork)',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_20377_2_8xuk.jpg`,
      deployed: true,
      notes:
        'Owner-approved assignment 2026-10-23 (upload #2 of the 2026-10-22 mapping report): header art for the Herb Index (/herb-index), which previously had no imagery. The artwork\'s own title band names this section and is retained in the file. Placed whole (no crop); displayed as a centered header plate via .herb-index-header-art in app/globals.css.',
    },
  ),

  // — MISSING_ASSET slots: product photography gaps (label + slot, never a fake image) —
  ...productSlots(),
  // — MISSING_ASSET slots: builder experience —
  ...builderSlots(),
];

function productSlots(): ImageAssetEntry[] {
  // One honest slot per catalog product with no staged real photo.
  // slotKey = catalog handle; path = canonical product-image path.
  // Note (2026-10-13 truth table): for many handles below, a designed
  // placeholder-card file ("Product photography in progress" baked into the
  // image) is deployed at this exact path and is what shop cards render; the
  // MISSING_ASSET here refers to the absent product PHOTO, not an absent file.
  // Handles whose deployed files are real imagery are registered as real
  // entries above and no longer appear here.
  const rows: Array<[handle: string, label: string, slot: string, notes?: string]> = [
    ['radiance-renewal-balm', 'Radiance Renewal Botanical Balm', 'Product photo slot — botanical balm', 'No real product photo on file.'],
    ['radiance-support-capsules', 'Radiance Support Capsules', 'Product photo slot — capsules in amber jar'],
    ['root-scalp-revival-serum', 'Root & Scalp Revival Botanical Serum', 'Product photo slot — amber dropper bottle', '16893_13_oil4.png exists but is ART_DIRECTION_ONLY, not a product photo.'],
    ['soothe-restore-botanical-balm', 'Soothe & Restore Botanical Balm', 'Product photo slot — balm jar with herbs', 'Dangling reference: "Amber\'s Alchemy Apothecary Balm Ritual.png" does not exist in uploads — do not render.'],
    ['gentle-detox-ritual', 'Gentle Detox Ritual Bundle', 'Bundle photo slot'],
    ['focus-clarity-ritual', 'Focus & Clarity Ritual Bundle', 'Bundle photo slot'],
    ['stress-relief-ritual', 'Unwind Ritual Bundle', 'Bundle photo slot'],
    ['environmental-wellness-support', 'Environmental Wellness Support', 'Product photo slot — capsules'],
    ['metabolic-wellness-formula', 'Metabolic Wellness Formula', 'Product photo slot — capsules'],
    ['seasonal-gut-reset', 'Seasonal Gut Reset', 'Product photo slot — capsules'],
    ['wild-caught-omega-3-fish-oil', 'Wild-Caught Omega-3 Fish Oil', 'Product photo slot — supplement bottle', 'EXPLICITLY no stock-bottle substitution per catalog note.'],
    ['custom-herbal-capsules', 'Custom Herbal Capsules', 'Product photo slot — consultation/service'],
    ['personalized-herbal-protocols', 'Personalized Herbal Protocols', 'Service visual slot'],
    // Filled 2026-10-23 (owner-approved assignments, mapping report
    // 2026-10-22) and registered as real entries above — no longer missing:
    // custom-remedy-consultation, tarot-readings, energy-work,
    // home-aura-space-cleansing, personalized-botanical-consultation,
    // tarot-rune-reading.
    ['hypnotherapy-guided-relaxation', 'Hypnotherapy & Guided Relaxation', 'Service visual slot', 'Legacy association images/guided-meditation.webp is UNVERIFIED.'],
    ['past-life-inspired-guided-exploration', 'Past-Life-Inspired Guided Exploration', 'Service visual slot', 'Legacy association unverified.'],
    ['rune-readings', 'Rune Readings', 'Service visual slot', 'Legacy association unverified.'],
    ['citrus-goddess-glow-soap', 'Citrus Goddess Glow Soap', 'Formula photo slot — shape references staged', 'No formula-specific photo; 5 shape crops registered above.'],
    ['custom-botanical-soap', 'Custom Botanical Soap', 'Builder visual slot', '6 of 8 v3 "mapped_photo" files do not exist — do not render v3 file list. Use staged shape crops.'],
    ['fresh-mountain-air-soap', 'Fresh Mountain Air Soap', 'Formula photo slot — shape references staged'],
    ['orange-lily-goddess-soap', 'Orange Lily Goddess Soap', 'Formula photo slot — shape references staged'],
    ['sacred-forest-ritual-soap', 'Sacred Forest Ritual Soap', 'Formula photo slot — shape references staged'],
    ['sunlit-garden-bloom-soap', 'Sunlit Garden Bloom Soap', 'Formula photo slot — shape references staged'],
    ['warm-cinnamon-comfort-soap', 'Warm Cinnamon Comfort Soap', 'Formula photo slot — shape references staged'],
    ['custom-tea-blends', 'Custom Tea Blends', 'Product photo slot — tea'],
    ['soap-style-collection-5', 'The Alchemy Soap Collection', 'Bundle photo slot — 5-style set', 'No bundle photography on file at this canonical path, and no file exists here (cards fall back gracefully). The collection\'s deployed representation is the generated five-bar lineup registered separately as asset_soap_lineup_5 (/images/soap/soap-lineup-5.png). The old collage is archive-only (superseded prices baked in). Bundle price $35.77.'],
  ];
  return rows.map(([handle, label, slot, notes]) =>
    missing(
      `slot_product_${handle}`,
      `/images/products/${handle}.webp`,
      `${label} (catalog handle: ${handle})`,
      `Photo coming soon — ${label}`,
      slot,
      { slotKey: handle, notes },
    ),
  );
}

function builderSlots(): ImageAssetEntry[] {
  const entries: ImageAssetEntry[] = [];
  // 13 signature-scent cards: honest palette swatches labeled as swatches — never fake product photos.
  const scents: Array<[id: string, name: string]> = [
    ['SCENT_RECIPE_01', 'Moonlit Lavender'],
    ['SCENT_RECIPE_02', 'Forest Whisper'],
    ['SCENT_RECIPE_03', 'Citrus Sunshine'],
    ['SCENT_RECIPE_04', 'Alpine Frost'],
    ['SCENT_RECIPE_05', 'Sweet Serenity'],
    ['SCENT_RECIPE_06', 'Rose Goddess'],
    ['SCENT_RECIPE_07', 'Sacred Stillness'],
    ['SCENT_RECIPE_08', 'Spice of the Earth'],
    ['SCENT_RECIPE_09', 'Herbal Harmony'],
    ['SCENT_RECIPE_10', 'Mystic Musk'],
    ['SCENT_RECIPE_11', 'Cedar Hollow'],
    ['SCENT_RECIPE_12', 'Enchanted Garden'],
    ['SCENT_RECIPE_13', 'Island Bloom'],
  ];
  for (const [recipeId, name] of scents) {
    entries.push(
      missing(
        `slot_scent_${recipeId.toLowerCase()}`,
        `/images/scents/${recipeId.toLowerCase()}.webp`,
        `${name} (${recipeId}) — signature scent card visual`,
        `Visual swatch — ${name}`,
        'Scent card visual slot',
        {
          slotKey: recipeId,
          notes:
            'Interim resolution per provenance.json: honest color-swatch gradient derived from the recipe\'s suggested palette, labeled as a visual swatch — not a fake product photo. Recipes are PROPOSED (pending owner approval).',
        },
      ),
    );
  }
  // 9 botanical chips.
  const botanicals = [
    'rose-petals',
    'lavender',
    'calendula',
    'chamomile',
    'hibiscus',
    'rosemary',
    'mint',
    'oatmeal',
    'cornflower',
  ];
  for (const b of botanicals) {
    entries.push(
      missing(
        `slot_botanical_${b}`,
        `/images/botanicals/${b}.webp`,
        `Botanical chip — ${b} (one per soap)`,
        `Photo coming soon — ${b}`,
        'Botanical chip visual slot',
        { notes: 'Interim resolution: CSS illustration-style swatch. Replace with real macro photography when available.' },
      ),
    );
  }
  // 3 base options.
  const bases: Array<[id: string, name: string]> = [
    ['double-layer', 'Signature Double Layer'],
    ['goat-milk-shea', 'Goat Milk + Shea Butter'],
    ['glycerin-castor', 'Botanical Glycerin + Castor Oil'],
  ];
  for (const [id, name] of bases) {
    entries.push(
      missing(
        `slot_base_${id}`,
        `/images/bases/${id}.webp`,
        `Base option — ${name}`,
        `Illustration — ${name}`,
        'Base option visual slot',
        { notes: 'Interim resolution: SVG cross-section illustration labeled as illustration. Double layer shows a clean unblended boundary.' },
      ),
    );
  }
  // Pumpkin Spice October 2026 Soap of the Month.
  entries.push(
    missing(
      'slot_seasonal_pumpkin_spice_oct_2026',
      '/images/seasonal/pumpkin-spice-oct-2026.webp',
      'Pumpkin Spice — October 2026 Soap of the Month',
      'October Soap of the Month — Pumpkin Spice',
      'Seasonal feature card visual slot',
      {
        notes:
          'Interim resolution: palette-driven illustration and copy. Do not substitute another product\'s photo. Copy rule: NEVER state or imply pumpkin is an ingredient.',
      },
    ),
  );
  // DreamEase: the former MISSING_ASSET slot here claimed the owner-supplied
  // jar photo was "not yet staged". Verified 2026-10-13: it is deployed at
  // /images/products/dreamease-capsules.webp and registered above as
  // asset_product_dreamease_capsules (OWNER_UPLOADED).
  return entries;
}

/* ---------------- lookups ---------------- */

export function getAsset(id: string): ImageAssetEntry | undefined {
  return IMAGE_MANIFEST.find((a) => a.id === id);
}

export function getAssetsForShape(shapeId: string): ImageAssetEntry[] {
  return IMAGE_MANIFEST.filter((a) => a.shapeId === shapeId);
}

export function getAssetsForSlot(slotKey: string): ImageAssetEntry[] {
  return IMAGE_MANIFEST.filter((a) => a.slotKey === slotKey);
}

export function isRenderable(entry: ImageAssetEntry): boolean {
  // A MISSING_ASSET is renderable as a labeled placeholder; a real asset is
  // renderable once deployed OR staged (staged = known-good source on disk).
  return entry.provenance === 'MISSING_ASSET' ? entry.label != null : true;
}
