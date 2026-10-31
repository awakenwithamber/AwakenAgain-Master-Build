/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Moonlit Lavender Rose Tea",
  "handle": "moonlit-lavender-rose-tea",
  "sku": "TEA-MOONLITLAVENDERROSE-001",
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
      "sku": "TEA-MOONLITLAVENDERROSE-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-MOONLITLAVENDERROSE-BAGS-001",
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
    "lavender",
    "rose",
    "new blend"
  ],
  "images": [
    {
      "src": "/images/products/moonlit-lavender-rose-tea.webp",
      "alt": "Moonlit Lavender Rose Tea — generated representation: jar of loose-leaf tea with lavender buds and rose petals beside a steaming cup in moonlight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "Lavender buds and rose petals in a dusky, floral cup — perfume first, then honeyed petals, made for moonlight and open windows.",
  "extended_description": "Moonlit Lavender Rose Tea is a house blend in the apothecary's own tradition, composed for the blue hour: lavender's dusky perfume, rose petals' soft sweetness, and a cup that smells like a garden remembering the day. It steeps pale gold and floral, the kind of tea that makes a porch feel like a balcony somewhere older. Brew it when the moon is up and the windows are open. New specialty blend — blended by theme, and happy to be renamed by the woman who named everything else here.",
  "featured_ingredients": [
    {
      "name": "Lavender",
      "botanical_name": "Lavandula angustifolia",
      "part_used": "flower",
      "role_in_formula": "Half of the blend's floral heart — dusky buds that lead the cup's perfume.",
      "traditional_use": "Lavender is a traditional tisane botanical, long brewed in evening and garden teas.",
      "customer_friendly_summary": "Dusky floral perfume, front and center.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Rose",
      "botanical_name": "Rosa centifolia",
      "part_used": "petals",
      "role_in_formula": "The other half of the floral heart — petals in balance with the lavender, soft and honeyed.",
      "traditional_use": "Rose petals are traditional in floral teas and scented blends across many tea cultures.",
      "customer_friendly_summary": "Soft, honeyed petals in balance with the lavender.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Chamomile",
      "botanical_name": "Matricaria chamomilla",
      "part_used": "flower",
      "role_in_formula": "The rounding edge — gentle apple-sweet flowers that soften the perfume into something drinkable all evening.",
      "traditional_use": "Chamomile is one of the world's classic tea flowers, traditional in evening cups.",
      "customer_friendly_summary": "The gentle flower that rounds the edges.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Lemon Balm",
      "botanical_name": "Melissa officinalis",
      "part_used": "leaf",
      "role_in_formula": "The faint citrus lift — a green, lemony leaf under the florals.",
      "traditional_use": "Lemon balm is a traditional European tea leaf with a bright citrus scent.",
      "customer_friendly_summary": "A faint citrus lift under the florals.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Linden",
      "botanical_name": "Tilia europaea",
      "part_used": "flower and bract",
      "role_in_formula": "The background haze — flowers and bracts that sit behind the leads like perfume at a distance.",
      "traditional_use": "Linden flower is a traditional European tisane botanical, long gathered from the lime tree's summer bloom.",
      "customer_friendly_summary": "A soft floral haze in the background.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "Lavender buds, rose petals, chamomile flowers, lemon balm leaf, linden flower and bract, jasmine flowers.",
  "recipe_internal": {
    "status": "ADOPTED — owner-approved 2026-10-30; staged, not yet deployed",
    "source_document": "house-blend-recipes-2026-10-30.md",
    "basis": "Parts by weight. Per 1 oz = 28.35 g; standard batch 16 oz = 453.6 g; the tea-bag pack of 20 is filled from 1 oz of blend (approx. 1.42 g per bag).",
    "ingredients": [
      { "name": "Lavender buds", "parts": 5, "grams_per_1oz": 7.09, "grams_per_16oz_batch": 113.44 },
      { "name": "Rose petals", "parts": 5, "grams_per_1oz": 7.09, "grams_per_16oz_batch": 113.44 },
      { "name": "Chamomile flowers", "parts": 4, "grams_per_1oz": 5.67, "grams_per_16oz_batch": 90.72 },
      { "name": "Lemon balm leaf", "parts": 3, "grams_per_1oz": 4.25, "grams_per_16oz_batch": 68.0 },
      { "name": "Linden flower & bract", "parts": 2, "grams_per_1oz": 2.83, "grams_per_16oz_batch": 45.28 },
      { "name": "Jasmine flowers", "parts": 1, "grams_per_1oz": 1.42, "grams_per_16oz_batch": 22.72 }
    ],
    "display_five_basis": "First five botanicals in recipe order (5/5/4/3/2 parts). Jasmine (1 part) is the recipe's background note and appears in the complete list only. The adoption retires the staged display list's butterfly pea flower, which is not in the adopted recipe."
  },
  "traditional_uses": "A house blend in the apothecary's own tradition — blended for flavor, aroma, and the ritual of the cup.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Moonlit garden ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "House-blend recipe adopted at the owner's approval on 2026-10-30 (house-blend-recipes-2026-10-30.md): soft and floral — lavender and rose in balance, chamomile rounding the edges, lemon balm for a faint citrus lift, linden and jasmine in the background. The full formula is published in the complete ingredient list; proportions by weight are held in this record's internal recipe data.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz hot water (195°F — hot, not boiling) for 7-10 minutes, covered. Florals scald and lose their aroma at a rolling boil, and the lid keeps the aromatics in the cup. Strain and sip while it is still fragrant.",
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
  "ritual_name": "The Blue-Hour Cup",
  "ritual_purpose": "A moonlit ritual for porches, windows, and quiet company.",
  "ritual_how_to": "Brew as the light goes blue. Carry it outside if you can, and drink it under whatever sky you have.",
  "ritual_duration": "10-15 minutes",
  "best_for": "Moonlit porches, evening baths, and floral-tea lovers.",
  "ritual_tip": "A single fresh rose petal in the cup is never the wrong idea.",
  "seo_title": "Moonlit Lavender Rose Tea — Lavender & Rose Petal | Amber's Alchemy Apothecary",
  "seo_description": "A new specialty house blend: lavender buds and rose petals in a dusky floral cup. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
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
