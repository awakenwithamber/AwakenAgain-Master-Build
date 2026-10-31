/**
 * HAND-AUTHORED — not part of the generated catalog port.
 * Appended 2026-10-30 at the owner's direction (Custom Balm Builder,
 * owner-approved 2026-10-30), mirroring the structure of
 * rec-custom-tea-blends.ts (the other template/custom product record).
 *
 * PRICE GROUNDING: every variant price mirrors the two balm records
 * EXACTLY (rec-radiance-renewal-balm.ts / rec-soothe-restore-botanical-balm.ts):
 * 1 oz $11.77, 2 oz $23.54, 3 oz $35.31, 4 oz $47.08 — owner-approved
 * $11.77/oz. Per the owner's 2026-10-30 wax ruling, each size is offered
 * in both finishes at the IDENTICAL price: Soy Wax (standard) and
 * Beeswax (soy-free alternative). Soy variants carry SKUs; beeswax
 * variants are identified by name with sku null — the same convention
 * the balm records use.
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Custom Botanical Balm",
  "handle": "custom-botanical-balm",
  "sku": "CUSTOM-BALM-001",
  "category": "Balms & Skincare",
  "subcategory": "Custom Formulas",
  "price": 11.77,
  "compare_at_price": null,
  "subscriber_price": 10.59,
  "price_flag": "owner_approved_1oz",
  "sizes": [
    "1 oz",
    "2 oz",
    "3 oz",
    "4 oz"
  ],
  "variants": [
    {
      "name": "1 oz pocket size — Soy Wax (standard)",
      "size": "1 oz",
      "sku": "CUSTOM-BALM-001-1OZ",
      "price": 11.77
    },
    {
      "name": "1 oz pocket size — Beeswax (soy-free alternative)",
      "size": "1 oz",
      "sku": null,
      "price": 11.77
    },
    {
      "name": "2 oz — Soy Wax (standard)",
      "size": "2 oz",
      "sku": "CUSTOM-BALM-001-2OZ",
      "price": 23.54
    },
    {
      "name": "2 oz — Beeswax (soy-free alternative)",
      "size": "2 oz",
      "sku": null,
      "price": 23.54
    },
    {
      "name": "3 oz — Soy Wax (standard)",
      "size": "3 oz",
      "sku": "CUSTOM-BALM-001-3OZ",
      "price": 35.31
    },
    {
      "name": "3 oz — Beeswax (soy-free alternative)",
      "size": "3 oz",
      "sku": null,
      "price": 35.31
    },
    {
      "name": "4 oz — Soy Wax (standard)",
      "size": "4 oz",
      "sku": "CUSTOM-BALM-001-4OZ",
      "price": 47.08
    },
    {
      "name": "4 oz — Beeswax (soy-free alternative)",
      "size": "4 oz",
      "sku": null,
      "price": 47.08
    }
  ],
  "images": [],
  "short_description": "A personalized botanical balm crafted around your preferences — your choice of finish, botanicals, scent, and ritual — in the apothecary's slow-infusion tradition.",
  "extended_description": "A personalized botanical balm crafted around your preferences. Choose the finish (soy wax, the standard, or beeswax, the soy-free alternative), choose botanicals drawn from the apothecary's own balms and serum, choose a scent you love, and tell Amber the ritual it is for — your personalized formula is made to order, one jar at a time.",
  "featured_ingredients": [],
  "complete_ingredients": "Ingredients vary by customer selections. Every custom balm begins the slow way: your chosen botanicals steeped in coconut oil, finished with your choice of soy wax (standard) or beeswax (soy-free alternative).",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Personalized formula, made to order",
      "evidence_context": "not_applicable",
      "note": "Service feature, not an efficacy claim."
    },
    {
      "property": "Your choice of finish: soy wax (standard) or beeswax (soy-free alternative), at the same price",
      "evidence_context": "not_applicable",
      "note": "Owner ruling 2026-10-30."
    },
    {
      "property": "Botanicals drawn from the apothecary's own balms and serum",
      "evidence_context": "not_applicable",
      "note": "Grounded selection — see lib/custom-formula/balm.ts."
    },
    {
      "property": "Made around your scent and ritual preferences",
      "evidence_context": "not_applicable",
      "note": "Service feature; preference framing only."
    }
  ],
  "formulation_rationale": "Template/customization framework: the balm is built around the customer's finish, botanical, scent, and ritual preferences in the Custom Balm Builder (/custom-formula/balm). No fixed formula is published; botanicals are limited to the featured ingredients of the apothecary's existing balm and serum records that also appear in the herb library.",
  "process": "Made to order following the balm records' own method (page_banner): botanicals steeped in coconut oil at a low temperature for a full 36 hours, strained, and finished with the customer's chosen wax.",
  "directions": "How it works: build your balm at /custom-formula/balm — choose your finish, botanicals, scent preference, intended ritual, and size; Amber crafts your personalized formula to order. Apply a thin layer to clean skin as needed. Patch test first for sensitive skin.",
  "warnings": "For external use only. Avoid contact with eyes, mucous membranes, open wounds, and sensitive areas. Patch test before use. Discontinue use if irritation occurs. This cosmetic/topical product is not intended to diagnose, treat, cure, or prevent any disease. Keep out of reach of children. Standard finish contains soy wax (soy). A beeswax finish is available instead for customers avoiding soy — that version contains beeswax (a bee product).",
  "allergens": "Contains coconut oil. The standard finish contains soy wax (soy) — individuals with soy sensitivities should choose the beeswax finish and patch test. The beeswax-finish alternative contains a bee product instead of soy — individuals with bee-product sensitivities should choose the standard soy-wax finish and patch test. Derived from the balm records' ingredient lists only — review your finished label before use.",
  "storage": "Store sealed in a cool, dry place away from direct sunlight. Per the balm records: it will soften and melt at 75° or higher.",
  "disclaimer": "For external use only. Avoid contact with eyes, mucous membranes, open wounds, and sensitive areas. Patch test before use. Discontinue use if irritation occurs. This cosmetic/topical product is not intended to diagnose, treat, cure, or prevent any disease. Keep out of reach of children.",
  "related_products": [
    "radiance-renewal-balm",
    "soothe-restore-botanical-balm",
    "root-scalp-revival-serum"
  ],
  "frequently_bought_together": [
    "radiance-renewal-balm",
    "soothe-restore-botanical-balm"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "tags": [
    "Balms & Skincare",
    "custom balm",
    "personalized balm",
    "build your own",
    "botanical balm"
  ],
  "provenance": {
    "sources": [
      "Owner approval 2026-10-30 (Custom Balm Builder + wax ruling)",
      "rec-radiance-renewal-balm.ts (variant prices, wax wording, page_banner)",
      "rec-soothe-restore-botanical-balm.ts (variant prices, wax wording)",
      "rec-custom-tea-blends.ts (template-product record structure)"
    ],
    "price_authority": "Mirrored from the balm records' owner-approved $11.77/oz pricing (2026-10-04; wax ruling 2026-10-30) — no new price created.",
    "last_verified": "2026-10-30",
    "notes": [
      "TEMPLATE PRODUCT — no fixed formula; featured_ingredients intentionally empty (botanicals vary by customer selections, grounded in lib/custom-formula/balm.ts).",
      "Record sku CUSTOM-BALM-001 and soy-variant SKUs are new identifiers created for this record, following the balm records' SKU pattern; beeswax variants carry sku null, as on the balm records.",
      "No product image mapped — images intentionally empty, as on rec-custom-tea-blends."
    ]
  },
  "field_verification": {
    "price": "MIRRORED — balm records' owner-approved $11.77/oz variant prices",
    "featured_ingredients": "TEMPLATE_PRODUCT — botanicals vary by customer selections; intentionally empty, not an omission",
    "complete_ingredients": "FRAMEWORK — varies by customer selections; base method from the balm records",
    "traditional_uses": "NOT_APPLICABLE — template product; no fixed formula",
    "images": "MISSING_ASSET — no product image mapped; intentionally empty",
    "variants": "MIRRORED — every size in both finishes at identical prices, per the balm records + owner wax ruling 2026-10-30",
    "process": "SOURCED — the balm records' page_banner method",
    "allergens": "MIRRORED — both finishes disclosed in both directions, per the balm records",
    "storage": "SOURCED — balm records' storage/banner guidance",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-30",
  "page_banner": "Every balm begins the slow way: botanicals steeped in coconut oil at a low temperature for a full 36 hours, so the properties of each plant are drawn gently into the oil for maximum infusion. The herbs are then strained away, and soy wax is blended in for a smooth, balanced texture. Keep your balm stored in a cool, dry place — it will soften and melt at 75° or higher."
};
