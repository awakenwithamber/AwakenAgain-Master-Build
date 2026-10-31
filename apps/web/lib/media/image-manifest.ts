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
const STAGE_REGEN_2026_10_30 = '~/workspace/your_files/regenerated-images-2026-10-30';
const STAGE_CONTENT_BUILD_2026_10_30 = '~/workspace/content-build-2026-10-30';

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
    'asset_product_sacred_forest_ritual_soap',
    '/images/products/sacred-forest-ritual-soap.webp',
    'Sacred Forest Soap — panel cropped from the owner\'s three-soap card (regenerated with catalog names): a round green forest-mold bar with pinecone and evergreen styling by candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'sacred-forest-ritual-soap',
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-78-three-soap-card.png`,
      deployed: true,
      notes:
        'Photo reconciliation 2026-10-30: the middle panel of regen-78 (the owner-directed regeneration of her upload file 78, whose three panel identifications she accepted 2026-10-30) was cropped (x 645–1275 of 1920) and placed as this listing\'s first image; the baseline placeholder/MISSING_ASSET state is retired. AI-styled card artwork — not a documentary photograph, so it carries the representation caption. The original card\'s printed ingredient lists were removed in the regeneration as unverified.',
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
    'asset_product_lavender_fairy_dream_photo',
    '/images/products/lavender-fairy-dream-photo.webp',
    'Lavender Fairy Dream Soap — the maker\'s own photograph: a translucent violet-blue rose-mold bar with botanical layers, candlelit apothecary styling',
    'OWNER_UPLOADED',
    {
      slotKey: 'lavender-fairy-dream-soap',
      stagedFrom: `${STAGE_UPLOADS}/8145_80_4glw.jpg`,
      deployed: true,
      notes:
        'Owner-ruled identification 2026-10-30: upload file 80 IS Lavender Fairy Dream Soap. This photograph previously circulated with a "Miracle Pain Relieving Balm" caption — that caption is wrong for this image and must never be paired with it. Registered ahead of the painterly illustration entry so the product page leads with the maker\'s photograph; the illustration remains deployed as the secondary entry. Photo reconciliation 2026-10-30: the first staged copy of this file still contained the wrong caption band in its lower frame; the deployed file was re-cropped the same day to the photograph only (source 1080×1920, crop y 0–1400) so no caption text renders anywhere. Re-uploads 115/126 (10607_115_8dim.jpg / 10604_126_otd2.jpg) are byte-identical duplicates of the same captioned graphic and were not separately placed.',
    },
  ),
  real(
    'asset_product_shea_goat_milk_small_rose_soap',
    '/images/products/shea-goat-milk-small-rose-soap.webp',
    'Shea & Goat Milk Small Rose Soap — the maker\'s own photograph: a cream rose-mold bar with a pale peach base layer beside a lit candle, candlelit apothecary styling',
    'OWNER_UPLOADED',
    {
      slotKey: 'shea-goat-milk-small-rose-soap',
      stagedFrom: `${STAGE_UPLOADS}/8149_81_phb9.jpg`,
      deployed: true,
      notes:
        'Owner-ruled identification 2026-10-30: upload file 81 IS her shea butter / goat milk Small Rose for sensitive skin (no added oils, scents, or botanicals). Story-format photograph (1080×1920); the letterbox bars were cropped 2026-10-30 (scene band y 458–1470) and the frame converted to WebP — the bar and scene are otherwise untouched. Registered with the hand-authored listing created the same day at the owner\'s direction.',
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
    'Chill Pill Capsules — AI-generated marketing graphic: labeled amber jar; the anti-stress/mood-support subtitle was removed in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'chill-pill-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-72-chill-pill.jpg`,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards. Deployed file replaced 2026-10-30 with regen-72, whose label subtitle was stripped.',
    },
  ),
  real(
    'asset_product_happy_pill_capsules',
    '/images/products/happy-pill-capsules.webp',
    'Happy Pill Capsules — AI-generated marketing graphic: labeled amber jar; named hormone/neurotransmitter claim text was removed in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'happy-pill-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-87-happy-pill.png`,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards. Deployed file replaced 2026-10-30 with regen-87, whose claim list was removed.',
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
    'Sacred Balance Capsules — AI-generated marketing graphic: labeled amber jar with a compliant sensory caption added in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'sacred-balance-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-71-sacred-balance.jpg`,
      notes:
        'Generated graphic; not product photography. Registered 2026-10-13. Regenerated 2026-10-13 at the owner\'s direction (caption-only edit; jar and scene preserved): the original caption described Vital Connect; the replacement caption describes Sacred Balance and was verified word-for-word. Deployed file replaced 2026-10-30 with regen-71; the earlier hormone/endocrine claim caption was rewritten to sensory copy.',
    },
  ),
  real(
    'asset_product_vital_connect_capsules',
    '/images/products/vital-connect-capsules.webp',
    'Vital Connect Capsules — AI-generated marketing graphic: labeled amber jar; hormone/energy claim text was removed in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-connect-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-86-vital-connect.png`,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards. Deployed file replaced 2026-10-30 with regen-86, whose claim phrases were removed.',
    },
  ),
  real(
    'asset_product_vital_flow_capsules',
    '/images/products/vital-flow-capsules.webp',
    'Vital Flow Capsules — AI-generated marketing graphic: labeled amber jar; digestion/bloat-relief claim text was removed in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-flow-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-85-vital-flow.png`,
      notes: 'Generated graphic with text baked in; not product photography. Registered 2026-10-13; previously misregistered as MISSING_ASSET while the file rendered on shop cards. Deployed file replaced 2026-10-30 with regen-85, whose relief claims were removed.',
    },
  ),
  real(
    'asset_product_vital_vitality_capsules',
    '/images/products/vital-vitality-capsules.webp',
    'Vital Vitality Capsules — AI-generated marketing graphic: labeled amber jar; the side-card benefit claims were removed in the 2026-10-30 regeneration',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-vitality-capsules',
      deployed: true,
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-57-vital-vitality.png`,
      notes:
        'Generated graphic; not product photography. Registered 2026-10-13. Regenerated 2026-10-13 at the owner\'s direction: the original jar label read "Vital Vitality Vitamins"; the replacement reads "Vital Vitality Capsules", verified word-for-word. Deployed file replaced 2026-10-30 with regen-57, whose side-card claims were stripped.',
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


  // — Owner-directed content build, 2026-10-30 —
  real(
    'asset_product_dreamease_herbal_tea',
    '/images/products/dreamease-herbal-tea.webp',
    'DreamEase Herbal Tea — owner-supplied artwork: a labeled glass jar reading "Dream Ease Sleep Blend — 2 oz — Herbal Tea Blend" filled with loose-leaf botanicals, beside a brass scoop and lavender in candlelit apothecary styling',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'dreamease-herbal-tea',
      stagedFrom: `${STAGE_UPLOADS}/10600_121_tnch.jpg`,
      deployed: true,
      notes:
        'Photo reconciliation 2026-10-30: replaced the generated tea representation (loose-leaf jar + steaming cup, created earlier the same day) with the owner\'s own labeled Dream Ease tea artwork (inventory file 56; re-uploaded 2026-10-30 as upload 121, byte-identical). Owner-supplied AI-styled artwork — not documentary photography, so it keeps the representation caption. The deployed file is CROPPED to the jar (x 23.5%–73.5%, y 5.5%–81.5% of the source frame): the artwork\'s side card — which carries benefit wording ("Calms the Nervous System • Supports Deeper Sleep • Eases Stress & Anxiety • Promotes Relaxation • Helps You Wake Refreshed", the copy-rule flag recorded for file 56 in the uploads inventory) — is entirely outside the crop and does not appear on the site. What remains visible is the jar\'s own printed label, including its tagline "Rest Deep • Release Tension • Wake Refreshed", exactly as the physical product is labeled (the same standard as the DreamEase Capsules documentary photo). The full uncropped frame remains in the owner\'s uploads.',
    },
  ),
  real(
    'asset_product_vital_vitality_tea',
    '/images/products/vital-vitality-tea.webp',
    'Vital Vitality Tea — generated representation: loose-leaf roots and lemongrass blend beside a steaming cup in morning light',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-vitality-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-vital-vitality-0-9d73212d-f2e6-40ba-8dea-2520b89c4100.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_sacred_balance_tea',
    '/images/products/sacred-balance-tea.webp',
    'Sacred Balance Tea — generated representation: loose-leaf tulsi, nettle, sage and chamomile blend beside a steaming cup by candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'sacred-balance-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-sacred-balance-0-60b037b5-1746-43fd-997b-738466d25b59.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_chill_pill_tea',
    '/images/products/chill-pill-tea.webp',
    'Chill Pill Tea — generated representation: loose-leaf passionflower and lemon-balm blend beside a steaming cup in twilight candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'chill-pill-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-chill-pill-0-ef015df8-bbf8-4495-a872-b615b3f61255.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_happy_pill_tea',
    '/images/products/happy-pill-tea.webp',
    'Happy Pill Tea — generated representation: loose-leaf flowers, mimosa, schisandra and saffron blend beside a steaming cup in sunlight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'happy-pill-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-happy-pill-0-d2b6971b-1791-4770-a440-b98a9c0f83e8.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_vital_flow_tea',
    '/images/products/vital-flow-tea.webp',
    'Vital Flow Tea — generated representation: loose-leaf ginger, peppermint and fennel blend beside a steaming cup',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-flow-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-vital-flow-0-81871876-da3d-4706-8543-78363ffd72b7.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_vital_connect_tea',
    '/images/products/vital-connect-tea.webp',
    'Vital Connect Tea — generated representation: loose-leaf maca, shatavari, tulsi and vitex blend beside a steaming cup in warm candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'vital-connect-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-vital-connect-0-7633abc8-ddb5-4f72-81e3-218bfefdff0d.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_radiance_support_tea',
    '/images/products/radiance-support-tea.webp',
    'Radiance Support Tea — generated representation: ruby hibiscus and rose-hip loose-leaf blend beside a steaming crimson cup',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'radiance-support-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-radiance-support-0-86fe64a5-4081-4f83-880c-b86e047f040c.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_immune_at_ease_tea',
    '/images/products/immune-at-ease-tea.webp',
    'Immune-At-Ease Tea — generated representation: loose-leaf elderberry, echinacea and reishi blend beside a steaming cup by firelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'immune-at-ease-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-immune-at-ease-0-cdd350ba-2bfe-48bf-b5cd-b5ddf07d662e.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_moonlit_lavender_rose_tea',
    '/images/products/moonlit-lavender-rose-tea.webp',
    'Moonlit Lavender Rose Tea — generated representation: loose-leaf lavender and rose-petal blend beside a steaming cup in moonlight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'moonlit-lavender-rose-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-moonlit-lavender-rose-0-f01bbce2-65c9-45e8-b784-9b8d12d75b04.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_golden_hearth_tea',
    '/images/products/golden-hearth-tea.webp',
    'Golden Hearth Tea — generated representation: spiced loose-leaf blend with cinnamon and star anise beside a steaming cup by firelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'golden-hearth-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-golden-hearth-0-6701d01f-8d0a-420e-8aa8-18f630806937.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_wild_mint_meadow_tea',
    '/images/products/wild-mint-meadow-tea.webp',
    'Wild Mint Meadow Tea — generated representation: green loose-leaf mint blend beside a steaming cup in daylight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'wild-mint-meadow-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-wild-mint-meadow-0-021d0006-1906-4229-9b36-982d08393327.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_velvet_hibiscus_berry_tea',
    '/images/products/velvet-hibiscus-berry-tea.webp',
    'Velvet Hibiscus Berry Tea — generated representation: hibiscus and dark-berry loose-leaf blend beside a steaming garnet cup by candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'velvet-hibiscus-berry-tea',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated/media-generation-tea-velvet-hibiscus-berry-0-d8d870f9-9eb4-48db-8b5a-72b00e4fa768.webp`,
      deployed: true,
      notes:
        'Generated tea representation created 2026-10-30 at the owner\'s direction. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_root_scalp_revival_serum',
    '/images/products/root-scalp-revival-serum.webp',
    'Root & Scalp Revival Botanical Serum — regenerated marketing graphic of an amber dropper bottle, renamed from the legacy Miracle Hair Regrowth Serum artwork with regrowth claims removed',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'root-scalp-revival-serum',
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-73-root-scalp-revival-serum.jpg`,
      deployed: true,
      notes:
        'Regenerated artwork placed 2026-10-30 (regen-73). The flagged original was never placed. Generated representation — not real product photography.',
    },
  ),
  real(
    'asset_product_wild_caught_omega_3_fish_oil',
    '/images/products/wild-caught-omega-3-fish-oil.webp',
    'Wild-Caught Omega-3 Fish Oil — regenerated standalone marketing graphic of the labeled Omega-3 jar, with baked-in health claims removed',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'wild-caught-omega-3-fish-oil',
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-82b-omega-3-fish-oil.jpg`,
      deployed: true,
      notes:
        'Regenerated standalone artwork placed 2026-10-30 (regen-82b). The flagged composite was not placed, and this asset is not the mislabeled Natural Collagen Booster jar panel. Generated representation — not real product photography.',
    },
  ),
  real(
    'asset_product_custom_herbal_capsules',
    '/images/products/custom-herbal-capsules.webp',
    'Custom Herbal Capsules — regenerated apothecary promotional graphic for made-to-order capsule blends, with treatment-oriented wording removed',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'custom-herbal-capsules',
      stagedFrom: `${STAGE_REGEN_2026_10_30}/regen-76-custom-herbal-capsules.jpg`,
      deployed: true,
      notes:
        'Regenerated promotional graphic placed 2026-10-30 (regen-76). The front vessel in the artwork reads cream/balm-like rather than capsules; registered honestly as a promotional representation, not product photography.',
    },
  ),
  real(
    'asset_service_hypnotherapy_guided_relaxation',
    '/images/products/hypnotherapy-guided-relaxation.webp',
    'Hypnotherapy & Guided Relaxation — owner-supplied artwork of a meditating silhouette with glowing chakras on a lotus beneath the moon and mountains',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      slotKey: 'hypnotherapy-guided-relaxation',
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_19603_55_pq00.webp`,
      deployed: true,
      notes:
        'Owner-supplied artwork (inventory file 55, PROBABLE identification accepted by the owner 2026-10-30) assigned to this guided-relaxation service. Artwork for a service; not a photograph.',
    },
  ),
  real(
    'asset_brand_ambers_alchemy_emblem',
    '/images/brand/ambers-alchemy-emblem.png',
    'Amber\'s Alchemy Apothecary circular emblem — owner artwork with Amber Lynn Patten, moon phases, lotus, crystals and contact lines; the email line was deterministically corrected to Amber@awakenagain.com in 2026-10-30',
    'OWNER_UPLOADED',
    {
      notDocumentaryPhoto: true,
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/emblem/emblem-fixed.png`,
      deployed: true,
      notes:
        'Used as the site social/SEO emblem and source for the icon set. A generative edit attempt was rejected because it re-rendered the whole emblem; the deployed master uses a deterministic PIL email-line treatment, leaving the QR region and all pixels outside the email band identical to the owner upload.',
    },
  ),
  real(
    'asset_brand_amber_portrait',
    '/images/brand/amber-portrait.webp',
    'Amber Lynn Patten — owner-supplied portrait photograph in a bristlecone pine with a mountain backdrop',
    'OWNER_UPLOADED',
    {
      stagedFrom: `${STAGE_UPLOADS}/f51defe1-3492-4bdf-b809-aeb2a7f3693e-1_all_20784_20_hj6k.heif`,
      deployed: true,
      notes:
        'Owner-supplied HEIF photograph (inventory file 20, CONFIRMED) converted to WebP and cropped to a 1:1 format for the About page portrait. Documentary photograph of Amber.',
    },
  ),
  // — Owner-directed mega build, 2026-10-30 (Collagen Supplement +
  // ritual-bundle photography; Lavender Fairy Dream photo above) —
  real(
    'asset_product_collagen_supplement',
    '/images/products/collagen-supplement.webp',
    'Collagen Supplement — generated representation: amber apothecary jar of golden capsules among dried botanicals and candlelight, deep plum and gold',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'collagen-supplement',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated-mega/media-generation-collagen-supplement-0-034e962e-48e1-4d17-8d18-a7fea4816e05.webp`,
      deployed: true,
      notes:
        'Generated representation created 2026-10-30 at the owner\'s direction (owner update 05:38 MDT: a NEW generated photo — the legacy "Natural Collagen Booster" jar panel from upload file 82 was expressly NOT used). No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_focus_clarity_ritual',
    '/images/products/focus-clarity-ritual.webp',
    'The Focus & Clarity Ritual Bundle — generated representation: steaming tea cup, botanical soap bar, balm tin and amber capsule bottle with rosemary and peppermint on a candlelit apothecary table',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'focus-clarity-ritual',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated-mega/media-generation-focus-clarity-ritual-0-b2c73a6e-3748-4b25-a2e0-6d8c1c2aa2e2.webp`,
      deployed: true,
      notes:
        'Generated bundle representation created 2026-10-30 at the owner\'s direction — every package carries a photo. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_gentle_detox_ritual',
    '/images/products/gentle-detox-ritual.webp',
    'Gentle Flow Ritual Bundle — generated representation: golden tea, botanical soap bar, balm tin and amber capsule bottle with dandelion, fennel and ginger on an apothecary table',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'gentle-detox-ritual',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated-mega/media-generation-gentle-detox-ritual-0-e122314a-0cdc-4535-b555-dcf919948b10.webp`,
      deployed: true,
      notes:
        'Generated bundle representation created 2026-10-30 at the owner\'s direction — every package carries a photo. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_stress_relief_ritual',
    '/images/products/stress-relief-ritual.webp',
    'The Unwind Ritual Bundle — generated representation: steaming tea, botanical soap bar, balm tin and amber capsule bottle with lavender and chamomile in moonlit candlelight',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'stress-relief-ritual',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated-mega/media-generation-stress-relief-ritual-0-a1ba2729-339b-434e-b2c4-91848299dff4.webp`,
      deployed: true,
      notes:
        'Generated bundle representation created 2026-10-30 at the owner\'s direction — every package carries a photo. No text is baked into the image. It is not product photography.',
    },
  ),
  real(
    'asset_product_hearth_harvest_trio',
    '/images/products/hearth-harvest-trio.webp',
    'Hearth & Harvest Trio — generated representation: cinnamon spice bar, green rosemary forest bar and rose petal bar on an autumn apothecary table',
    'GENERATED_PRODUCT_REPRESENTATION',
    {
      notDocumentaryPhoto: true,
      slotKey: 'hearth-harvest-trio',
      stagedFrom: `${STAGE_CONTENT_BUILD_2026_10_30}/generated-mega/media-generation-hearth-harvest-trio-0-ae8372e2-ce9e-4078-97a2-dea2a52b2334.webp`,
      deployed: true,
      notes:
        'Generated bundle representation created 2026-10-30 at the owner\'s direction — every package carries a photo. No text is baked into the image. It is not product photography.',
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
    ['soothe-restore-botanical-balm', 'Soothe & Restore Botanical Balm', 'Product photo slot — balm jar with herbs', 'Dangling reference: "Amber\'s Alchemy Apothecary Balm Ritual.png" does not exist in uploads — do not render.'],
    ['environmental-wellness-support', 'Environmental Wellness Support', 'Product photo slot — capsules'],
    ['metabolic-wellness-formula', 'Metabolic Wellness Formula', 'Product photo slot — capsules'],
    ['seasonal-gut-reset', 'Seasonal Gut Reset', 'Product photo slot — capsules'],
    ['personalized-herbal-protocols', 'Personalized Herbal Protocols', 'Service visual slot'],
    // Filled 2026-10-23 (owner-approved assignments, mapping report
    // 2026-10-22) and registered as real entries above — no longer missing:
    // custom-remedy-consultation, tarot-readings, energy-work,
    // home-aura-space-cleansing, personalized-botanical-consultation,
    // tarot-rune-reading. Filled 2026-10-30: root-scalp-revival-serum,
    // wild-caught-omega-3-fish-oil, custom-herbal-capsules,
    // hypnotherapy-guided-relaxation. Filled 2026-10-30 (mega build):
    // gentle-detox-ritual, focus-clarity-ritual, stress-relief-ritual,
    // hearth-harvest-trio (generated bundle representations) and the new
    // collagen-supplement record.
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
