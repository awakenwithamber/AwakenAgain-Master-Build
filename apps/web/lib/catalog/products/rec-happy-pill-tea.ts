/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Happy Pill Tea",
  "handle": "happy-pill-tea",
  "sku": "TEA-HAPPYPILL-001",
  "category": "Teas",
  "subcategory": "Herbal Tea",
  "price": 9,
  "compare_at_price": null,
  "subscriber_price": 8.1,
  "sizes": [
    "Loose Leaf - 1 oz",
    "Handmade Tea Bags - Pack of 20"
  ],
  "variants": [
    {
      "name": "Loose Leaf - 1 oz",
      "sku": "TEA-HAPPYPILL-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-HAPPYPILL-BAGS-001",
      "price": 11,
      "unit": "20 handmade tea bags",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    }
  ],
  "tags": [
    "tea",
    "herbal tea",
    "small batch",
    "handcrafted",
    "happy pill"
  ],
  "images": [
    {
      "src": "/images/products/happy-pill-tea.webp",
      "alt": "Happy Pill Tea — generated representation: jar of loose-leaf tea with St John’s Wort flowers, schisandra berries and mimosa blossom beside a steaming cup in sunlight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "St. John's Wort's sunny yellow, mimosa blossom and schisandra's bright berries with saffron and rose — the happiest-looking cup in the apothecary.",
  "extended_description": "Happy Pill Tea is pure apothecary sunshine: golden flowers, blush mimosa, ruby schisandra berries and threads of saffron steeping into a cup that looks like late afternoon in a bottle garden. The flavor is bright and layered — floral first, then berry-tart, then warm. Brew it for brunch tables, porch swings, and any ordinary Tuesday that could use a little ceremony. Prefer the capsules? This blend is also available as Happy Pill Capsules.",
  "featured_ingredients": [
    {
      "name": "St. John's Wort",
      "botanical_name": "Hypericum perforatum",
      "part_used": "flowering tops",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Rhodiola",
      "botanical_name": "Rhodiola rosea",
      "part_used": "root",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Saffron",
      "botanical_name": "Crocus sativus",
      "part_used": "stigma",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Mimosa Bark",
      "botanical_name": "Albizia julibrissin",
      "part_used": "bark",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Schisandra",
      "botanical_name": "Schisandra chinensis",
      "part_used": "berry",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "St. John’s Wort, Rhodiola, Saffron, Mimosa Bark, Schisandra, Rose",
  "traditional_uses": "The botanicals in this blend are named in the apothecary's formula records and have long been enjoyed as teas in home herbal practice.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Sunshine cup-time ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "Per source, a handcrafted blend of calming and aromatic botanicals intended for a soothing cup-time ritual. The source lists the ingredient pool but does not publish a fixed formula, proportions, or a per-ingredient rationale — these are flagged NEEDS_VERIFICATION with the owner.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz hot water for 10-15 minutes. Cover while steeping to keep the aromatics in the cup. Strain, sip slowly, and keep the kettle warm for a second pour. (Directions follow the apothecary's standard tea template.)",
  "warnings": "IMPORTANT: St. John's Wort interacts with many medications, including antidepressants, birth control, blood thinners, and immunosuppressants. Do not combine with antidepressants or other serotonergic substances without provider guidance. May increase sensitivity to sunlight. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use.",
  "allergens": "None listed in source materials.",
  "storage": "Store in a cool, dry place away from direct light — standard care for loose-leaf tea. Packaging-specific storage instructions are not published in the source and are flagged NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "happy-pill-capsules",
    "alchemy-tea-blend",
    "custom-tea-blends"
  ],
  "frequently_bought_together": [
    "custom-tea-blends",
    "custom-herbal-capsules"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "provenance": {
    "sources": [
      "Owner directive 2026-10-30 (13 specialty teas build)",
      "Capsule counterpart catalog record (documented formula)"
    ],
    "price_authority": "Owner directive 2026-10-30: $9 loose leaf 1 oz / $11 handmade tea bags (pack of 20)",
    "image_source": "Generated representation created 2026-10-30 for this record; registered in lib/media/image-manifest.ts",
    "last_verified": "2026-10-30",
    "notes": [
      "Handle created as the canonical ID for this tea.",
      "Descriptive copy is sensory/ritual only per the strengthened copy rule (2026-10-27).",
      "Full formula proportions are not published — flagged, not invented."
    ]
  },
  "field_verification": {
    "price": "VERIFIED — owner directive 2026-10-30",
    "featured_ingredients": "SOURCED — carried from the documented capsule counterpart record; no invented ingredients",
    "images": "GENERATED_REPRESENTATION — generated 2026-10-30; not product photography",
    "variants": "VERIFIED — owner directive 2026-10-30 ($9 loose leaf 1 oz; $11 handmade bags, pack of 20)",
    "allergens": "SOURCED — carried from the capsule counterpart record",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-05",
  "stock_status": "in_stock",
  "fulfillment_type": "physical_shipped",
  "lead_time_days": 3,
  "requires_shipping": true,
  "digital_delivery": null,
  "origin_sourcing": "Botanicals are sourced through Amber's apothecary supply channels and blended in small batches; lot-level sourcing notes available on request.",
  "ritual_name": "The Sunshine Cup",
  "ritual_purpose": "A bright ritual for making an ordinary day feel a little ceremonial.",
  "ritual_how_to": "Brew it where the light is best in your house. Drink it slowly and, if the weather allows, outside.",
  "ritual_duration": "10-15 minutes",
  "best_for": "Brunch tables, porch swings, and bright ordinary days.",
  "ritual_tip": "Beautiful over ice with a rose petal or two floated on top.",
  "seo_title": "Happy Pill Tea — Sunny Flowers, Berry & Saffron | Amber's Alchemy Apothecary",
  "seo_description": "The Happy Pill blend as a loose-leaf tea: St. John's Wort flowers, mimosa, schisandra berries, saffron and rose. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
  "also_available_as": [
    "happy-pill-capsules"
  ],
  "source_provenance": {
    "record_origin": "hand_authored",
    "directive": "Owner directive 2026-10-30: every capsule formula is also offered as a tea; 13 specialty teas at $9 loose leaf (1 oz) / $11 handmade tea bags (pack of 20).",
    "ingredients_basis": "Capsule counterpart record (documented formula)",
    "image": "Generated representation created 2026-10-30; not product photography.",
    "status": "PROPOSED"
  },
  "verification": {
    "status": "PROPOSED",
    "notes": "Added 2026-10-30 at owner direction. Descriptive copy is sensory/ritual only per the strengthened copy rule (2026-10-27). Image is a generated representation, registered as such in lib/media/image-manifest.ts."
  }
};
