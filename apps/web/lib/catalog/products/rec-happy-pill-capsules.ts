/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Happy Pill Capsules",
  "handle": "happy-pill-capsules",
  "sku": "CAP-HAPPYPILL-001",
  "category": "Capsules",
  "subcategory": "Mood & Emotional Wellness",
  "price": 19.77,
  "compare_at_price": null,
  "subscriber_price": 17.79,
  "sizes": [
    "2-week supply",
    "30-day supply (30 capsules)"
  ],
  "variants": [
    {
      "variant_id": "happy-pill-capsules-2wk",
      "name": "2-Week Supply",
      "size": "2-week supply",
      "weight": null,
      "price": 19.77,
      "subscriber_price": 17.79,
      "currency": "USD",
      "sku": "CAP-HAPPYPILL-001-2WK",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "2-week capsule count not established in sources; size offered per owner directive."
    },
    {
      "variant_id": "happy-pill-capsules-30d",
      "name": "30-Day Supply",
      "size": "30-day supply (30 capsules)",
      "weight": null,
      "price": 47.77,
      "subscriber_price": 42.99,
      "currency": "USD",
      "sku": "CAP-HAPPYPILL-001-30D",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "OWNER_CONFIRMED",
      "note": "30-capsule count from Sept 27 baseline where established; price per owner directive."
    }
  ],
  "images": [
    {
      "src": "/images/products/happy-pill-capsules.webp",
      "alt": "Happy Pill mood boosting herbal capsules in amber jar",
      "role": "primary",
      "asset_status": "MISSING_ASSET",
      "note": "Mapped in baseline as 'catalog-safe generated fallback' placeholder; no real product photography on file."
    }
  ],
  "short_description": "A feel-good botanical blend for positive mood, emotional resilience, and everyday stress support.",
  "extended_description": "Happy Pill Capsules combine traditionally uplifting botanicals to support a positive mood, emotional resilience, and a brighter everyday wellness routine. St. John's Wort and rhodiola are joined by saffron, mimosa bark, and schisandra — botanicals with a long history of traditional use for emotional well-being — chosen to support steadiness through everyday stress. Individual experiences vary. Free shipping on orders of $45 or more (always free for Living Grimoire subscribers).",
  "featured_ingredients": [
    {
      "name": "St. John's Wort",
      "botanical_name": "Hypericum perforatum",
      "part_used": "flowering tops",
      "role_in_formula": "Uplifting core of the formula",
      "traditional_use": "Traditionally used in herbal practice to support a positive mood and emotional balance.",
      "properties": "Traditionally used to support emotional well-being.",
      "key_constituents": null,
      "evidence_context": "mixed_with_note",
      "customer_friendly_summary": "A storied mood herb with a long traditional history; research has also investigated it in human studies. Interacts with many medications — see warnings."
    },
    {
      "name": "Rhodiola",
      "botanical_name": "Rhodiola rosea",
      "part_used": "root",
      "role_in_formula": "Adaptogen; resilience support",
      "traditional_use": "Traditionally used in herbal practice to support stamina and resilience during demanding times.",
      "properties": "Traditionally used as an adaptogen to support resilience.",
      "key_constituents": null,
      "evidence_context": "mixed_with_note",
      "customer_friendly_summary": "A traditional adaptogenic root; also investigated in laboratory and human research."
    },
    {
      "name": "Saffron",
      "botanical_name": "Crocus sativus",
      "part_used": "stigma",
      "role_in_formula": "Uplifting spice",
      "traditional_use": "Historically used in traditional practice to support emotional well-being.",
      "properties": "Traditionally used to support a positive mood.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A precious golden spice with a long history of traditional use for emotional wellness."
    },
    {
      "name": "Mimosa Bark",
      "botanical_name": "Albizia julibrissin",
      "part_used": "bark",
      "role_in_formula": "Traditional emotional-wellness botanical",
      "traditional_use": "Traditionally used in herbal practice to support emotional balance.",
      "properties": "Traditionally used to support emotional well-being.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A traditional botanical ally for the heart and emotions."
    },
    {
      "name": "Schisandra",
      "botanical_name": "Schisandra chinensis",
      "part_used": "berry",
      "role_in_formula": "Adaptogen; steadying presence",
      "traditional_use": "Traditionally used in herbal practice to support resilience and vitality.",
      "properties": "Traditionally used as an adaptogen to support resilience.",
      "key_constituents": null,
      "evidence_context": "traditional_use",
      "customer_friendly_summary": "A five-flavor berry traditionally used to support steadiness and vitality."
    }
  ],
  "complete_ingredients": "St. John’s Wort, Rhodiola, Saffron, Mimosa Bark, Schisandra, Rose",
  "traditional_uses": [
    "Uplifting botanicals traditionally used to support a positive mood and emotional resilience.",
    "Adaptogenic herbs historically used to support steadiness through everyday stress."
  ],
  "properties": {
    "mood-supporting": {
      "description": "Traditionally uplifting botanicals for everyday emotional well-being.",
      "evidence_context": "traditional_use"
    },
    "adaptogenic": {
      "description": "Contains adaptogenic botanicals traditionally used to support resilience.",
      "evidence_context": "traditional_use"
    },
    "stress-support": {
      "description": "Botanicals traditionally used to support a calm response to everyday stress.",
      "evidence_context": "traditional_use"
    }
  },
  "formulation_rationale": "Not established in source materials.",
  "process": "Hand-filled into capsules; the baseline catalog's size field reads '30 hand-filled capsules'. Batch-level process details are not established in source materials.",
  "directions": "Not established in source materials. No usage instructions were provided in the baseline catalog; owner to confirm suggested use and daily amount.",
  "warnings": "IMPORTANT: St. John's Wort interacts with many medications, including antidepressants, birth control, blood thinners, and immunosuppressants. Do not combine with antidepressants or other serotonergic substances without provider guidance. May increase sensitivity to sunlight. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use.",
  "allergens": "None listed in source materials.",
  "storage": "Not established in source materials.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "related_products": [
    "vital-connect-capsules",
    "chill-pill-capsules",
    "dreamease-capsules",
    "sacred-balance-capsules"
  ],
  "frequently_bought_together": [
    "vital-connect-capsules"
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
      "note": "Owner directive 2026-10-05: standard botanical capsules 2-week $19.77 / 30-day $47.77. Supersedes prior owner-approved $34.47 (30-day) for this product (was $34.47). Server-authoritative."
    },
    "ingredients": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "key_botanicals and ingredients fields are identical (St. John's Wort, Rhodiola, Saffron, Mimosa Bark, Schisandra, Rose). Featured five drawn from this agreed list; rose is the sixth ingredient."
    },
    "directions": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "The baseline instructions field is EMPTY for this product. Directions marked NEEDS_VERIFICATION; nothing invented."
    },
    "images": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Baseline image_status: 'placeholder' / 'catalog-safe generated fallback'; no real photography. Marked MISSING_ASSET."
    },
    "disclaimer": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "Standard FDA supplement disclaimer present in baseline."
    },
    "compliance": {
      "source_file": "catalog.master.json",
      "date": "2026-09-27",
      "note": "baseline compliance_rewrite_applied=true; legacy high-risk claim removed per claim review note. Description makes no neurotransmitter or hormone claims."
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
