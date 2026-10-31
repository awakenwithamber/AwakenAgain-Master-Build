/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Velvet Hibiscus Berry Tea",
  "handle": "velvet-hibiscus-berry-tea",
  "sku": "TEA-VELVETHIBISCUS-001",
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
      "sku": "TEA-VELVETHIBISCUS-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-VELVETHIBISCUS-BAGS-001",
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
    "hibiscus",
    "berry",
    "new blend"
  ],
  "images": [
    {
      "src": "/images/products/velvet-hibiscus-berry-tea.webp",
      "alt": "Velvet Hibiscus Berry Tea — generated representation: jar of hibiscus and berry loose-leaf tea beside a steaming garnet-red cup by candlelight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "Hibiscus garnet-dark with berries and rose hips — tart, velvety, and dramatic in the glass, hot or poured over ice.",
  "extended_description": "Velvet Hibiscus Berry Tea is the diva of the tea shelf, and she knows it: hibiscus steeping almost black-red, berries dark and jammy underneath, rose hips keeping the tartness honest. Served hot, it's a candlelit cup; poured over ice, it's the most dramatic glass at the table. A house blend for people who like their tea with a little theater. Brew it in glass — this one is a performance.",
  "featured_ingredients": [
    {
      "name": "Hibiscus",
      "botanical_name": "Hibiscus sabdariffa",
      "part_used": "calyx",
      "role_in_formula": "The lead — garnet tang up front, and the reason the cup pours almost black-red.",
      "traditional_use": "Hibiscus calyces are a traditional tea botanical wherever agua de jamaica and hibiscus tisanes are poured.",
      "customer_friendly_summary": "The garnet tang that leads the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Rose Hips",
      "botanical_name": "Rosa canina",
      "part_used": "fruit",
      "role_in_formula": "The body — crushed hips that keep the tartness honest and give the blend its roundness.",
      "traditional_use": "Rose hips are a traditional tea fruit, long brewed for their tart, vitamin-C-rich cups; tea use in the apothecary's library was owner-confirmed 2026-10-30.",
      "customer_friendly_summary": "Tart body and roundness under the hibiscus.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Elderberry",
      "botanical_name": "Sambucus nigra",
      "part_used": "berry",
      "role_in_formula": "The dark-berry depth — dried berries that take the blend from red to velvet.",
      "traditional_use": "Elderberries are a traditional European botanical for teas, syrups, and winter cups.",
      "customer_friendly_summary": "Dark-berry depth in the middle of the cup.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Schisandra",
      "botanical_name": "Schisandra chinensis",
      "part_used": "berry",
      "role_in_formula": "The intrigue — one of the record's named berry trio, with a flavor that moves as you drink it.",
      "traditional_use": "Schisandra berries are a traditional East Asian botanical, long used in teas and tonic preparations.",
      "customer_friendly_summary": "A shifting, five-flavor depth note.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Hawthorn",
      "botanical_name": "Crataegus monogyna",
      "part_used": "berry",
      "role_in_formula": "The soft roundness — crushed berries, the third of the record's berry trio, smoothing the blend's edges.",
      "traditional_use": "Hawthorn berries have a long traditional use in European herbal teas.",
      "customer_friendly_summary": "Soft roundness at the finish.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "Hibiscus calyces, crushed rose hips, dried elderberries, schisandra berries, crushed hawthorn berries, rose petals, cinnamon.",
  "recipe_internal": {
    "status": "ADOPTED — owner-approved 2026-10-30; staged, not yet deployed",
    "source_document": "house-blend-recipes-2026-10-30.md",
    "basis": "Parts by weight. Per 1 oz = 28.35 g; standard batch 16 oz = 453.6 g; the tea-bag pack of 20 is filled from 1 oz of blend (approx. 1.42 g per bag).",
    "ingredients": [
      { "name": "Hibiscus calyces", "parts": 7, "grams_per_1oz": 9.92, "grams_per_16oz_batch": 158.72 },
      { "name": "Rose hip, crushed", "parts": 4, "grams_per_1oz": 5.67, "grams_per_16oz_batch": 90.72 },
      { "name": "Elderberry, dried", "parts": 3, "grams_per_1oz": 4.25, "grams_per_16oz_batch": 68.0 },
      { "name": "Schisandra berries", "parts": 2, "grams_per_1oz": 2.84, "grams_per_16oz_batch": 45.44 },
      { "name": "Hawthorn berries, crushed", "parts": 2, "grams_per_1oz": 2.83, "grams_per_16oz_batch": 45.28 },
      { "name": "Rose petals", "parts": 1, "grams_per_1oz": 1.42, "grams_per_16oz_batch": 22.72 },
      { "name": "Cinnamon chips", "parts": 1, "grams_per_1oz": 1.42, "grams_per_16oz_batch": 22.72 }
    ],
    "display_five_basis": "First five botanicals in recipe order (7/4/3/2/2 parts). Rose petals and cinnamon (1 part each) appear in the complete list only. The adoption retires the staged display list's blackberry and bilberry, which the adopted recipe deliberately excludes (no tea use for bilberry anywhere in the apothecary's data; blackberry appears nowhere in her data).",
    "preparation_decision": "Owner decision 2026-10-30: crushed berries + the full 15-minute steep — one instruction valid for both the loose-leaf and tea-bag forms; no pre-decoction step is printed."
  },
  "traditional_uses": "A house blend in the apothecary's own tradition — blended for flavor, aroma, and the ritual of the cup.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Jewel-toned evening ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "House-blend recipe adopted at the owner's approval on 2026-10-30 (house-blend-recipes-2026-10-30.md): deep ruby and tart-sweet — hibiscus tang up front, rose hip body, dark-berry depth from elderberry and schisandra, hawthorn's soft roundness, and cinnamon warmth at the finish. Rose hip's tea use was owner-confirmed the same day. The full formula is published in the complete ingredient list; proportions by weight are held in this record's internal recipe data.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz boiling water (212°F) for the full 10-15 minutes — the crushed berries need the long steep to give up their color and depth. Cover while steeping, strain, and pour in glass if you can: this one is a performance.",
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
      "Formula adopted 2026-10-30: the full ingredient list is published in this record; proportions are held in internal recipe data (recipe_internal).",
      "Rose hip tea use owner-confirmed 2026-10-30; the herb-library rose hip entry now lists tea alongside serum and balm."
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
  "ritual_name": "The Garnet Performance",
  "ritual_purpose": "A dramatic ritual for candlelit tables and gorgeous glasses.",
  "ritual_how_to": "Brew in glass and watch the color take the stage. Serve hot for drama, iced for applause.",
  "ritual_duration": "10-15 minutes",
  "best_for": "Candlelit dinners, dramatic iced tea, and berry lovers.",
  "ritual_tip": "Freeze a few berries into the ice cubes and thank yourself later.",
  "seo_title": "Velvet Hibiscus Berry Tea — Hibiscus & Dark Berries | Amber's Alchemy Apothecary",
  "seo_description": "A new specialty house blend: hibiscus, dark berries and rose hips in a garnet cup. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
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
