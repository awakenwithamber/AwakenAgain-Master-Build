/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Chill Pill Tea",
  "handle": "chill-pill-tea",
  "sku": "TEA-CHILLPILL-001",
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
      "sku": "TEA-CHILLPILL-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-CHILLPILL-BAGS-001",
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
    "chill pill",
    "evening"
  ],
  "images": [
    {
      "src": "/images/products/chill-pill-tea.webp",
      "alt": "Chill Pill Tea — generated representation: jar of loose-leaf tea with passionflower and lemon balm beside a steaming cup in twilight candlelight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "Passionflower, lemon balm and ashwagandha in a twilight blend — floral, green and grounding, made for couch-light and low music.",
  "extended_description": "Chill Pill Tea is what the end of a long day tastes like in this apothecary: passionflower's wild floral notes, lemon balm's soft citrus-green, a base of deep roots, and lavender drifting over the top. It steeps mellow and unhurried. Put on the low music, dim the bright lights, and let the cup set the pace — this blend was made for the couch, the blanket, and nowhere to be. Prefer the capsules? This blend is also available as Chill Pill Capsules.",
  "featured_ingredients": [
    {
      "name": "Ashwagandha",
      "botanical_name": "Withania somnifera",
      "part_used": "root",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Passionflower",
      "botanical_name": "Passiflora incarnata",
      "part_used": "aerial parts",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Lemon Balm",
      "botanical_name": "Melissa officinalis",
      "part_used": "leaf",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Holy Basil",
      "botanical_name": "Ocimum tenuiflorum",
      "part_used": "leaf",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Valerian",
      "botanical_name": "Valeriana officinalis",
      "part_used": "root",
      "role_in_formula": "Botanical carried over from the capsule formula into the tea blend; proportions are the apothecary's own and are not published.",
      "traditional_use": "Named in the apothecary's formula records and long enjoyed in herbal teas and home apothecary practice.",
      "customer_friendly_summary": "One of the botanicals that gives this blend its character in the cup.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "Passionflower, holy basil, skullcap, lemon balm, chamomile, lavender, wild lettuce, oatstraw, magnesium-rich herbs, and calming botanicals.",
  "traditional_uses": "The botanicals in this blend are named in the apothecary's formula records and have long been enjoyed as teas in home herbal practice.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Twilight cup-time ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "Per source, a handcrafted blend of calming and aromatic botanicals intended for a soothing cup-time ritual. The source lists the ingredient pool but does not publish a fixed formula, proportions, or a per-ingredient rationale — these are flagged NEEDS_VERIFICATION with the owner.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz hot water for 10-15 minutes. Cover while steeping to keep the aromatics in the cup. Strain, sip slowly, and keep the kettle warm for a second pour. (Directions follow the apothecary's standard tea template.)",
  "warnings": "May cause drowsiness. Do not drive or operate machinery until you know how this product affects you. Do not combine with sedative medications or alcohol without provider guidance. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use.",
  "allergens": "None listed in source materials.",
  "storage": "Store in a cool, dry place away from direct light — standard care for loose-leaf tea. Packaging-specific storage instructions are not published in the source and are flagged NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "chill-pill-capsules",
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
  "ritual_name": "The Low-Light Cup",
  "ritual_purpose": "An evening ritual for dimming the day down, one sip at a time.",
  "ritual_how_to": "Brew after dinner. Low lights, low music, feet up — drink it at couch pace, not desk pace.",
  "ritual_duration": "15-20 minutes",
  "best_for": "Twilight rituals, couch-and-blanket evenings, and slow Sundays.",
  "ritual_tip": "A spoon of honey rounds the floral edges beautifully.",
  "seo_title": "Chill Pill Tea — Passionflower & Lemon Balm | Amber's Alchemy Apothecary",
  "seo_description": "The Chill Pill blend as a loose-leaf tea: passionflower, lemon balm, ashwagandha and lavender in a twilight cup. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
  "also_available_as": [
    "chill-pill-capsules"
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
