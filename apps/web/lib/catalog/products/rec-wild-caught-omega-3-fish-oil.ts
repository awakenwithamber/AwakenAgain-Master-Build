/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Wild-Caught Omega-3 Fish Oil",
  "handle": "wild-caught-omega-3-fish-oil",
  "sku": "OMEGA3-001",
  "category": "Capsules",
  "subcategory": "Foundational Wellness",
  "price": 54.77,
  "compare_at_price": null,
  "subscriber_price": 49.29,
  "sizes": [
    "1 bottle (capsule count not established in source materials)"
  ],
  "variants": [
    {
      "variant_id": "wild-caught-omega-3-fish-oil-bottle",
      "name": "Bottle",
      "size": "1 bottle (capsule count not established in source materials)",
      "weight": null,
      "price": 54.77,
      "subscriber_price": 49.29,
      "currency": "USD",
      "sku": "OMEGA3-001",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "Explicit owner exception to standard capsule pricing."
    }
  ],
  "images": [
    {
      "src": "/images/products/wild-caught-omega-3-fish-oil.webp",
      "alt": "Wild-Caught Omega-3 Fish Oil supplement bottle",
      "role": "primary",
      "asset_status": "MISSING_ASSET",
      "note": "Mapped in baseline as 'catalog-safe generated fallback' placeholder; no real product photography on file. EXPLICITLY NOT the mislabeled 'Natural Collagen Booster' image — that image must never be paired with this product."
    }
  ],
  "short_description": "A source of omega-3 fatty acids for general nutritional support.",
  "extended_description": "Wild-Caught Omega-3 Fish Oil provides omega-3 fatty acids as part of a balanced nutrition routine. Omega-3 fatty acids are foundational dietary fats that play a nutritional role in a balanced diet, and this simple daily softgel-style routine makes them easy to include alongside balanced meals. Individual experiences vary. Free shipping on orders of $45 or more (always free for Living Grimoire subscribers).",
  "featured_ingredients": [
    {
      "name": "Wild-Caught Omega-3 Fish Oil",
      "botanical_name": "Not applicable (fish-derived oil)",
      "part_used": "fish body oil",
      "role_in_formula": "Sole ingredient",
      "traditional_use": "Omega-3 fatty acids are a long-recognized part of balanced human nutrition.",
      "properties": "Contains naturally occurring omega-3 fatty acids; provides general nutritional support.",
      "key_constituents": null,
      "evidence_context": "nutritional_function",
      "customer_friendly_summary": "A simple source of omega-3 fatty acids for everyday nutritional support."
    }
  ],
  "complete_ingredients": "Wild-caught omega-3 fish oil",
  "traditional_uses": [],
  "properties": {
    "nutritional": {
      "description": "Provides omega-3 fatty acids for general nutritional support.",
      "evidence_context": "nutritional_function"
    },
    "foundational": {
      "description": "Omega-3 fatty acids are foundational dietary fats in a balanced nutrition routine.",
      "evidence_context": "nutritional_function"
    }
  },
  "formulation_rationale": "Not established in source materials.",
  "process": "Not established in source materials.",
  "directions": "Not established in source materials. No usage instructions, capsule count, or serving size were provided in the baseline catalog; owner to confirm.",
  "warnings": "Contains fish. If you are pregnant, nursing, taking blood-thinning or other medications, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "allergens": "Contains fish (stated in baseline allergen_statement and disclaimer).",
  "storage": "Not established in source materials.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children. Allergen: Contains fish.",
  "related_products": [
    "metabolic-wellness-formula",
    "environmental-wellness-support",
    "immune-at-ease-capsules"
  ],
  "frequently_bought_together": [
    "metabolic-wellness-formula"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "provenance": {
    "title": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "From baseline catalog.master.json (source: automation_json)."
    },
    "price": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "Owner directive 2026-10-05: Wild-Caught Omega-3 = $54.77 (explicit exception). Supersedes prior $24.99 (was $24.99). Server-authoritative."
    },
    "ingredients": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Baseline key_botanicals and ingredients both list only 'Wild-caught omega-3 fish oil' as the single ingredient. SHORTFALL: only one verifiable ingredient exists, so the featured-ingredients list contains one entry instead of five. Specific fish species, EPA/DHA amounts, and capsule count are not in source materials."
    },
    "directions": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "The baseline instructions field is EMPTY for this product. Directions, capsule count, and serving size marked NEEDS_VERIFICATION; nothing invented."
    },
    "images": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Baseline image_status: 'placeholder' / 'catalog-safe generated fallback'. The mislabeled 'Natural Collagen Booster' image is explicitly excluded from this product."
    },
    "disclaimer": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Standard FDA supplement disclaimer present in baseline, including the fish allergen statement."
    },
    "compliance": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "baseline compliance_rewrite_applied=true; legacy high-risk claim removed per claim review note."
    }
  },
  "field_verification": {
    "title": "CURRENT",
    "price": "OWNER_CONFIRMED",
    "sizes": "NEEDS_VERIFICATION",
    "variants": "OWNER_CONFIRMED",
    "images": "NEEDS_VERIFICATION",
    "short_description": "CURRENT",
    "extended_description": "CURRENT",
    "featured_ingredients": "NEEDS_VERIFICATION",
    "complete_ingredients": "CURRENT",
    "traditional_uses": "CURRENT",
    "properties": "CURRENT",
    "formulation_rationale": "NEEDS_VERIFICATION",
    "process": "NEEDS_VERIFICATION",
    "directions": "NEEDS_VERIFICATION",
    "warnings": "CURRENT",
    "allergens": "CURRENT",
    "storage": "NEEDS_VERIFICATION",
    "disclaimer": "CURRENT",
    "related_products": "PROPOSED",
    "frequently_bought_together": "PROPOSED",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "CURRENT"
  },
  "last_verified": "2026-10-05",
  "tags": []
};
