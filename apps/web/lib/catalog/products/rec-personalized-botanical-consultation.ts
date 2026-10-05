/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Personalized Botanical Consultation",
  "handle": "personalized-botanical-consultation",
  "sku": "AAA-SVC-BOTANICAL-CONSULT",
  "category": "Services",
  "subcategory": "Wellness & Spiritual Services",
  "price": null,
  "compare_at_price": null,
  "subscriber_price": null,
  "sizes": [],
  "variants": [],
  "images": [
    {
      "path": "images/apothecary-shop.webp",
      "status": "mapped from merged-catalog services.csv; association unverified — not confirmed as representative service photography"
    }
  ],
  "short_description": "Educational discussion of botanical traditions, sensory preferences, and custom apothecary options.",
  "extended_description": "Educational discussion of botanical traditions, sensory preferences, and custom apothecary options. An educational one-on-one discussion of botanical traditions, personal sensory preferences, and custom apothecary options. Educational wellness service — not medical diagnosis or prescribing; individual needs vary.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "traditional_uses": "Educational discussion of botanical traditions, offered as modern educational practice with honest evidence-context distinctions (traditional use vs. laboratory vs. human evidence).",
  "properties": {
    "service_scope": [
      "Educational discussion of botanical traditions",
      "Sensory preferences and custom apothecary options",
      "Educational wellness framing — not diagnosis or prescribing"
    ]
  },
  "formulation_rationale": "NOT_APPLICABLE — service offering. Directly connects the apothecary's product line to individual needs through education; no product formulation involved.",
  "process": "Session format, length, delivery method (in-person/virtual), and included deliverables are not established in the source catalog — NEEDS_VERIFICATION.",
  "directions": "To book, contact the apothecary. The booking flow (scheduling, confirmation, payment, cancellation policy) is not established in the source catalog — NEEDS_VERIFICATION.",
  "warnings": "Educational wellness service; not medical diagnosis or prescribing. Educational only; not medical advice. Seek qualified professional care for medical concerns.",
  "allergens": "NOT_APPLICABLE — service offering.",
  "storage": "NOT_APPLICABLE — service offering.",
  "disclaimer": "Educational wellness service; not medical diagnosis or prescribing. Offered for spiritual, reflective, educational, and/or entertainment purposes only; not medical, legal, or financial advice and not intended to diagnose, treat, cure, or prevent any disease. Individual experiences vary.",
  "related_products": [
    "grimoire-subscription",
    "tarot-readings",
    "stress-relief-ritual"
  ],
  "frequently_bought_together": [],
  "inventory_status": "SERVICE — availability/scheduling not established; NEEDS_VERIFICATION",
  "review_summary": {},
  "provenance": {
    "sources": [
      "services.csv (merged catalog 2026-09-27 triage extraction)"
    ],
    "notes": "Handle 'personalized-botanical-consultation' newly coined by slugifying the service title from services.csv (source handle was 'botanical-consultation'). SKU 'AAA-SVC-BOTANICAL-CONSULT' newly coined; both require owner verification. Price and booking URL were marked VERIFY in services.csv — price recorded as null; no price copied from any older file. Legal/scope language quoted from the source 'legal' column."
  },
  "field_verification": {
    "price": "NEEDS_VERIFICATION",
    "compare_at_price": "NOT_APPLICABLE",
    "subscriber_price": "NEEDS_VERIFICATION",
    "title": "SOURCED_FROM_CATALOG",
    "handle": "NEWLY_COINED_NEEDS_VERIFICATION",
    "sku": "NEWLY_COINED_NEEDS_VERIFICATION",
    "images": "MAPPED_FROM_CATALOG_UNVERIFIED",
    "short_description": "SOURCED_FROM_CATALOG",
    "extended_description": "DRAFTED_FROM_CATALOG_DESCRIPTION",
    "featured_ingredients": "NOT_APPLICABLE",
    "complete_ingredients": "NOT_APPLICABLE",
    "variants": "NEEDS_VERIFICATION",
    "process": "NEEDS_VERIFICATION",
    "directions": "NEEDS_VERIFICATION",
    "related_products": "DETERMINISTIC",
    "frequently_bought_together": "NOT_ESTABLISHED",
    "review_summary": "NOT_APPLICABLE"
  },
  "last_verified": "2026-10-05",
  "tags": []
};
