/**
 * HAND-AUTHORED — owner directive 2026-10-30 (create the listing).
 * Amber's shea butter / goat milk Small Rose for sensitive skin, identified
 * by the owner on 2026-10-30 from her upload file 81. Formula EXACTLY as she
 * stated it: shea butter and goat milk, no added oils, scents, or botanicals
 * — nothing further was invented for this record (no lye/oils/fragrance
 * entries were added).
 *
 * OWNER RULING 2026-10-30 07:41 MDT (supersedes the earlier staged
 * placement): (1) the name "Shea & Goat Milk Small Rose Soap" is APPROVED;
 * (2) weight/price are set to the artwork's 3 oz / $4.77 PROVISIONALLY,
 * pending her confirmation of the actual weight and pricing — they still
 * conflict with the owner-confirmed Small Rose canon (2 oz / $5.77,
 * lib/catalog/shapes.ts), and the same 3 OZ / $4.77 pair previously
 * appeared on Small Rose artwork and was corrected to canon on
 * 2026-10-22, so both values stay flagged below; (3) the product is
 * placed in the "Soaps" category and on the home page Soap Shelf;
 * (4) it is a finished, fixed bar sold exactly as pictured — the Soap
 * Builder / SoapCustomizer must NOT add fragrances or alter its formula.
 *
 * Fixed-formula mechanism (how ruling (4) is enforced): this record
 * carries `fixed_formula: true`. The predicate isFixedFormulaProduct
 * (lib/catalog/status.ts) is consulted by the product page's purchase
 * section (renders the standard VariantAddToCart path, never the
 * SoapCustomizer) and by the server order gate isSoapProduct
 * (lib/checkout/order.ts), which rejects any customization attached to
 * this handle. It sells through the standard variant path at this
 * record's own staged price — never the soap shape table.
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Shea & Goat Milk Small Rose Soap",
  "handle": "shea-goat-milk-small-rose-soap",
  "sku": "SOAP-SHEA-GOATMILK-001",
  "category": "Soaps",
  "subcategory": "Artisan Soap",
  "fixed_formula": true,
  "price": 4.77,
  "compare_at_price": null,
  "subscriber_price": 4.29,
  "price_flag": "PROVISIONAL (owner ruling 2026-10-30) — price set to the owner's product artwork value (3 oz / $4.77) pending her confirmation of actual weight and pricing; conflicts with owner-confirmed Small Rose canon (2 oz / $5.77). Do not treat as confirmed pricing.",
  "sizes": [
    "3 oz"
  ],
  "variants": [
    {
      "variant_id": "shea-goat-milk-small-rose-soap-small-rose",
      "name": "Small Rose",
      "shape": "Small Rose",
      "size": "3 oz",
      "weight_oz": 3,
      "price": 4.77,
      "subscriber_price": 4.29,
      "currency": "USD",
      "sku": "SOAP-SHEA-GOATMILK-SMALLROSE",
      "sku_status": "NEEDS_VERIFICATION",
      "availability": "NEEDS_VERIFICATION",
      "price_status": "PROVISIONAL (owner ruling 2026-10-30) — artwork-stated $4.77 for 3 oz, set pending her confirmation of actual weight and pricing; owner-confirmed canon for the Small Rose shape is 2 oz / $5.77. Do not treat as confirmed pricing."
    }
  ],
  "images": [
    {
      "src": "/images/products/shea-goat-milk-small-rose-soap.webp",
      "alt": "Shea & Goat Milk Small Rose Soap — the maker's own photograph: a cream rose-mold bar with a pale peach base layer, beside a lit candle in candlelit apothecary styling",
      "role": "primary",
      "status": "mapped_photo",
      "provenance": "Owner upload 2026-10-30 (upload file 81, 8149_81_phb9.jpg); identified by the owner on 2026-10-30 as her shea butter / goat milk Small Rose for sensitive skin.",
      "note": "Owner-ruled identification 2026-10-30. Story-format photograph; the letterbox bars were cropped on 2026-10-30 (scene band y 458–1470 of the 1080×1920 frame) — the bar and scene are otherwise untouched."
    }
  ],
  "short_description": "A plain, quiet Small Rose poured from shea butter and goat milk — no added oils, no scents, no botanicals — the bar Amber makes for sensitive skin.",
  "extended_description": "This is the simplest bar in the apothecary, and that is the whole point. Shea butter and goat milk, poured into the Small Rose mold — nothing scented, nothing added, nothing to hide behind. A creamy, gentle lather and the soft, clean feel of a bar made for skin that prefers its care plain.\n\nIf your skin asks for less, this rose is the answer Amber pours.",
  "featured_ingredients": [
    {
      "name": "Shea Butter",
      "botanical_name": "Vitellaria paradoxa (syn. Butyrospermum parkii)",
      "part_used": "seed (butter)",
      "role_in_formula": "One of the bar's two owner-stated ingredients — the rich, emollient base.",
      "traditional_use": "Traditionally used in West African skin-care traditions as a moisturizing butter.",
      "properties": [
        "Emollient",
        "Skin-conditioning"
      ],
      "key_constituents": null,
      "evidence_context": "mixed_with_note",
      "customer_friendly_summary": "A beloved botanical butter that helps the bar feel rich and leaves skin feeling soft after rinsing.",
      "evidence_note": "cosmetic_function: emollient/skin-conditioning in rinse-off cosmetics; traditional_use in skin care. Taxonomy mirrors the catalog's own Gaia's Rose record."
    },
    {
      "name": "Goat Milk",
      "botanical_name": "Capra hircus (milk)",
      "part_used": "milk",
      "role_in_formula": "One of the bar's two owner-stated ingredients — the creamy heart of the bar.",
      "traditional_use": "Goat milk has been used in bathing traditions for centuries for its gentle, creamy feel.",
      "properties": [
        "Skin-conditioning",
        "Emollient (in rinse-off cosmetic formulas)"
      ],
      "key_constituents": null,
      "evidence_context": "mixed_with_note",
      "customer_friendly_summary": "The creamy heart of the bar — it helps the lather feel soft and gentle on sensitive skin.",
      "evidence_note": "cosmetic_function: skin-conditioning/emollient in rinse-off cosmetics; traditional_use: long history in bathing rituals. Mirrors the catalog's own Gaia's Rose record."
    }
  ],
  "complete_ingredients": "Shea butter, goat milk.",
  "traditional_uses": [
    "Goat milk has a centuries-long tradition in gentle bathing rituals.",
    "Shea butter is traditionally used in West African skin-care traditions as a moisturizing butter."
  ],
  "properties": [
    {
      "property": "Cleansing",
      "evidence_context": "cosmetic_function",
      "note": "A finished soap bar cleanses skin of dirt and oil."
    },
    {
      "property": "Soft, skin-conditioning lather",
      "evidence_context": "cosmetic_function",
      "note": "Shea butter and goat milk contribute emollient, skin-conditioning properties in rinse-off use."
    },
    {
      "property": "Unscented and plain by design",
      "evidence_context": "cosmetic_function",
      "note": "No added oils, scents, or botanicals (owner-stated formula, 2026-10-30)."
    }
  ],
  "formulation_rationale": "Owner-stated 2026-10-30: shea butter and goat milk only — a deliberately plain bar for sensitive skin, with no added oils, scents, or botanicals. Recorded exactly as stated; nothing further established.",
  "formulation_rationale_flag": "NEEDS_VERIFICATION — owner to confirm the complete ingredient list before publication",
  "process": "Handcrafted in small batches (owner's stated practice). Saponification method, cure time, and batch details are not stated in source materials.",
  "process_flag": "NEEDS_VERIFICATION",
  "directions": "Lather with water, cleanse, and rinse. Keep the bar dry between uses (a draining soap dish extends its life).",
  "warnings": "For external use only. Avoid contact with eyes. Discontinue use and rinse if irritation occurs. Patch test first if you have sensitive skin.",
  "allergens": "Contains goat milk (milk) and shea butter (from shea nut, a tree-nut botanical). Derived from the owner-stated ingredient list only — not a verified allergen statement.",
  "storage": "Store on a draining soap dish and keep dry between uses to extend the bar's life.",
  "disclaimer": "For external cleansing use only. Avoid contact with eyes. Discontinue use if irritation occurs. Patch test first if you have sensitive skin. This cosmetic product is not intended to diagnose, treat, cure, or prevent any disease.",
  "related_products": [
    "gaias-rose-soap",
    "lavender-fairy-dream-soap",
    "custom-botanical-soap"
  ],
  "frequently_bought_together": [
    "gaias-rose-soap"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "tags": [
    "Soaps",
    "Artisan Soap",
    "unscented",
    "shea butter",
    "goat milk",
    "sensitive skin",
    "rose soap",
    "small rose"
  ],
  "provenance": {
    "sources": [
      "Owner directive 2026-10-30 (create a dedicated listing for the Small Rose Soap)",
      "Owner identification 2026-10-30: upload file 81 is her shea butter / goat milk Small Rose for sensitive skin — no added oils, scents, or botanicals"
    ],
    "price_authority": "PROVISIONAL (owner ruling 2026-10-30 07:41 MDT) — artwork states 3 oz / $4.77; the owner set those values provisionally pending her confirmation of actual weight and pricing. Owner-confirmed canon for the Small Rose shape is 2 oz / $5.77 (lib/catalog/shapes.ts; confirmed 2026-10-19, higher pricing wins). The 3 OZ / $4.77 pair also appeared on the Small Rose promo card and was corrected to canon in the 2026-10-22 regeneration (see rec-gaias-rose-soap image note). Conflict NOT resolved — her confirmation governs.",
    "image_source": "Owner-supplied photograph (upload file 81, 8149_81_phb9.jpg), letterbox-cropped and converted to WebP 2026-10-30; registered in lib/media/image-manifest.ts as asset_product_shea_goat_milk_small_rose_soap (OWNER_UPLOADED).",
    "last_verified": "2026-10-30",
    "notes": [
      "Dedupe check 2026-10-30: no existing catalog record describes a shea butter / goat milk unscented Small Rose bar. Gaia's Rose Soap contains goat milk and shea among scented botanicals and is sold through the soap customizer — a different product. The 'goat-milk-shea' SoapBase in the builder is a base option, not a listing.",
      "Name 'Shea & Goat Milk Small Rose Soap' was composed from the owner's own description to match catalog naming (cf. Gaia's Rose Soap, Lavender Fairy Dream Soap) — APPROVED by the owner 2026-10-30 07:41 MDT.",
      "Category placement SUPERSEDED 2026-10-30 07:41 MDT: originally staged in 'Bath & Body' to keep the fixed bar away from the SoapCustomizer; the owner ruled it belongs in 'Soaps' (and on the home Soap Shelf) with a hard no-customization constraint. Implemented via fixed_formula: true — the product page renders the standard variant path (never the SoapCustomizer) and the server order gate rejects any customization attached to this handle, so the bar sells exactly as pictured at this record's own staged price."
    ]
  },
  "field_verification": {
    "title": "APPROVED — owner ruling 2026-10-30 07:41 MDT (name composed from her own description)",
    "price": "PROVISIONAL — owner ruling 2026-10-30 set the artwork-stated $4.77 pending her confirmation of actual pricing; conflicts with owner-confirmed Small Rose canon 2 oz / $5.77",
    "subscriber_price": "COMPUTED — standard 10% Living Grimoire mechanic, round(price * 0.9, 2); inherits the price flag above",
    "sizes": "PROVISIONAL — owner ruling 2026-10-30 set the artwork-stated 3 oz pending her confirmation of actual weight; canon Small Rose is 2 oz",
    "variants": "PROVISIONAL — single fixed variant staged from the artwork and the owner's description; weight/price pending her confirmation",
    "featured_ingredients": "OWNER_STATED — shea butter and goat milk only, 2026-10-30",
    "complete_ingredients": "NEEDS_VERIFICATION — recorded exactly as the owner stated it (shea butter, goat milk; no added oils, scents, or botanicals); owner to confirm the complete ingredient list before publication. Nothing was invented or added.",
    "images": "OWNER_UPLOADED — owner's photograph (file 81), letterbox-cropped 2026-10-30",
    "directions": "STANDARD_SOAP_CARE — mirrors the catalog's soap records",
    "warnings": "COMPLIANCE_STANDARD — mirrors the catalog's soap records",
    "allergens": "INFERRED_FROM_OWNER_STATED_FORMULA — mirrors the catalog's own goat milk / shea wording in rec-gaias-rose-soap; not a verified allergen statement",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-30",
  "stock_status": "in_stock",
  "fulfillment_type": "physical_shipped",
  "lead_time_days": 3,
  "requires_shipping": true,
  "digital_delivery": null,
  "seo_title": "Shea & Goat Milk Small Rose Soap — Unscented Bar for Sensitive Skin | Amber's Alchemy Apothecary",
  "seo_description": "A plain, unscented Small Rose bar poured from shea butter and goat milk — no added oils, scents, or botanicals. The bar Amber makes for sensitive skin.",
  "source_provenance": {
    "record_origin": "hand_authored",
    "directive": "Owner directive 2026-10-30: create a dedicated product listing for the shea butter / goat milk Small Rose (sensitive skin, no added oils, scents, or botanicals), using her supplied photo (file 81); verify actual weight, price, formula, and complete ingredients before publishing.",
    "status": "PROPOSED"
  },
  "verification": {
    "status": "PROPOSED",
    "notes": "Added 2026-10-30 at owner direction, staged only. Weight, price, and the complete ingredient list are flagged NEEDS VERIFICATION throughout this record. Descriptive copy is sensory only per the strengthened copy rule (2026-10-27). Image is the owner's own photograph, registered as OWNER_UPLOADED in lib/media/image-manifest.ts."
  }
};
