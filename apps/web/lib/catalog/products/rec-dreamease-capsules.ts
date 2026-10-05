/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "DreamEase Capsules",
  "handle": "dreamease-capsules",
  "sku": "CAP-DREAMEASE-001",
  "category": "Capsules",
  "subcategory": "Sleep & Nervous System",
  "price": 19.77,
  "compare_at_price": null,
  "subscriber_price": 17.79,
  "sizes": [
    "2-week supply",
    "30-day supply (30 capsules)"
  ],
  "variants": [
    {
      "variant_id": "dreamease-capsules-2wk",
      "name": "2-Week Supply",
      "size": "2-week supply",
      "weight": null,
      "price": 19.77,
      "subscriber_price": 17.79,
      "currency": "USD",
      "sku": "CAP-DREAMEASE-001-2WK",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "2-week capsule count not established in sources; size offered per owner directive."
    },
    {
      "variant_id": "dreamease-capsules-30d",
      "name": "30-Day Supply",
      "size": "30-day supply (30 capsules)",
      "weight": null,
      "price": 47.77,
      "subscriber_price": 42.99,
      "currency": "USD",
      "sku": "CAP-DREAMEASE-001-30D",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "30-capsule count from Sept 27 baseline where established; price per owner directive."
    }
  ],
  "images": [
    {
      "src": "~/workspace/user/files/17291_1_etho.webp",
      "alt": "DreamEase natural sleep support capsules in amber jar",
      "role": "primary",
      "asset_status": "MAPPED",
      "note": "IMAGE_MAP.md maps this upload to dreamease-capsules: 'DreamEase capsules jar (product photo)'. Not yet confirmed as the live site asset; field marked NEEDS_VERIFICATION."
    },
    {
      "src": "/images/products/dreamease-capsules.webp",
      "alt": "DreamEase natural sleep support capsules in amber jar",
      "role": "fallback",
      "asset_status": "MISSING_ASSET",
      "note": "Baseline catalog 'photo' status with 'catalog-safe generated fallback' verification; treated as placeholder until confirmed."
    }
  ],
  "short_description": "A moonlit capsule ritual for deep rest, a quiet mind, and mornings that feel softer.",
  "extended_description": "DreamEase is crafted for the person whose body is tired but whose mind will not hush. This calming botanical blend supports relaxation, nighttime nervous-system ease, and restorative sleep. It centers on classic bedtime nervines — valerian root, passionflower, chamomile, lavender, and lemon balm — botanicals long used in herbal tradition to help quiet a racing mind and ease the transition into rest. Individual experiences vary. Free shipping on orders of $100 or more ($75 or more for Living Grimoire subscribers).",
  "featured_ingredients": [
    {
      "name": "Valerian Root",
      "botanical_name": "Valeriana officinalis",
      "part_used": "root",
      "role_in_formula": "Nervine; deep-calming core of the formula",
      "traditional_use": "Traditionally used in herbal practice to support relaxation and restful sleep.",
      "properties": "Traditionally used to support relaxation and ease of the nervous system.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A deeply calming root long used in bedtime traditions."
    },
    {
      "name": "Passionflower",
      "botanical_name": "Passiflora incarnata",
      "part_used": "aerial parts",
      "role_in_formula": "Nervine; quiets a racing mind",
      "traditional_use": "Traditionally used in herbal practice to support relaxation and restful ease.",
      "properties": "Traditionally used to support relaxation of the nervous system.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A classic calming flower traditionally used to ease mental restlessness."
    },
    {
      "name": "Chamomile",
      "botanical_name": "Matricaria chamomilla",
      "part_used": "flower",
      "role_in_formula": "Nervine; gentle soothing presence",
      "traditional_use": "Historically used in herbal practice to support calm and comfort.",
      "properties": "Traditionally used to support relaxation.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "The beloved bedtime flower of herbal tradition."
    },
    {
      "name": "Lavender",
      "botanical_name": "Lavandula angustifolia",
      "part_used": "flower",
      "role_in_formula": "Nervine; aromatic calm",
      "traditional_use": "Traditionally used in herbal practice to support relaxation and restful ease.",
      "properties": "Traditionally used to support relaxation.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "An aromatic flower long associated with calm and rest."
    },
    {
      "name": "Lemon Balm",
      "botanical_name": "Melissa officinalis",
      "part_used": "leaf",
      "role_in_formula": "Nervine; soft, soothing finish",
      "traditional_use": "Historically used in herbal practice to support calm and uplifted mood.",
      "properties": "Traditionally used to support relaxation.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A gentle lemony herb traditionally used to soothe frazzled nerves."
    }
  ],
  "complete_ingredients": "Mugwort, lavender, chamomile, tulsi, lemon balm, ashwagandha, passionflower, valerian, turmeric, saffron, peppermint, skullcap, wild lettuce, clove, star anise, marjoram, eucalyptus, rosemary, sage, fenugreek, caraway, ginger, chrysanthemum, hibiscus, rose, alfalfa, nutmeg, reishi, basil, Egyptian licorice.",
  "traditional_uses": [
    "Classic bedtime nervine botanicals traditionally used to support relaxation and restful sleep.",
    "Aromatic and calming herbs historically used to ease a racing mind at night."
  ],
  "properties": {
    "sleep-supporting": {
      "description": "Nervine botanicals traditionally used to support restful sleep.",
      "evidence_context": "traditional_use"
    },
    "calming": {
      "description": "Traditionally calming herbs for nighttime nervous-system ease.",
      "evidence_context": "traditional_use"
    },
    "ritual": {
      "description": "Formulated as a nightly wind-down ritual, not a stimulant.",
      "evidence_context": "traditional_use"
    }
  },
  "formulation_rationale": "Not established in source materials.",
  "process": "Hand-filled into capsules; the baseline catalog's size field reads '30 hand-filled capsules'. Batch-level process details are not established in source materials.",
  "directions": "Take as directed in the evening with water or tea. Start with the lower suggested amount to assess tolerance. Do not combine with sedatives or alcohol. Suggested daily amount is not established in source materials.",
  "warnings": "May cause drowsiness. Do not drive or operate machinery after taking. Do not combine with sedatives or alcohol. Contains mugwort and other Asteraceae-family herbs; avoid if sensitive to the daisy/ragweed family. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use.",
  "allergens": "None listed in source materials. Note: contains herbs in the Asteraceae (daisy) family — see warnings.",
  "storage": "Not established in source materials.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "related_products": [
    "chill-pill-capsules",
    "happy-pill-capsules",
    "sacred-balance-capsules"
  ],
  "frequently_bought_together": [
    "chill-pill-capsules"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "provenance": {
    "title": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "From baseline catalog.master.json (sources: automation_json, products_json). Baseline compliance_rewrite_applied=false — description screened in this draft and found free of cure/treat/diagnose/prevent language."
    },
    "price": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "Owner directive 2026-10-05: standard botanical capsules 2-week $19.77 / 30-day $47.77. Supersedes prior owner-approved $34.47 (30-day) for this product (was $34.47). Server-authoritative."
    },
    "ingredients": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "key_botanicals lists Valerian Root, Passionflower, Chamomile, Lavender, Lemon Balm, Hops; ingredients field is a 30-item list including mugwort, tulsi, ashwagandha, saffron, reishi, and others. DISCREPANCY: Hops appears in key_botanicals but not in the ingredients list; many ingredients-list herbs are not in key_botanicals. Featured five chosen from the overlapping bedtime nervines. Full formula needs owner verification."
    },
    "directions": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Instructions from baseline (evening use, start low, no sedatives/alcohol). Suggested daily amount not stated in sources."
    },
    "images": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Baseline image_status 'photo' with 'catalog-safe generated fallback' verification — treated as placeholder. IMAGE_MAP.md independently maps upload 17291_1_etho.webp ('DreamEase capsules jar (product photo)') to this product; not yet confirmed as the live asset."
    },
    "disclaimer": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Standard FDA supplement disclaimer present in baseline."
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
    "featured_ingredients": "CURRENT",
    "complete_ingredients": "CURRENT",
    "traditional_uses": "CURRENT",
    "properties": "CURRENT",
    "formulation_rationale": "NEEDS_VERIFICATION",
    "process": "CURRENT",
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
  "tags": [],
  "price_display": "From $19.77"
};
