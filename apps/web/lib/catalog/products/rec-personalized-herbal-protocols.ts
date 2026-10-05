/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Personalized Herbal Protocols",
  "handle": "personalized-herbal-protocols",
  "sku": "AAA-PERSONALIZED-HERBAL-PROT",
  "category": "Custom & Consultations",
  "subcategory": "Services",
  "price": 77.77,
  "compare_at_price": null,
  "subscriber_price": 69.99,
  "sizes": "",
  "variants": [
    {
      "name": "Written Personalized Protocol",
      "sku": "AAA- PERSONALIZEDHERBAL-PROTOCOL",
      "price": 77.77,
      "unit": "digital protocol",
      "requires_shipping": false,
      "fulfillment": "digital"
    }
  ],
  "tags": [],
  "images": [],
  "short_description": "A deeper written protocol combining product suggestions, rituals, herbs, lifestyle notes, and an easy follow-through plan.",
  "extended_description": "A deeper written protocol combining product suggestions, rituals, herbs, lifestyle notes, and an easy follow-through plan. (Sourced.) This is a digital/written service deliverable — no botanicals are assigned to the service itself; the recommended herbs and products are chosen per customer intake.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — service only; no ingredients. (Sourced.)",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Premium personalized support",
      "evidence_context": "not_applicable",
      "note": "Service feature from source, not an efficacy claim."
    },
    {
      "property": "Clear step-by-step plan",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    },
    {
      "property": "Pairs products and rituals",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    },
    {
      "property": "Excellent high-value offer",
      "evidence_context": "not_applicable",
      "note": "Business attribute from source, not a customer-facing health claim."
    }
  ],
  "formulation_rationale": "NOT_APPLICABLE — written consultation service; no formulation.",
  "process": "Sourced workflow: customer completes a detailed intake; Amber creates a personalized PDF-style protocol. Intake questions, protocol length/format, turnaround time, revision policy, and delivery method are not published in the source and are flagged NEEDS_VERIFICATION.",
  "directions": "How it works: complete the detailed intake; Amber creates your personalized written protocol combining product suggestions, rituals, herbs, lifestyle notes, and an easy follow-through plan. (Sourced.) Turnaround time, delivery method, and revision policy are not published in the source — NEEDS_VERIFICATION. No booking URL is invented.",
  "warnings": [
    "For general wellness and educational purposes only. (Sourced.)",
    "Custom recommendations are not a diagnosis or treatment plan. (Sourced.)",
    "Review ingredients for allergies, pregnancy, medication interactions, and individual contraindications, and consult a qualified healthcare professional when appropriate. (Sourced.)",
    "Individual experiences vary."
  ],
  "allergens": "NOT_APPLICABLE — service only; no ingredients.",
  "storage": "NOT_APPLICABLE — digital deliverable; no physical product to store.",
  "disclaimer": "For general wellness and educational purposes only. Custom recommendations are not a diagnosis or treatment plan. Review ingredients for allergies, pregnancy, medication interactions, and individual contraindications, and consult a qualified healthcare professional when appropriate.",
  "related_products": [
    "custom-remedy-consultation",
    "custom-herbal-capsules",
    "alchemy-tea-blend",
    "custom-tea-blends"
  ],
  "frequently_bought_together": [
    "custom-remedy-consultation",
    "custom-herbal-capsules"
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
      "Intake detail, protocol format/length, turnaround, revisions, and delivery method not published in source — flagged, not invented."
    ]
  },
  "field_verification": {
    "price": "VERIFIED — owner price authority 2026-10-04",
    "featured_ingredients": "NOT_APPLICABLE — service; note recorded, no ingredients invented",
    "complete_ingredients": "NOT_APPLICABLE — sourced 'Service only; no ingredients'",
    "traditional_uses": "NOT_APPLICABLE — service",
    "formulation_rationale": "NOT_APPLICABLE — service",
    "process": "PARTIAL — detailed intake + PDF-style protocol sourced; format/turnaround/revisions NEEDS_VERIFICATION",
    "directions": "PARTIAL — intake + protocol creation sourced; turnaround, delivery, revisions NEEDS_VERIFICATION",
    "images": "MISSING_ASSET — no product image mapped in IMAGE_MAP.md or image_manifest.csv; catalog image fields point to /images/products/personalized-herbal-protocols.webp/.png which are catalog-safe generated fallbacks (image_status: placeholder)",
    "inventory_status": "service — no inventory (honest status for a service)",
    "review_summary": "EMPTY — no reviews sourced; not fabricated"
  },
  "last_verified": "2026-10-05"
};
