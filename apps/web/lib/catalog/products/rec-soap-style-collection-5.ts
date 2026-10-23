/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "The Alchemy Soap Collection",
  "handle": "soap-style-collection-5",
  "sku": "SOAP-STYLE-COLLECTION-5",
  "sku_status": "NEEDS_VERIFICATION",
  "category": "Bundles",
  "subcategory": "Soap Collections",
  "price": 35.77,
  "price_display": "$35.77",
  "compare_at_price": 47.85,
  "subscriber_price": 32.19,
  "price_status": "OWNER_CONFIRMED",
  "pricing_note": "Bundle price $35.77 owner-confirmed (2026-10-05; confirmed 2026-10-19 under the canon per-shape prices — higher pricing wins). Component sum $47.85 (5.77 + 8.77 + 9.77 + 11.77 + 11.77); savings $12.08 (25.2%), displayed ONLY from these computed values. All totals server-authoritative.",
  "sizes": [
    "5 bars (one per style)"
  ],
  "variants": [
    {
      "variant_id": "soap-style-collection-5-set",
      "name": "One of Each Style",
      "size": "5 bars",
      "price": 35.77,
      "subscriber_price": 32.19,
      "currency": "USD",
      "sku": "SOAP-STYLE-COLLECTION-5",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "customization": "Customer picks scent/color/herbs/botanical for EACH of the 5 soaps: Small Rose (2 oz), Medium Rose (3 oz), Large Plain Rectangle (4 oz), Large Wave Rectangle (4.5 oz), Large Floral Round (4.5 oz). Exact doTERRA scent list NEEDS_VERIFICATION."
    }
  ],
  "images": [
    {
      "src": "/images/soap/soap-lineup-5.png",
      "alt": "The Alchemy Soap Collection — the five double-layer soap styles in a row: small red rose, larger green rose, purple wave rectangle, green floral round, red plain rectangle (illustrated representation)",
      "role": "primary",
      "asset_status": "GENERATED_REPRESENTATION",
      "note": "Deployed storefront primary. The file is the AI-generated five-bar lineup registered in lib/media/image-manifest.ts as asset_soap_lineup_5 (GENERATED_PRODUCT_REPRESENTATION, notDocumentaryPhoto) — a generated representation with no text or prices baked in, NOT bundle photography. No bundle photography on file; collage image 15316_227_zkei.jpg carries superseded prices and is archive-only. Corrected 2026-10-13: the record formerly claimed MISSING_ASSET with src null while this registered lineup file was already deployed."
    },
    {
      "src": "/images/soap/soap-collection-grid.png",
      "alt": "The Alchemy Soap Collection grid — the five soap styles with sizes and prices: Small Rose 2 oz $5.77, Medium Rose 3 oz $8.77, Classic Chic Rectangle 4 oz $9.77, Large Floral Round 4.5 oz $11.77, Wave Art Rectangle 4.5 oz $11.77 (illustrated representation)",
      "role": "gallery",
      "asset_status": "GENERATED_REPRESENTATION",
      "note": "Promo grid for the Collection's five styles. Regenerated 2026-10-22 from the owner's collection-grid upload with all ten baked-in sizes/prices corrected to canon and verified string-by-string; owner approved deployment 2026-10-23. Registered in lib/media/image-manifest.ts as asset_soap_collection_grid (GENERATED_PRODUCT_REPRESENTATION, notDocumentaryPhoto). Renders in the Bundle section of /soap-shop. The primary representation above remains the text-free lineup."
    }
  ],
  "short_description": "All five soap styles in one collection — you choose the scent, color, herbs, or botanical character of each bar.",
  "extended_description": "One bar in each of the five styles: Small Rose (2 oz), Medium Rose (3 oz), Large Plain Rectangle (4 oz), Large Wave Rectangle (4.5 oz), and Large Floral Round (4.5 oz). For each soap you pick the formula/scent, color, and herbs or botanical inclusions from what is offered. Scent uses doTERRA essential oils; exact scent list is being verified. No savings claim applies to this bundle.",
  "featured_ingredients": [],
  "complete_ingredients": [],
  "traditional_uses": [],
  "properties": [],
  "formulation_rationale": "Bundle of the five soap styles; formulas are those of the selected soaps.",
  "process": "Small-batch botanical soap preparation per the selected formulas.",
  "directions": "Use as a cleansing bar; avoid eyes.",
  "warnings": "For external use only. Discontinue use if irritation occurs.",
  "allergens": "Varies by selected formula — check each soap.",
  "storage": "Keep dry between uses on a draining soap dish.",
  "disclaimer": "Cosmetic product. These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "citrus-goddess-glow-soap",
    "eucalyptus-mint-spa-renewal-soap",
    "fresh-mountain-air-soap",
    "gaias-rose-soap",
    "lavender-fairy-dream-soap",
    "orange-lily-goddess-soap",
    "sacred-forest-ritual-soap",
    "sunlit-garden-bloom-soap",
    "warm-cinnamon-comfort-soap",
    "custom-botanical-soap"
  ],
  "frequently_bought_together": [],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": {},
  "tags": [
    "bundle",
    "soap",
    "collection",
    "five-styles"
  ],
  "provenance": {
    "title": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "New bundle created per owner directive 2026-10-05; replaces full-soap-collection (9-bar, $99.99)."
    },
    "price": {
      "source_file": "Owner directive 2026-10-05 (bundle price revision)",
      "date": "2026-10-05",
      "note": "Bundle price changed $55 -> $35.77 per owner; savings now genuine and computed."
    }
  },
  "field_verification": {
    "title": "OWNER_CONFIRMED",
    "price": "OWNER_CONFIRMED",
    "variants": "OWNER_CONFIRMED",
    "images": "GENERATED_REPRESENTATION — deployed generated lineup registered as asset_soap_lineup_5 in lib/media/image-manifest.ts; no bundle photography on file (corrected 2026-10-13)",
    "inventory_status": "NEEDS_VERIFICATION"
  },
  "verification_status": "OWNER_CONFIRMED",
  "last_verified": "2026-10-05",
  "bundle_savings_computed": {
    "component_sum": 47.85,
    "bundle_price": 35.77,
    "savings_amount": 12.08,
    "savings_pct": 25.2,
    "method": "computed from current per-shape prices; server-authoritative"
  },
  "customization_options": {
    "scent_paths": [
      "signature_13",
      "custom_blend_1_to_3_oils"
    ],
    "blendable_oils": [
      "lavender",
      "lemon",
      "peppermint",
      "tea_tree",
      "frankincense",
      "geranium",
      "rose",
      "patchouli",
      "cedarwood",
      "jasmine",
      "vanilla_mimic",
      "coconut"
    ],
    "max_blend_oils": 3,
    "order_record_rule": "Store exact oil IDs for custom blends; recipe_id for signature scents. Never store the words \"custom scent\".",
    "applies_to": "each of the 5 individually customizable soap slots"
  }
};
