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
    deployed: false,
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
      stagedFrom: `${STAGE_SOAP_BUILDER}/soap-lineup-5.png`,
      notes:
        'Replaces 15316_227_zkei.jpg, the old collage with superseded prices/sizes baked in. No text or prices in this image.',
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
    '/images/soaps/eucalyptus-mint-spa-renewal-soap-medium-rose.png',
    'eucalyptus-mint-spa-renewal-soap — Medium Rose variant, 3 oz, $8.77 — regenerated green Medium Rose with visible mint/eucalyptus leaf inclusions, rose form retained',
    'AI_ENHANCED_PRODUCT_IMAGE',
    {
      notDocumentaryPhoto: true,
      shapeId: 'medium-rose',
      slotKey: 'eucalyptus-mint-spa-renewal-soap',
      stagedFrom: `${STAGE_UPLOADS}/20259_223_k5ey.png`,
      notes:
        'Owner-designated storefront primary for the Eucalyptus+Mint Medium Rose variant only (image_id img_medrose_eucalyptus_mint). The boxed Medium Rose photo is ARCHIVED_SOURCE. Formula-specific: do not use for other formulas\' Medium Rose variants.',
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
  const rows: Array<[handle: string, label: string, slot: string, notes?: string]> = [
    ['radiance-renewal-balm', 'Radiance Renewal Botanical Balm', 'Product photo slot — botanical balm', 'No real product photo on file.'],
    ['radiance-support-capsules', 'Radiance Support Capsules', 'Product photo slot — capsules in amber jar'],
    ['root-scalp-revival-serum', 'Root & Scalp Revival Botanical Serum', 'Product photo slot — amber dropper bottle', '16893_13_oil4.png exists but is ART_DIRECTION_ONLY, not a product photo.'],
    ['soothe-restore-botanical-balm', 'Soothe & Restore Botanical Balm', 'Product photo slot — balm jar with herbs', 'Dangling reference: "Amber\'s Alchemy Apothecary Balm Ritual.png" does not exist in uploads — do not render.'],
    ['gentle-detox-ritual', 'Gentle Detox Ritual Bundle', 'Bundle photo slot'],
    ['focus-clarity-ritual', 'Focus & Clarity Ritual Bundle', 'Bundle photo slot'],
    ['full-soap-collection', 'Full Soap Collection (9-bar)', 'Bundle photo slot', 'Record SUPERSEDED by soap-style-collection-5.'],
    ['stress-relief-ritual', 'Stress Relief Ritual Bundle', 'Bundle photo slot'],
    ['chill-pill-capsules', 'Chill Pill Capsules', 'Product photo slot — capsules in amber jar'],
    ['environmental-wellness-support', 'Environmental Wellness Support', 'Product photo slot — capsules'],
    ['happy-pill-capsules', 'Happy Pill Capsules', 'Product photo slot — capsules in amber jar'],
    ['immune-at-ease-capsules', 'Immune-At-Ease Capsules', 'Product photo slot — capsules in amber jar'],
    ['metabolic-wellness-formula', 'Metabolic Wellness Formula', 'Product photo slot — capsules'],
    ['sacred-balance-capsules', 'Sacred Balance Capsules', 'Product photo slot — capsules in amber jar'],
    ['seasonal-gut-reset', 'Seasonal Gut Reset', 'Product photo slot — capsules'],
    ['vital-connect-capsules', 'Vital Connect Capsules', 'Product photo slot — capsules in amber jar'],
    ['vital-flow-capsules', 'Vital Flow Capsules', 'Product photo slot — capsules in amber jar'],
    ['vital-vitality-capsules', 'Vital Vitality Capsules', 'Product photo slot — capsules in amber jar'],
    ['wild-caught-omega-3-fish-oil', 'Wild-Caught Omega-3 Fish Oil', 'Product photo slot — supplement bottle', 'EXPLICITLY no stock-bottle substitution per catalog note.'],
    ['custom-herbal-capsules', 'Custom Herbal Capsules', 'Product photo slot — consultation/service'],
    ['custom-remedy-consultation', 'Custom Remedy Consultation', 'Service visual slot'],
    ['personalized-herbal-protocols', 'Personalized Herbal Protocols', 'Service visual slot'],
    ['grimoire-subscription', 'Living Grimoire Subscription', 'Digital product visual slot'],
    ['tarot-readings', 'Tarot Readings', 'Service visual slot'],
    ['energy-work', 'Energy Work', 'Service visual slot', 'Legacy association images/elements-metaphysics.webp is UNVERIFIED — do not render as representative.'],
    ['home-aura-space-cleansing', 'Home / Aura / Space Cleansing', 'Service visual slot', 'Legacy association unverified.'],
    ['hypnotherapy-guided-relaxation', 'Hypnotherapy & Guided Relaxation', 'Service visual slot', 'Legacy association images/guided-meditation.webp is UNVERIFIED.'],
    ['past-life-inspired-guided-exploration', 'Past-Life-Inspired Guided Exploration', 'Service visual slot', 'Legacy association unverified.'],
    ['personalized-botanical-consultation', 'Personalized Botanical Consultation', 'Service visual slot', 'Legacy association images/apothecary-shop.webp is UNVERIFIED.'],
    ['rune-readings', 'Rune Readings', 'Service visual slot', 'Legacy association unverified.'],
    ['tarot-rune-reading', 'Tarot + Rune Reading', 'Service visual slot', 'Legacy association unverified.'],
    ['citrus-goddess-glow-soap', 'Citrus Goddess Glow Soap', 'Formula photo slot — shape references staged', 'No formula-specific photo; 5 shape crops registered above.'],
    ['custom-botanical-soap', 'Custom Botanical Soap', 'Builder visual slot', '6 of 8 v3 "mapped_photo" files do not exist — do not render v3 file list. Use staged shape crops.'],
    ['fresh-mountain-air-soap', 'Fresh Mountain Air Soap', 'Formula photo slot — shape references staged'],
    ['gaias-rose-soap', "Gaia's Rose Soap", 'Formula gallery slot', 'Owner-supplied mapped gallery files exist in uploads (17297_5_ncac.webp, 17300_8_ckj3.webp) — not yet staged.'],
    ['lavender-fairy-dream-soap', 'Lavender Fairy Dream Soap', 'Formula lifestyle-art slot', 'Owner-supplied mapped file exists in uploads (15936_29_wrls.webp) — not yet staged.'],
    ['orange-lily-goddess-soap', 'Orange Lily Goddess Soap', 'Formula photo slot — shape references staged'],
    ['sacred-forest-ritual-soap', 'Sacred Forest Ritual Soap', 'Formula photo slot — shape references staged'],
    ['sunlit-garden-bloom-soap', 'Sunlit Garden Bloom Soap', 'Formula photo slot — shape references staged'],
    ['warm-cinnamon-comfort-soap', 'Warm Cinnamon Comfort Soap', 'Formula photo slot — shape references staged'],
    ['alchemy-tea-blend', 'Alchemy Tea Blend', 'Product photo slot — tea'],
    ['custom-tea-blends', 'Custom Tea Blends', 'Product photo slot — tea'],
    ['soap-style-collection-5', 'The Alchemy Soap Collection', 'Bundle photo slot — 5-style set', 'No bundle photography on file; the old collage is archive-only (superseded prices baked in). Bundle price $35.77.'],
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
  // Dreamease owner-supplied jar photo: exists in uploads, not yet staged for the app.
  entries.push(
    missing(
      'slot_product_dreamease_capsules_photo',
      '/images/products/dreamease-capsules-photo.webp',
      'DreamEase Capsules — owner-supplied jar photo (MAPPED in v3, exists in uploads as 17291_1_etho.webp, not yet staged)',
      'Photo coming soon — DreamEase Capsules',
      'Product photo slot — capsules in amber jar',
      { slotKey: 'dreamease-capsules', notes: 'Real owner-supplied photo exists at ~/workspace/user/files/17291_1_etho.webp; stage into public/ to promote this slot to a real entry.' },
    ),
  );
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
