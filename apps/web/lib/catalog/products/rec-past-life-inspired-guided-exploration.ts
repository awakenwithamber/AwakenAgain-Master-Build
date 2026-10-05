/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Past-Life-Inspired Guided Exploration",
  "handle": "past-life-inspired-guided-exploration",
  "sku": "AAA-SVC-PAST-LIFE",
  "category": "Services",
  "subcategory": "Wellness & Spiritual Services",
  "price": null,
  "compare_at_price": null,
  "subscriber_price": null,
  "sizes": [],
  "variants": [],
  "images": [
    {
      "path": "images/guided-meditation.webp",
      "status": "mapped from merged-catalog services.csv; association unverified — not confirmed as representative service photography"
    }
  ],
  "short_description": "Guided imaginative exploration using visualization, symbolism, and reflection.",
  "extended_description": "Guided imaginative exploration using visualization, symbolism, and reflection. Offered as guided imaginative exploration for reflection and self-inquiry; framed as entertainment and reflective practice. Any imagery or impressions that arise are not presented as verified historical memories. Individual experiences vary.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "traditional_uses": "Visualization-based guided explorations are a modern reflective practice; this offering is imaginative and reflective by design, not a historical or therapeutic modality.",
  "properties": {
    "service_scope": [
      "Guided visualization and symbolism-based exploration",
      "Reflection and imaginative self-inquiry",
      "Imagery not presented as verified historical memory"
    ]
  },
  "formulation_rationale": "NOT_APPLICABLE — service offering. Complements the apothecary's reflective and ritual dimension; no product formulation involved.",
  "process": "Session format, length, delivery method (in-person/virtual), and included deliverables are not established in the source catalog — NEEDS_VERIFICATION.",
  "directions": "To book, contact the apothecary. The booking flow (scheduling, confirmation, payment, cancellation policy) is not established in the source catalog — NEEDS_VERIFICATION.",
  "warnings": "Imagery or impressions arising in a session are not presented as verified historical memories. Reflective and entertainment-oriented; not a therapeutic or historical-verification service.",
  "allergens": "NOT_APPLICABLE — service offering.",
  "storage": "NOT_APPLICABLE — service offering.",
  "disclaimer": "Imagery or impressions arising in a session are not presented as verified historical memories. Offered for spiritual, reflective, educational, and/or entertainment purposes only; not medical, legal, or financial advice and not intended to diagnose, treat, cure, or prevent any disease. Individual experiences vary.",
  "related_products": [
    "hypnotherapy-guided-relaxation",
    "tarot-readings",
    "grimoire-subscription"
  ],
  "frequently_bought_together": [],
  "inventory_status": "SERVICE — availability/scheduling not established; NEEDS_VERIFICATION",
  "review_summary": {},
  "provenance": {
    "sources": [
      "services.csv (merged catalog 2026-09-27 triage extraction)"
    ],
    "notes": "Handle 'past-life-inspired-guided-exploration' newly coined by slugifying the service title from services.csv (source handle was 'past-life'). SKU 'AAA-SVC-PAST-LIFE' newly coined; both require owner verification. Price and booking URL were marked VERIFY in services.csv — price recorded as null; no price copied from any older file. Legal/scope language quoted from the source 'legal' column."
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
