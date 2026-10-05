/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Custom Herbal Capsules",
  "handle": "custom-herbal-capsules",
  "sku": "CUSTOM-CAPSULES-001",
  "category": "Custom & Consultations",
  "subcategory": "Custom Formulas",
  "price": 33.33,
  "compare_at_price": null,
  "subscriber_price": 30,
  "sizes": "30 custom-filled capsules",
  "variants": [
    {
      "name": "Two Week Custom Blend - 28 capsules",
      "sku": "AAA- CUSTOMHERBALCAPSUL-28CAP",
      "price": 33.33,
      "unit": "28 capsules",
      "requires_shipping": true,
      "fulfillment": "ship"
    },
    {
      "name": "Full Month Custom Blend - 60 capsules",
      "sku": "AAA- CUSTOMHERBALCAPSUL-60CAP",
      "price": 60,
      "unit": "60 capsules",
      "requires_shipping": true,
      "fulfillment": "ship"
    }
  ],
  "tags": [
    "custom capsules",
    "personalized herbs",
    "build your own",
    "custom formula"
  ],
  "images": [],
  "short_description": "A personalized capsule blend crafted around your body, goals, and herbal needs.",
  "extended_description": "Custom Herbal Capsules are made for the person who does not fit into a generic wellness box. Share your goals, symptoms, and preferences, and Amber hand-selects botanicals from her apothecary inventory to create a small-batch formula just for you. This is a made-to-order custom product — the exact botanicals are chosen per customer intake, not from a fixed formula.",
  "featured_ingredients": [],
  "complete_ingredients": "Ingredients vary by customer intake form and selected formula goals. (Sourced verbatim.) Botanicals are hand-selected from Amber's apothecary inventory per intake.",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Personalized herbal formula",
      "evidence_context": "not_applicable",
      "note": "Service/product feature from source, not an efficacy claim."
    },
    {
      "property": "Hand-filled small batch",
      "evidence_context": "not_applicable",
      "note": "Production attribute from source, not a health claim."
    },
    {
      "property": "Custom wellness support",
      "evidence_context": "not_applicable",
      "note": "Service feature; 'support' framed as general wellness, no disease claims."
    },
    {
      "property": "Built around your goals",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    }
  ],
  "formulation_rationale": "Custom-formula framework: botanicals are hand-selected from Amber's apothecary inventory based on the customer's goals, symptoms, and preferences (sourced). No fixed formula is published; the rationale is individualized per intake. No featured ingredients assigned — doing so would fabricate a fixed formula.",
  "process": "Sourced workflow: (1) customer completes intake form; (2) Amber reviews intake; (3) Amber crafts the blend; (4) follow-up details are sent to the customer. Blending method, capsule type, documentation, and quality steps beyond this are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "How it works: complete the intake form with your goals, symptoms, and preferences; Amber reviews it, hand-selects botanicals, and crafts your small-batch capsule blend; follow-up details are sent to you. (Sourced workflow.) Serving/dosage details, intake-form URL, and turnaround time are not published in the source — NEEDS_VERIFICATION.",
  "warnings": [
    "If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. (Sourced.)",
    "Keep out of reach of children. (Sourced.)",
    "Review ingredients for allergies, pregnancy, medication interactions, and individual contraindications. (Sourced concept.)",
    "Individual experiences vary."
  ],
  "allergens": "NEEDS_VERIFICATION — ingredients vary per customer blend; confirm finished-formula allergen statement with owner before publication.",
  "storage": "Store in a cool, dry place — standard care for herbal capsules. Product-specific storage instructions are not published in the source and are flagged NEEDS_VERIFICATION.",
  "disclaimer": "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medication, or have a medical condition, consult a qualified healthcare professional before use. Keep out of reach of children.",
  "related_products": [
    "custom-remedy-consultation",
    "personalized-herbal-protocols",
    "custom-tea-blends"
  ],
  "frequently_bought_together": [
    "custom-remedy-consultation",
    "personalized-herbal-protocols"
  ],
  "inventory_status": "NEEDS_VERIFICATION",
  "review_summary": "",
  "provenance": {
    "sources": [
      "catalog.master.json (AwakenAgain_Merged_Master_Catalog, merged master catalog)",
      "ambers_alchemy_products_for_automation_ai.json (merged catalog sources/)"
    ],
    "price_authority": "Owner-approved price list 2026-10-04 (parent task)",
    "image_source": "IMAGE_MAP.md + image_manifest.csv (no product image mapped for these 6 handles)",
    "last_verified": "2026-10-04",
    "price_tension_note": "Newest-catalog per-product value $33.33 used per owner instruction (newest verified instructions win). TENSION NOTED: this conflicts with the provisional '$11.99/oz for custom non-soap remedies' rule recorded in MEMORY; the per-product newest value wins per owner instruction, but price remains PROPOSED pending owner confirmation.",
    "notes": [
      "Handle preserved as canonical ID.",
      "CUSTOM-FORMULA PRODUCT — no fixed formula; featured_ingredients intentionally empty per binding rules (ingredients vary by customer intake).",
      "Legacy variant prices (28 capsules $33.33; 60 capsules $60.00) are legacy-sourced; base price per owner price authority.",
      "automation_json notes the capsule-jar product image was 'not uploaded / if available' at source time.",
      "Intake-form URL, dosage/serving details, capsule type, and turnaround time not published in source — flagged, not invented."
    ]
  },
  "field_verification": {
    "price": "PROPOSED — awaiting owner confirmation (newest-catalog $33.33 used; tension with provisional $11.99/oz custom-remedy rule noted in provenance)",
    "featured_ingredients": "CUSTOM_FORMULA — source states ingredients vary by customer intake; intentionally empty, not an omission",
    "complete_ingredients": "SOURCED — 'Ingredients vary by customer intake form and selected formula goals'",
    "traditional_uses": "NOT_APPLICABLE — custom formula; no fixed botanicals",
    "images": "MISSING_ASSET — no product image mapped in IMAGE_MAP.md or image_manifest.csv; catalog image fields point to /images/products/custom-herbal-capsules.webp/.png which are catalog-safe generated fallbacks (image_status: placeholder)",
    "variants": "LEGACY-SOURCED — variant prices from catalog.master.json; owner confirmation recommended (note 28-cap vs '30 custom-filled capsules' size-field tension)",
    "process": "PARTIAL — four-step workflow sourced; blending/capsule/quality details NEEDS_VERIFICATION",
    "directions": "PARTIAL — workflow sourced; intake URL, dosage, turnaround NEEDS_VERIFICATION",
    "allergens": "NEEDS_VERIFICATION",
    "storage": "GENERAL-GUIDANCE — product-specific instructions NEEDS_VERIFICATION",
    "inventory_status": "NEEDS_VERIFICATION",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-05"
};
