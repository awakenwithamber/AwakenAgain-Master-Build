/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Custom Tea Blends",
  "handle": "custom-tea-blends",
  "sku": "AAA-CUSTOM-TEA-BLENDS",
  "category": "Teas",
  "subcategory": "Tea",
  "price": 11.99,
  "compare_at_price": null,
  "subscriber_price": 10.79,
  "sizes": "",
  "variants": [
    {
      "name": "Loose Leaf - 1 oz",
      "sku": "AAA- CUSTOMTEABLENDS-1OZ",
      "price": 13.33,
      "unit": "1 oz loose leaf",
      "requires_shipping": true,
      "fulfillment": "ship"
    },
    {
      "name": "Custom Tea Bags - Pack of 20",
      "sku": "AAA- CUSTOMTEABLENDS-20BAG",
      "price": 11.99,
      "unit": "20 tea bags",
      "requires_shipping": true,
      "fulfillment": "ship"
    }
  ],
  "tags": [],
  "images": [],
  "short_description": "A personalized tea blend crafted around your taste, wellness goals, and preferred ritual: calming, energizing, digestion, glow, or seasonal support.",
  "extended_description": "A personalized tea blend crafted around your taste, wellness goals, and preferred ritual: calming, energizing, digestion, glow, or seasonal support. You share your flavor preferences and the kind of ritual you want, and Amber blends a custom loose-leaf or bagged tea from the apothecary's herb selection. How the preference/intake step works is not detailed in the source and is flagged NEEDS_VERIFICATION.",
  "featured_ingredients": [],
  "complete_ingredients": "Ingredients vary by customer profile and selected intention. (Sourced verbatim.)",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Personalized herbal support",
      "evidence_context": "not_applicable",
      "note": "Service feature from source, not an efficacy claim."
    },
    {
      "property": "Beautiful daily ritual",
      "evidence_context": "not_applicable",
      "note": "Service feature from source; ritual framing."
    },
    {
      "property": "Available loose or in tea bags",
      "evidence_context": "not_applicable",
      "note": "Format options from source."
    },
    {
      "property": "Made around customer preferences",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    }
  ],
  "formulation_rationale": "Template/customization framework: the blend is built around the customer's taste, wellness goals, and preferred ritual direction (calming, energizing, digestion, glow, or seasonal support — sourced). No base ingredients are named in the source, so no featured ingredients are assigned; the framework is described rather than a fixed formula.",
  "process": "Blended to order from customer preferences (sourced concept). The intake mechanism, blending method, batch documentation, and quality steps are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "How it works: share your taste preferences, wellness goals, and preferred ritual direction at order time; your custom blend is made around them. Steeping: loose leaf — steep 1–2 tsp for 10–15 minutes; tea bags — steep 1 bag for 8–12 minutes. (Steeping instructions sourced verbatim; the preference-collection step is described at framework level — exact intake flow NEEDS_VERIFICATION.)",
  "warnings": [
    "If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. (Sourced.)",
    "Keep out of reach of children. (Sourced.)",
    "Allergen profile NEEDS_VERIFICATION — ingredients vary per customer blend; review the finished label before use.",
    "Individual experiences vary."
  ],
  "allergens": "NEEDS_VERIFICATION — ingredients vary per customer blend; confirm finished-formula allergen statement with owner before publication.",
  "storage": "Store in a cool, dry place away from direct light — standard care for loose-leaf tea. Packaging-specific storage instructions are not published in the source and are flagged NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "related_products": [
    "alchemy-tea-blend",
    "custom-remedy-consultation",
    "personalized-herbal-protocols"
  ],
  "frequently_bought_together": [
    "alchemy-tea-blend",
    "custom-herbal-capsules"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "provenance": {
    "sources": [
      "catalog.master.json (AwakenAgain_Merged_Master_Catalog, merged master catalog)"
    ],
    "price_authority": "Owner-approved price list 2026-10-04 (parent task)",
    "image_source": "IMAGE_MAP.md + image_manifest.csv (no product image mapped for these 6 handles)",
    "last_verified": "2026-10-04",
    "notes": [
      "Handle preserved as canonical ID.",
      "TEMPLATE PRODUCT — no fixed formula; featured_ingredients intentionally empty per binding rules (source names no base ingredients).",
      "Legacy variant prices (Loose Leaf 1 oz $13.33; Tea Bags 20-pack $11.99) are legacy-sourced; base price $11.99 per owner price authority.",
      "Preference/intake flow not detailed in source — flagged, not invented."
    ]
  },
  "field_verification": {
    "price": "VERIFIED — owner price authority 2026-10-04",
    "featured_ingredients": "TEMPLATE_PRODUCT — source names no base ingredients; intentionally empty, not an omission",
    "complete_ingredients": "SOURCED — 'Ingredients vary by customer profile and selected intention'",
    "traditional_uses": "NOT_APPLICABLE — template product; no fixed formula",
    "images": "MISSING_ASSET — no product image mapped in IMAGE_MAP.md or image_manifest.csv; catalog image fields point to /images/products/custom-tea-blends.webp/.png which are catalog-safe generated fallbacks (image_status: placeholder)",
    "variants": "LEGACY-SOURCED — variant prices from catalog.master.json; owner confirmation recommended",
    "process": "NEEDS_VERIFICATION — intake/blending workflow not detailed in source",
    "allergens": "NEEDS_VERIFICATION",
    "storage": "GENERAL-GUIDANCE — standard tea care; packaging-specific instructions NEEDS_VERIFICATION",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-05"
};
