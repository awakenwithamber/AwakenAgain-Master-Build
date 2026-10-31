/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Mega Omegas",
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
      "alt": "Mega Omegas supplement bottle",
      "role": "primary",
      "asset_status": "GENERATED_REPRESENTATION",
      "note": "Regenerated standalone Omega-3 graphic placed 2026-10-30 (regen-82b): baked-in health-claim text removed. It is not the composite and not the mislabeled 'Natural Collagen Booster' jar image, which must never be paired with this product. Generated representation — not real product photography."
    }
  ],
  "short_description": "One ingredient, honestly named: wild-caught sardines, dried and capsuled — nothing else in the bottle.",
  "extended_description": "Some bottles hold a whole apothecary shelf. This one holds exactly one ingredient, and it says so on the label: wild-caught sardines, dried and capsuled. No blends, no fillers, no mystery dust — just a small silvery fish, prepared the simple way and sealed into a capsule in small batches here in Salt Lake City. Mega Omegas is the apothecary's single-ingredient staple for the daily shelf: catch, dry, capsule, done. Free shipping on orders of $45 or more (always free for Living Grimoire subscribers).",
  "featured_ingredients": [
    {
      "name": "Wild-Caught Sardines",
      "botanical_name": "Not applicable (fish-derived)",
      "part_used": "whole fish, dried",
      "role_in_formula": "Sole ingredient",
      "traditional_use": "Sardines are a long-recognized whole food in traditional coastal diets.",
      "properties": "A single-ingredient whole-food capsule — wild-caught sardines, dried and capsuled, with nothing added.",
      "key_constituents": null,
      "evidence_context": "nutritional_function",
      "customer_friendly_summary": "One ingredient, honestly named: wild-caught sardines, dried and capsuled."
    }
  ],
  "complete_ingredients": "Wild-caught sardines, dried and capsuled",
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
  "allergens": "Contains fish (sardines).",
  "storage": "Not established in source materials.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children. Allergen: Contains fish (sardines).",
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
      "source_file": "Owner directive 2026-10-30",
      "date": "2026-10-30",
      "note": "Renamed from 'Wild-Caught Omega-3 Fish Oil' to 'Mega Omegas' at the owner's direction (Omega-3/Collagen split). Handle 'wild-caught-omega-3-fish-oil' kept stable so existing links survive."
    },
    "price": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "Owner directive 2026-10-05: Wild-Caught Omega-3 = $54.77 (explicit exception). Supersedes prior $24.99 (was $24.99). Server-authoritative."
    },
    "ingredients": {
      "source_file": "Owner directive 2026-10-30",
      "date": "2026-10-30",
      "note": "Owner ruling 2026-10-30: the sole ingredient is wild-caught sardines, dried and capsuled. Supersedes the baseline single-ingredient line 'Wild-caught omega-3 fish oil'. Specific catch details, EPA/DHA amounts, and capsule count are not in source materials."
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
