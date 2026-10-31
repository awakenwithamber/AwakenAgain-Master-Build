/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Wild Mint Meadow Tea",
  "handle": "wild-mint-meadow-tea",
  "sku": "TEA-WILDMINTMEADOW-001",
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
      "sku": "TEA-WILDMINTMEADOW-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-WILDMINTMEADOW-BAGS-001",
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
    "mint",
    "iced tea",
    "new blend"
  ],
  "images": [
    {
      "src": "/images/products/wild-mint-meadow-tea.webp",
      "alt": "Wild Mint Meadow Tea — generated representation: jar of green loose-leaf tea with fresh mint leaves beside a steaming cup in daylight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "Mint on mint, green and cool, with lemongrass lift — a barefoot-in-the-garden cup for bright afternoons.",
  "extended_description": "Wild Mint Meadow Tea tastes like the herb garden at noon: armfuls of mint, green and cooling, lemongrass lifting the edges, steam that smells like someone just brushed past the mint patch. It's a house blend for the bright half of the year — iced in a jar with lunch, hot after a morning in the garden, always with a sprig of something fresh in the cup. Brew it when the day is warm and the windows are open.",
  "featured_ingredients": [
    {
      "name": "Peppermint",
      "botanical_name": "Mentha piperita",
      "part_used": "leaf",
      "role_in_formula": "The lead mint — cool and bright, the first thing the steam smells like.",
      "traditional_use": "Peppermint leaf is a classic traditional tea botanical, brewed hot and iced everywhere.",
      "customer_friendly_summary": "The cool, bright lead mint.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Spearmint",
      "botanical_name": "Mentha spicata",
      "part_used": "leaf",
      "role_in_formula": "The second mint — softer and sweeter behind the peppermint, so the blend reads as a meadow instead of a single note.",
      "traditional_use": "Spearmint is a traditional garden tea mint, long poured in warm-climate tea traditions.",
      "customer_friendly_summary": "The softer, sweeter second mint.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Lemongrass",
      "botanical_name": "Cymbopogon citratus",
      "part_used": "stalk and leaf",
      "role_in_formula": "The lift — tall, lemon-scented grass that brightens the mints' green edge.",
      "traditional_use": "Lemongrass is long brewed as a tea across Southeast Asia; its herb-library entry was added at the owner's direction 2026-10-30.",
      "customer_friendly_summary": "The bright lemon lift.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Lemon Balm",
      "botanical_name": "Melissa officinalis",
      "part_used": "leaf",
      "role_in_formula": "The citrus bridge — a lemony leaf that ties the lemongrass to the mints.",
      "traditional_use": "Lemon balm is a traditional European tea leaf with a bright citrus scent.",
      "customer_friendly_summary": "The lemony bridge between grass and mint.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Lemon Verbena",
      "botanical_name": "Aloysia citrodora",
      "part_used": "leaf",
      "role_in_formula": "The sparkle — a small measure of intensely lemon-scented leaf that keeps the cup vivid to the last sip.",
      "traditional_use": "Lemon verbena is a traditional South American herbal tea leaf, prized for its clean lemon perfume.",
      "customer_friendly_summary": "A sparkle of pure lemon perfume.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "Peppermint leaf, spearmint leaf, lemongrass, lemon balm leaf, lemon verbena leaf, elderflower.",
  "recipe_internal": {
    "status": "ADOPTED — owner-approved 2026-10-30; staged, not yet deployed",
    "source_document": "house-blend-recipes-2026-10-30.md",
    "basis": "Parts by weight. Per 1 oz = 28.35 g; standard batch 16 oz = 453.6 g; the tea-bag pack of 20 is filled from 1 oz of blend (approx. 1.42 g per bag).",
    "ingredients": [
      { "name": "Peppermint leaf", "parts": 6, "grams_per_1oz": 8.5, "grams_per_16oz_batch": 136.0 },
      { "name": "Spearmint leaf", "parts": 5, "grams_per_1oz": 7.09, "grams_per_16oz_batch": 113.44 },
      { "name": "Lemongrass", "parts": 4, "grams_per_1oz": 5.67, "grams_per_16oz_batch": 90.72 },
      { "name": "Lemon balm leaf", "parts": 3, "grams_per_1oz": 4.25, "grams_per_16oz_batch": 68.0 },
      { "name": "Lemon verbena leaf", "parts": 1, "grams_per_1oz": 1.42, "grams_per_16oz_batch": 22.72 },
      { "name": "Elderflower", "parts": 1, "grams_per_1oz": 1.42, "grams_per_16oz_batch": 22.72 }
    ],
    "display_five_basis": "First five botanicals in recipe order (6/5/4/3/1 parts). Lemon verbena and elderflower tie at 1 part; recipe order puts lemon verbena fifth, so elderflower — the recipe's whisper of sweetness at the back — appears in the complete list only. The adoption also retires the staged display list's unspecified 'Mint' (Mentha spp.): the recipe names the two mints, peppermint and spearmint."
  },
  "traditional_uses": "A house blend in the apothecary's own tradition — blended for flavor, aroma, and the ritual of the cup.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Green garden ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "House-blend recipe adopted at the owner's approval on 2026-10-30 (house-blend-recipes-2026-10-30.md): cool and green — peppermint leading, spearmint softer behind it, lemongrass and lemon balm bringing the citrus, and elderflower's whisper of sweetness at the back. Naming peppermint in the formula also lets the herb library's peppermint caution attach to this blend. The full formula is published in the complete ingredient list; proportions by weight are held in this record's internal recipe data.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz hot water (200°F) for 7-10 minutes, covered — the lid keeps the mint oils in the cup. Strain; serve hot, or chill and pour over ice with a fresh sprig.",
  "warnings": "If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "allergens": "NEEDS_VERIFICATION — small-batch blend; confirm finished-formula allergen statement with owner before publication.",
  "storage": "Store in a cool, dry place away from direct light — standard care for loose-leaf tea. Packaging-specific storage instructions are not published in the source and are flagged NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "custom-tea-blends",
    "alchemy-tea-blend"
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
      "House-blend recipe adopted 2026-10-30 — owner approval of house-blend-recipes-2026-10-30.md (all five recipe decisions approved as recommended)"
    ],
    "price_authority": "Owner directive 2026-10-30: $9 loose leaf 1 oz / $11 handmade tea bags (pack of 20)",
    "image_source": "Generated representation created 2026-10-30 for this record; registered in lib/media/image-manifest.ts",
    "last_verified": "2026-10-30",
    "notes": [
      "Handle created as the canonical ID for this tea.",
      "Descriptive copy is sensory/ritual only per the strengthened copy rule (2026-10-27).",
      "Formula adopted 2026-10-30: the full ingredient list is published in this record; proportions are held in internal recipe data (recipe_internal)."
    ]
  },
  "field_verification": {
    "price": "VERIFIED — owner directive 2026-10-30",
    "featured_ingredients": "VERIFIED — adopted house-blend recipe 2026-10-30; display five are the recipe's lead botanicals in recipe order; complete formula published in complete_ingredients",
    "images": "GENERATED_REPRESENTATION — generated 2026-10-30; not product photography",
    "variants": "VERIFIED — owner directive 2026-10-30 ($9 loose leaf 1 oz; $11 handmade bags, pack of 20)",
    "allergens": "NEEDS_VERIFICATION",
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
  "ritual_name": "The Garden-Noon Cup",
  "ritual_purpose": "A bright ritual for the warm, green middle of the day.",
  "ritual_how_to": "Brew it strong and pour over ice for lunch outside, or drink it hot straight from the garden gate.",
  "ritual_duration": "10 minutes",
  "best_for": "Garden lunches, summer afternoons, and iced-tea jars.",
  "ritual_tip": "Bruise a fresh mint sprig between your palms and drop it in — instant meadow.",
  "seo_title": "Wild Mint Meadow Tea — Mint & Lemongrass | Amber's Alchemy Apothecary",
  "seo_description": "A new specialty house blend: cool mint and bright lemongrass in a green garden cup. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
  "source_provenance": {
    "record_origin": "hand_authored",
    "directive": "Owner directive 2026-10-30: every capsule formula is also offered as a tea; 13 specialty teas at $9 loose leaf (1 oz) / $11 handmade tea bags (pack of 20).",
    "ingredients_basis": "Owner-approved house-blend recipe adopted 2026-10-30 (house-blend-recipes-2026-10-30.md): the full formula is written into this record; proportions by weight are held in the record's internal recipe data.",
    "image": "Generated representation created 2026-10-30; not product photography.",
    "status": "PROPOSED"
  },
  "verification": {
    "status": "PROPOSED",
    "notes": "Added 2026-10-30 at owner direction. Descriptive copy is sensory/ritual only per the strengthened copy rule (2026-10-27). Image is a generated representation, registered as such in lib/media/image-manifest.ts. House-blend recipe adopted into this record 2026-10-30 at the owner's approval of all five recipe decisions; staged, not deployed."
  }
};
