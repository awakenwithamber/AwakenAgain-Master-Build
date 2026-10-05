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
  "pricing_note": "Owner-confirmed $35.77 (revised 2026-10-05, was $55). Component sum at current per-shape prices = $47.85; bundle saves $12.08 (25.2%) — savings may be displayed ONLY from these computed values. All totals server-authoritative.",
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
      "src": null,
      "role": "primary",
      "asset_status": "MISSING_ASSET",
      "note": "No bundle photography on file; collage image 15316_227_zkei.jpg carries superseded prices and is archive-only. Regeneration required before storefront use."
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
    "images": "MISSING_ASSET",
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
