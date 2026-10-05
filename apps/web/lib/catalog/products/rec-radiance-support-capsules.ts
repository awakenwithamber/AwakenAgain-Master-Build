/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Radiance Support Capsules",
  "handle": "radiance-support-capsules",
  "sku": "CAP-COLLAGEN-001",
  "category": "Balms & Skincare",
  "subcategory": "Beauty & Skin",
  "price": 19.77,
  "compare_at_price": null,
  "subscriber_price": 17.79,
  "price_flag": "owner_override",
  "price_note": "Owner EXPLICITLY overrode baseline: 30-day capsule products $34.47; do not fall back to older $27.99/$28.99 pricing. Baseline catalog.master.json (2026-09-27) listed $27.99.",
  "sizes": [
    "2-week supply",
    "30-day supply (30 capsules)"
  ],
  "variants": [
    {
      "variant_id": "radiance-support-capsules-2wk",
      "name": "2-Week Supply",
      "size": "2-week supply",
      "weight": null,
      "price": 19.77,
      "subscriber_price": 17.79,
      "currency": "USD",
      "sku": "CAP-COLLAGEN-001-2WK",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "2-week capsule count not established in sources; size offered per owner directive."
    },
    {
      "variant_id": "radiance-support-capsules-30d",
      "name": "30-Day Supply",
      "size": "30-day supply (30 capsules)",
      "weight": null,
      "price": 47.77,
      "subscriber_price": 42.99,
      "currency": "USD",
      "sku": "CAP-COLLAGEN-001-30D",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "30-capsule count from Sept 27 baseline where established; price per owner directive."
    }
  ],
  "images": [
    {
      "url": "/images/products/radiance-support-capsules.webp",
      "alt_text": "Radiance Support Capsules — in amber jar",
      "status": "MISSING_ASSET",
      "note": "catalog-safe generated fallback placeholder per baseline image_verification; no real product photo on file"
    },
    {
      "url": "/images/products/radiance-support-capsules.png",
      "alt_text": "Radiance Support Capsules — in amber jar",
      "status": "MISSING_ASSET",
      "note": "fallback variant of generated placeholder; no real product photo on file"
    }
  ],
  "short_description": "A botanical beauty blend supporting skin vitality, hydration, and normal collagen formation.",
  "extended_description": "Radiance Support Capsules are a botanical beauty blend selected to support skin vitality, hydration, and the body's normal collagen-forming processes — beauty support from within. The formula centers on vitamin-C-rich and mineral-rich botanicals such as hibiscus, rose hips, nettle, and oatstraw, with chamomile, lavender, and lemon peel. Vitamin C is an essential nutrient the body uses in normal collagen formation. Best results come with daily use, consistent hydration, and whole-food nutrition. Individual experiences vary. These statements have not been evaluated by the Food and Drug Administration; this product is not intended to diagnose, treat, cure, or prevent any disease.",
  "featured_ingredients": [
    {
      "name": "Hibiscus",
      "botanical_name": "Hibiscus sabdariffa (standard taxonomy; not owner-specified)",
      "part_used": "calyx (part not stated in source)",
      "role_in_formula": "vitamin-C-rich botanical in the beauty blend",
      "traditional_use": "Traditionally consumed as a tart, refreshing herbal infusion.",
      "properties": "Contains naturally occurring vitamin C and plant compounds; vitamin C is an essential nutrient used by the body in normal collagen formation.",
      "key_constituents": [],
      "evidence_context": "nutritional_function",
      "customer_friendly_summary": "A tart, ruby-red botanical traditionally enjoyed as an infusion and valued for its naturally occurring vitamin C."
    },
    {
      "name": "Rose Hips",
      "botanical_name": "Rosa canina (standard taxonomy; not owner-specified)",
      "part_used": "fruit/hips (part not stated in source)",
      "role_in_formula": "vitamin-C-rich botanical in the beauty blend",
      "traditional_use": "Traditionally consumed as a nourishing fruit of the rose plant.",
      "properties": "Contains naturally occurring vitamin C; vitamin C contributes to normal collagen formation as part of normal nutrition.",
      "key_constituents": [],
      "evidence_context": "nutritional_function",
      "customer_friendly_summary": "The fruit of the rose, traditionally valued as a nourishing source of naturally occurring vitamin C."
    },
    {
      "name": "Nettle",
      "botanical_name": "Urtica dioica (standard taxonomy; not owner-specified)",
      "part_used": "leaf (part not stated in source)",
      "role_in_formula": "mineral-rich green botanical in the beauty blend",
      "traditional_use": "Traditionally consumed as a nourishing spring green and herbal infusion.",
      "properties": "Contains naturally occurring minerals; traditionally used as a nutritive herb.",
      "key_constituents": [],
      "evidence_context": "mixed_with_note",
      "evidence_note": "nutritional_function + traditional_use",
      "customer_friendly_summary": "A traditional nutritive green, long used as a nourishing herbal infusion."
    },
    {
      "name": "Oatstraw",
      "botanical_name": "Avena sativa (standard taxonomy; not owner-specified)",
      "part_used": "straw/aerial parts (part not stated in source)",
      "role_in_formula": "mineral-rich botanical in the beauty blend",
      "traditional_use": "Traditionally consumed as a nourishing herbal infusion.",
      "properties": "Contains naturally occurring minerals; traditionally used as a nutritive herb.",
      "key_constituents": [],
      "evidence_context": "mixed_with_note",
      "evidence_note": "nutritional_function + traditional_use",
      "customer_friendly_summary": "The straw of the oat plant, traditionally used as a gentle nutritive infusion."
    },
    {
      "name": "Chamomile",
      "botanical_name": "Matricaria chamomilla (standard taxonomy; not owner-specified)",
      "part_used": "flowers (part not stated in source)",
      "role_in_formula": "traditional calming botanical in the beauty blend",
      "traditional_use": "Traditionally consumed as a calming herbal infusion.",
      "properties": "Traditionally used for its calming, soothing character.",
      "key_constituents": [],
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A familiar calming flower, traditionally enjoyed as a soothing herbal infusion."
    }
  ],
  "complete_ingredients": "Hibiscus, rose hips, nettle, oatstraw, horsetail-style silica herbs where available, vitamin C-rich botanicals, chamomile, lavender, lemon peel, and mineral-rich plants.",
  "traditional_uses": [
    "Hibiscus, rose hips, nettle, oatstraw, and chamomile have long traditional histories as nourishing herbal infusions.",
    "Vitamin-C-rich fruits like rose hips are traditionally valued for nutritional support of skin and connective tissue."
  ],
  "properties": [
    {
      "property": "Supports skin vitality as part of daily nutrition",
      "evidence_context": "nutritional_function"
    },
    {
      "property": "Supports the body's normal collagen-forming processes (vitamin C is an essential nutrient used in collagen formation)",
      "evidence_context": "nutritional_function"
    },
    {
      "property": "Promotes hydration alongside consistent water intake",
      "evidence_context": "nutritional_function"
    },
    {
      "property": "Botanicals traditionally used as nourishing infusions (nettle, oatstraw, chamomile)",
      "evidence_context": "traditional_use"
    }
  ],
  "formulation_rationale": "Not established in source materials.",
  "formulation_rationale_flag": "NEEDS_VERIFICATION",
  "process": "Not established in source materials.",
  "process_flag": "NEEDS_VERIFICATION",
  "directions": "Take daily with water and consistent hydration. Best results come with daily use and whole-food nutrition. Do not exceed suggested use (suggested serving not stated in source materials — NEEDS_VERIFICATION).",
  "warnings": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children. Consult a qualified healthcare professional before use if you are pregnant, nursing, taking medication (including diuretics or blood-pressure medication — nettle is traditionally used as a diuretic herb), or have a medical condition. Contains chamomile (Asteraceae family); those with ragweed-family sensitivities should consult a professional first. Keep out of reach of children.",
  "allergens": "Contains chamomile (Asteraceae/ragweed family). Formula is described as containing mineral-rich and vitamin-C-rich botanicals; full allergen profile not established. Derived from ingredient list only — not a verified allergen statement.",
  "storage": "Store sealed in a cool, dry place away from direct sunlight. General guidance; not specified in source materials. NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "related_products": [
    "radiance-renewal-balm",
    "wild-caught-omega-3-fish-oil",
    "metabolic-wellness-formula",
    "gaias-rose-soap",
    "alchemy-tea-blend"
  ],
  "frequently_bought_together": [
    "radiance-renewal-balm",
    "wild-caught-omega-3-fish-oil"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": {},
  "tags": [
    "Balms & Skincare",
    "Beauty & Skin",
    "skin support",
    "beauty",
    "hydration",
    "collagen formation",
    "capsules",
    "beauty from within"
  ],
  "provenance": {
    "baseline_source": "catalog.master.json (AwakenAgain Merged Master Catalog, 2026-09-27)",
    "baseline_fields_used": [
      "title",
      "price",
      "sku",
      "size",
      "short_description",
      "description",
      "benefits",
      "key_botanicals",
      "ingredients",
      "instructions",
      "image",
      "image_fallback",
      "alt_text",
      "variants",
      "tags",
      "disclaimer",
      "legacy_handle",
      "legacy_variants",
      "packaging"
    ],
    "reconciliation_source": "products.canonical.DRAFT.json (2026-10-04; renames + source_files list)",
    "image_source": "IMAGE_MAP.md (2026-10-04); image_manifest.csv; baseline image_verification",
    "discrepancies": [
      "PRICE OVERRIDE: baseline lists $27.99; owner explicitly set 30-day capsule products at $34.47 on 2026-10-04 — $34.47 used. Recorded per task instruction.",
      "Baseline size '30 hand-filled capsules' vs legacy variants '28 capsules / $27.99' and '60 capsules / $49.99' (AAA- NATURALCOLLAGENBOO-* SKUs) — legacy variants superseded by the 30-capsule $34.47 owner decision; retained as reference only.",
      "Ingredients list contains generic/conditional placeholders rather than named ingredients: 'horsetail-style silica herbs where available', 'vitamin C-rich botanicals', 'mineral-rich plants'. Featured 5 chosen only from named entries (hibiscus, rose hips, nettle, oatstraw, chamomile); formula needs owner confirmation of exact botanicals.",
      "Suggested serving size / capsules-per-day not stated in source materials — directions reference 'daily' only."
    ],
    "compliance_notes": [
      "Legacy handle 'natural-collagen-booster-capsules'; current title and copy use compliant structure/function language ('supports normal collagen formation', 'supports skin vitality'). No disease claims.",
      "'Supports normal collagen formation' is framed as a nutritional-function statement tied to vitamin C's established role; FDA supplement disclaimer retained.",
      "No 'regulates hormones', no guarantees, no 'reverses aging' in current copy."
    ],
    "legacy_naming": [
      "legacy_handle: natural-collagen-booster-capsules",
      "legacy SKUs AAA- NATURALCOLLAGENBOO-28CAP / -60CAP (superseded)"
    ],
    "price_authority": "OWNER OVERRIDE 2026-10-04: $34.47 for 30-day capsule. Baseline catalog.master.json (2026-09-27) listed $27.99 — superseded. subscriber_price computed at 10% off = $31.02.",
    "price": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "Owner directive 2026-10-05: standard botanical capsules 2-week $19.77 / 30-day $47.77. Supersedes prior owner-approved $34.47 (30-day) for this product (was $34.47). Server-authoritative."
    }
  },
  "field_verification": {
    "title": {
      "status": "sourced",
      "note": "baseline title, 2026-09-27"
    },
    "price": "OWNER_CONFIRMED",
    "subscriber_price": {
      "status": "computed",
      "note": "round(price * 0.9, 2)"
    },
    "compare_at_price": {
      "status": "sourced",
      "note": "null; baseline blank, no sourced compare-at price"
    },
    "sku": {
      "status": "sourced",
      "note": "existing SKU kept; legacy naming flagged"
    },
    "sizes": "NEEDS_VERIFICATION",
    "variants": "OWNER_CONFIRMED",
    "short_description": {
      "status": "sourced",
      "note": "baseline, lightly edited for compliance"
    },
    "extended_description": {
      "status": "enriched",
      "note": "baseline description + compliant benefit language"
    },
    "featured_ingredients": {
      "status": "enriched",
      "note": "5 ingredients from actual formula data; Latin names are standard taxonomy, unverified against owner batch"
    },
    "complete_ingredients": {
      "status": "sourced",
      "note": "verbatim from baseline ingredients field"
    },
    "traditional_uses": {
      "status": "enriched",
      "note": "general traditional-use statements, not product-specific claims"
    },
    "properties": {
      "status": "enriched",
      "note": "evidence_context assigned per evidence rules"
    },
    "formulation_rationale": {
      "status": "needs_verification",
      "note": "not established in source materials"
    },
    "process": {
      "status": "needs_verification",
      "note": "not established in source materials"
    },
    "directions": {
      "status": "sourced",
      "note": "baseline instructions"
    },
    "warnings": {
      "status": "enriched",
      "note": "baseline disclaimer + standard topical/supplement cautions"
    },
    "allergens": {
      "status": "enriched",
      "note": "derived from ingredient list only; not a verified allergen statement"
    },
    "storage": {
      "status": "needs_verification",
      "note": "general guidance; not specified in source materials"
    },
    "disclaimer": {
      "status": "sourced",
      "note": "baseline disclaimer kept verbatim"
    },
    "related_products": {
      "status": "enriched",
      "note": "deterministic by category/subcategory, verified handles only"
    },
    "frequently_bought_together": {
      "status": "enriched",
      "note": "deterministic complementary pairing, verified handles only"
    },
    "inventory_status": {
      "status": "needs_verification",
      "note": "not sourced"
    },
    "review_summary": {
      "status": "sourced",
      "note": "empty; no sourced reviews"
    },
    "images": {
      "status": "sourced",
      "note": "baseline image paths; all are generated placeholders/art-direction, not product photography"
    },
    "ingredients": null
  },
  "last_verified": "2026-10-05",
  "price_display": "From $19.77"
};
