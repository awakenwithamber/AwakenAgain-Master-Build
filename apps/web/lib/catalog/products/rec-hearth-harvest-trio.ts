/**
 * HAND-AUTHORED record — not part of the canonical port (do not regenerate
 * away). Modeled field-for-field on rec-soap-style-collection-5.ts, the
 * bundle-record convention.
 * Source: Fall 2026 soap collection proposal §2, approved in full by the
 * owner on 2026-10-15 (workspace/goals/alchemy-soap-builder-experience/
 * files/fall-2026-soap-collection-proposal.md).
 * Status: price OWNER_CONFIRMED 2026-10-15; sku + inventory
 * NEEDS_VERIFICATION.
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Hearth & Harvest Trio",
  "handle": "hearth-harvest-trio",
  "sku": "SOAP-HEARTH-HARVEST-TRIO",
  "sku_status": "NEEDS_VERIFICATION",
  "category": "Bundles",
  "subcategory": "Soap Collections",
  "price": 26.77,
  "price_display": "$26.77",
  "compare_at_price": 35.31,
  "subscriber_price": 24.09,
  "price_status": "OWNER_CONFIRMED",
  "pricing_note": "Owner-confirmed bundle price $26.77 (approved 2026-10-15) under the canon per-shape prices (owner-confirmed 2026-10-19 — higher pricing wins): component sum is $35.31 (3 × Large Wave Rectangle at $11.77), so the bundle saves $8.54 (24.2%). All totals server-authoritative.",
  "sizes": [
    "3 bars (one of each member soap)"
  ],
  "variants": [
    {
      "variant_id": "hearth-harvest-trio-set",
      "name": "The Fall Trio",
      "size": "3 bars",
      "price": 26.77,
      "subscriber_price": 24.09,
      "currency": "USD",
      "sku": "SOAP-HEARTH-HARVEST-TRIO",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "customization": "Fixed set — no substitutions: Warm Cinnamon Comfort, Sacred Forest Ritual, and Gaia's Rose, each as a Large Wave Rectangle (4.5 oz) bar."
    }
  ],
  "images": [
    {
      "file": null,
      "role": "primary",
      "status": "MISSING_ASSET",
      "note": "No bundle photography on file. Do not present any member soap's shape reference as this bundle."
    }
  ],
  "short_description": "Three bars for the turning season.",
  "extended_description": "Three bars for the turning season. Warm Cinnamon Comfort opens with spice and a creamy goat-milk lather; Sacred Forest Ritual brings the green, grounding scent of rosemary and forest botanicals; Gaia's Rose closes with rose and hibiscus, the last of the garden. One for the kitchen sink, one for the shower, one for the guest bath — or all three for your own autumn ritual.",
  "featured_ingredients": [],
  "complete_ingredients": [],
  "traditional_uses": [],
  "properties": [],
  "member_products": [
    {
      "handle": "warm-cinnamon-comfort-soap",
      "title": "Warm Cinnamon Comfort Soap",
      "shape": "Large Wave Rectangle",
      "shape_id": "wave-rectangle",
      "size": "4.5 oz",
      "price": 11.77,
      "short_description": "A cozy cinnamon bar that wraps the skin in spice, warmth, and comfort."
    },
    {
      "handle": "sacred-forest-ritual-soap",
      "title": "Sacred Forest Ritual Soap",
      "shape": "Large Wave Rectangle",
      "shape_id": "wave-rectangle",
      "size": "4.5 oz",
      "price": 11.77,
      "short_description": "An earthy, grounding bar that turns your shower into a forest cleansing ritual."
    },
    {
      "handle": "gaias-rose-soap",
      "title": "Gaia’s Rose Soap",
      "shape": "Large Wave Rectangle",
      "shape_id": "wave-rectangle",
      "size": "4.5 oz",
      "price": 11.77,
      "short_description": "A romantic rose-and-hibiscus bar for goddess skin and heart-opening showers."
    }
  ],
  "formulation_rationale": "Fixed bundle of three catalog bars — Warm Cinnamon Comfort, Sacred Forest Ritual, and Gaia’s Rose — each in the Large Wave Rectangle style; formulas are those of the member soaps.",
  "process": "Handcrafted in small batches per the member soaps' records.",
  "directions": "Lather with water, cleanse, and rinse. Keep the bar dry between uses (a draining soap dish extends its life).",
  "warnings": "For external use only. Avoid contact with eyes. Discontinue use and rinse if irritation occurs. Patch test first if you have sensitive skin — cinnamon and clove are known skin sensitizers.",
  "allergens": "Contains goat milk (milk) and shea butter (from shea nut, a tree-nut botanical). Cinnamon and clove are known skin sensitizers — patch test before use and discontinue if irritation occurs. Herbal and floral components can be sensitizing for some people; patch test first if you have sensitive skin.",
  "storage": "Keep dry between uses on a draining soap dish.",
  "disclaimer": "Cosmetic product. These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "warm-cinnamon-comfort-soap",
    "sacred-forest-ritual-soap",
    "gaias-rose-soap",
    "soap-style-collection-5",
    "custom-botanical-soap"
  ],
  "frequently_bought_together": [],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": {},
  "tags": [
    "bundle",
    "soap",
    "collection",
    "fall-2026",
    "seasonal"
  ],
  "provenance": {
    "title": {
      "source_file": "Fall 2026 soap collection proposal §2 (owner-approved 2026-10-15)",
      "date": "2026-10-15",
      "note": "New bundle created per owner approval of the Fall 2026 collection proposal; members are existing catalog soaps at their confirmed per-shape prices."
    },
    "price": {
      "source_file": "Owner approval 2026-10-15 (Fall 2026 collection proposal §2)",
      "date": "2026-10-15",
      "note": "Bundle price $26.77 approved 2026-10-15; subscriber $24.09 at the standard 10% Grimoire discount. Component sum $35.31 (3 × $11.77 Large Wave Rectangle at the canon per-shape price, owner-confirmed 2026-10-19 — higher pricing wins); savings $8.54 (24.2%)."
    }
  },
  "field_verification": {
    "title": "OWNER_CONFIRMED",
    "price": "OWNER_CONFIRMED",
    "subscriber_price": "DERIVED_FROM_OWNER_PRICE",
    "variants": "OWNER_CONFIRMED",
    "member_products": "SOURCE_CATALOG_RECORDS",
    "images": "MISSING_ASSET",
    "inventory_status": "NEEDS_VERIFICATION"
  },
  "verification_status": "OWNER_CONFIRMED",
  "last_verified": "2026-10-15",
  "bundle_savings_computed": {
    "component_sum": 35.31,
    "bundle_price": 26.77,
    "savings_amount": 8.54,
    "savings_pct": 24.2,
    "method": "computed from canon per-shape prices (3 × Large Wave Rectangle $11.77, owner-confirmed 2026-10-19); server-authoritative"
  }
};
