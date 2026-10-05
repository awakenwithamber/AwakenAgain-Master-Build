/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Custom Remedy Consultation",
  "handle": "custom-remedy-consultation",
  "sku": "AAA-CUSTOM-REMEDY-CONSULTATI",
  "category": "Custom & Consultations",
  "subcategory": "Services",
  "price": 33.33,
  "compare_at_price": null,
  "subscriber_price": 30,
  "sizes": "",
  "variants": [
    {
      "name": "Custom Remedy Consultation",
      "sku": "AAA- CUSTOMREMEDYCONSUL-CONSULT",
      "price": 33.33,
      "unit": "consultation",
      "requires_shipping": false,
      "fulfillment": "digital"
    }
  ],
  "tags": [],
  "images": [],
  "short_description": "A custom consultation for customers who want a personalized herbal direction, product match, or full apothecary protocol.",
  "extended_description": "A custom consultation for customers who want a personalized herbal direction, product match, or full apothecary protocol. (Sourced.) This is a service offering — no botanicals are assigned, and no fixed deliverables beyond the consultation itself are published in the source.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — service only; no ingredients. (Sourced.)",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Personalized support",
      "evidence_context": "not_applicable",
      "note": "Service feature from source, not an efficacy claim."
    },
    {
      "property": "Helps choose the right products",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    },
    {
      "property": "Great for complex goals",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    },
    {
      "property": "Builds trust and repeat visits",
      "evidence_context": "not_applicable",
      "note": "Business attribute from source, not a customer-facing health claim."
    }
  ],
  "formulation_rationale": "NOT_APPLICABLE — consultation service; no formulation.",
  "process": "Sourced workflow: customer books the consultation and completes an intake form before the appointment. Session length, format (call/video/in-person), rescheduling policy, and booking URL are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "How it works: book the consultation, then complete the intake form before your appointment. (Sourced.) How booking is done (link/platform), session format and length, and what you receive afterward are not published in the source — NEEDS_VERIFICATION. No booking URL is invented.",
  "warnings": [
    "For general wellness and educational purposes only. (Sourced.)",
    "Custom recommendations are not a diagnosis or treatment plan. (Sourced.)",
    "Review ingredients for allergies, pregnancy, medication interactions, and individual contraindications, and consult a qualified healthcare professional when appropriate. (Sourced.)",
    "Individual experiences vary."
  ],
  "allergens": "NOT_APPLICABLE — service only; no ingredients.",
  "storage": "NOT_APPLICABLE — service; no physical product to store.",
  "disclaimer": "For general wellness and educational purposes only. Custom recommendations are not a diagnosis or treatment plan. Review ingredients for allergies, pregnancy, medication interactions, and individual contraindications, and consult a qualified healthcare professional when appropriate.",
  "related_products": [
    "personalized-herbal-protocols",
    "custom-herbal-capsules",
    "custom-tea-blends"
  ],
  "frequently_bought_together": [
    "custom-herbal-capsules",
    "personalized-herbal-protocols"
  ],
  "inventory_status": "service — no inventory",
  "review_summary": "",
  "provenance": {
    "sources": [
      "catalog.master.json (AwakenAgain_Merged_Master_Catalog, merged master catalog)"
    ],
    "price_authority": "Owner-approved price list 2026-10-04 (parent task)",
    "image_source": "IMAGE_MAP.md + image_manifest.csv (no product image mapped for these 6 handles)",
    "last_verified": "2026-10-04",
    "notes": [
      "Handle preserved as canonical ID.",
      "Non-botanical service — featured_ingredients intentionally empty per binding rules.",
      "Session length, format, booking URL, rescheduling, and post-session deliverables not published in source — flagged, not invented."
    ]
  },
  "field_verification": {
    "price": "VERIFIED — owner price authority 2026-10-04",
    "featured_ingredients": "NOT_APPLICABLE — service; note recorded, no ingredients invented",
    "complete_ingredients": "NOT_APPLICABLE — sourced 'Service only; no ingredients'",
    "traditional_uses": "NOT_APPLICABLE — service",
    "formulation_rationale": "NOT_APPLICABLE — service",
    "process": "PARTIAL — booking + pre-appointment intake sourced; session format/length NEEDS_VERIFICATION",
    "directions": "PARTIAL — booking/intake flow sourced; booking URL, format, length, deliverables NEEDS_VERIFICATION",
    "images": "MISSING_ASSET — no product image mapped in IMAGE_MAP.md or image_manifest.csv; catalog image fields point to /images/products/custom-remedy-consultation.webp/.png which are catalog-safe generated fallbacks (image_status: placeholder)",
    "inventory_status": "service — no inventory (honest status for a service)",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-05"
};
