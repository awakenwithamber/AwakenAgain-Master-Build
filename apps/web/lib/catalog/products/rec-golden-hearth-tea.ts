/**
 * HAND-AUTHORED — owner directive 2026-10-30 (13 specialty teas build).
 * Not part of the products.canonical.v3.json port: every capsule formula is
 * also offered as a tea ($9 loose leaf 1 oz / $11 handmade bags, pack of 20),
 * plus four new house blends described by botanical theme only.
 * Copy is sensory/ritual only per the strengthened copy rule (2026-10-27).
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Golden Hearth Tea",
  "handle": "golden-hearth-tea",
  "sku": "TEA-GOLDENHEARTH-001",
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
      "sku": "TEA-GOLDENHEARTH-LOOSE-001",
      "price": 9,
      "unit": "1 oz loose leaf",
      "quantity": 1,
      "requires_shipping": true,
      "fulfillment": "physical_shipped"
    },
    {
      "name": "Handmade Tea Bags - Pack of 20",
      "sku": "TEA-GOLDENHEARTH-BAGS-001",
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
    "spiced",
    "winter",
    "new blend"
  ],
  "images": [
    {
      "src": "/images/products/golden-hearth-tea.webp",
      "alt": "Golden Hearth Tea — generated representation: jar of spiced loose-leaf tea with cinnamon sticks and star anise beside a steaming cup by firelight",
      "provenance": "GENERATED_REPRESENTATION",
      "status": "GENERATED_REPRESENTATION"
    }
  ],
  "short_description": "Cinnamon, star anise and orange peel warmth — a fireside cup that tastes like the kitchen in December.",
  "extended_description": "Golden Hearth Tea is the apothecary's winter kitchen in a cup: warm baking spices, bright orange peel, and a deep amber pour that fogs the glasses and scents the whole room. It's a house blend composed for the cold months — the tea you make when people are coming in from the weather and need something warm in their hands before they've even taken their coats off. Brew a big pot; this one is for passing around.",
  "featured_ingredients": [
    {
      "name": "Cinnamon",
      "botanical_name": "Cinnamomum verum",
      "part_used": "bark",
      "role_in_formula": "The lead spice and the blend's warm foundation — bark chips, cut small so they give themselves up in the steep.",
      "traditional_use": "A classic warming spice with a long traditional place in winter teas and chai-style blends.",
      "customer_friendly_summary": "The warm spice foundation of the blend.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Orange Peel",
      "botanical_name": "Citrus sinensis",
      "part_used": "peel",
      "role_in_formula": "The citrus lift — bright peel that keeps the deep spices from sitting heavy in the cup.",
      "traditional_use": "Orange peel has a long traditional home in teas enjoyed after rich meals.",
      "customer_friendly_summary": "The bright citrus lift over the spices.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Ginger",
      "botanical_name": "Zingiber officinale",
      "part_used": "root",
      "role_in_formula": "The heat underneath — dried root pieces that warm the cup from below.",
      "traditional_use": "Ginger root is one of the world's longest-used tea botanicals, traditional in warming blends everywhere.",
      "customer_friendly_summary": "The gentle heat underneath the spice.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Cardamom",
      "botanical_name": "Elettaria cardamomum",
      "part_used": "pods",
      "role_in_formula": "The aromatic heart — lightly crushed pods with a sweet, resinous perfume.",
      "traditional_use": "Cardamom is a traditional cornerstone of chai and Middle Eastern spiced teas.",
      "customer_friendly_summary": "The sweet, resinous aromatic heart.",
      "evidence_status": "traditional_use"
    },
    {
      "name": "Star Anise",
      "botanical_name": "Illicium verum",
      "part_used": "fruit",
      "role_in_formula": "The sweet finish — broken stars with a gentle licorice warmth at the end of the sip.",
      "traditional_use": "Star anise is a classic fireside spice, traditional in winter teas and chai-style blends.",
      "customer_friendly_summary": "The sweet, licorice-warm finish.",
      "evidence_status": "traditional_use"
    }
  ],
  "complete_ingredients": "Cinnamon bark, orange peel, ginger root, cardamom pods, star anise, fennel seed, clove.",
  "recipe_internal": {
    "status": "ADOPTED — owner-approved 2026-10-30; staged, not yet deployed",
    "source_document": "house-blend-recipes-2026-10-30.md",
    "basis": "Parts by weight. Per 1 oz = 28.35 g; standard batch 16 oz = 453.6 g; the tea-bag pack of 20 is filled from 1 oz of blend (approx. 1.42 g per bag).",
    "ingredients": [
      { "name": "Cinnamon bark chips", "parts": 6, "grams_per_1oz": 8.5, "grams_per_16oz_batch": 136.0 },
      { "name": "Orange peel", "parts": 4, "grams_per_1oz": 5.67, "grams_per_16oz_batch": 90.72, "sourcing": "Sourced ingredient (owner decision 2026-10-30); added to the herb library as 'orange-peel' the same day. Records only — no purchase is recorded in this staging pass." },
      { "name": "Ginger root, dried pieces", "parts": 3, "grams_per_1oz": 4.25, "grams_per_16oz_batch": 68.0 },
      { "name": "Cardamom pods, lightly crushed", "parts": 2, "grams_per_1oz": 2.84, "grams_per_16oz_batch": 45.44 },
      { "name": "Star anise, broken", "parts": 2, "grams_per_1oz": 2.84, "grams_per_16oz_batch": 45.44 },
      { "name": "Fennel seed", "parts": 2, "grams_per_1oz": 2.84, "grams_per_16oz_batch": 45.44 },
      { "name": "Clove, whole", "parts": 1, "grams_per_1oz": 1.41, "grams_per_16oz_batch": 22.56 }
    ],
    "display_five_basis": "First five botanicals in recipe order (6/4/3/2/2 parts). The 2-part tie is broken by recipe order, so fennel seed (also 2 parts, sixth in the recipe) appears in the complete list only."
  },
  "traditional_uses": "A house blend in the apothecary's own tradition — blended for flavor, aroma, and the ritual of the cup.",
  "properties": [
    {
      "property": "Small-batch handcrafted",
      "evidence_context": "not_applicable",
      "note": "Production feature from source, not an efficacy claim."
    },
    {
      "property": "Fireside spice ritual",
      "evidence_context": "traditional_use",
      "note": "Sensory and ritual framing only; not a benefit or efficacy claim."
    }
  ],
  "formulation_rationale": "House-blend recipe adopted at the owner's approval on 2026-10-30 (house-blend-recipes-2026-10-30.md): warm and spiced — cinnamon bark first, a citrus lift from orange peel, ginger heat underneath, and a sweet anise-fennel finish. The full formula is published in the complete ingredient list; proportions by weight are held in this record's internal recipe data. Orange peel is a sourced ingredient for this blend (owner decision 2026-10-30) and was added to the herb library the same day.",
  "process": "Handcrafted in small batches (sourced attribute). Detailed production steps — blending method, batch size, quality checks, packaging — are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "Steep 1-2 tsp loose leaf (or 1 handmade bag) per 8 oz near-boiling water (about 212°F) for 10-15 minutes. Cut the cinnamon chips small so the spice gives itself up in the steep — or simmer the spice portion gently for 5 minutes before adding the rest. Cover while steeping to keep the aromatics in the cup, then strain and sip slowly.",
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
      "Orange peel is a sourced ingredient for this blend (owner decision 2026-10-30); its herb-library entry was added the same day. Records only — no purchase was made in this staging pass."
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
  "ritual_name": "The Welcoming Pot",
  "ritual_purpose": "A hearth ritual for warming up whoever walks through the door.",
  "ritual_how_to": "Brew a full pot when company comes in from the cold. Hand out mugs first, ask questions second.",
  "ritual_duration": "10-15 minutes",
  "best_for": "Winter gatherings, holiday kitchens, and fireside reading.",
  "ritual_tip": "Simmer a spoonful on the stove and the whole house joins the ritual.",
  "seo_title": "Golden Hearth Tea — Cinnamon, Star Anise & Orange | Amber's Alchemy Apothecary",
  "seo_description": "A new specialty house blend: warm spices and orange peel in a fireside cup. Loose leaf 1 oz or handmade tea bags, pack of 20. Small-batch, handcrafted.",
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
