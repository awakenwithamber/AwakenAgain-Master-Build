/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Hypnotherapy & Guided Relaxation",
  "handle": "hypnotherapy-guided-relaxation",
  "sku": "AAA-SVC-HYPNOTHERAPY",
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
  "short_description": "Personalized guided sessions centered on relaxation, imagery, reflection, and intentional self-exploration.",
  "extended_description": "Personalized guided sessions centered on relaxation, imagery, reflection, and intentional self-exploration. Offered as a reflective, relaxation-oriented guided experience. Individual experiences vary; no medical or psychological treatment outcomes are claimed or implied.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "traditional_uses": "Guided imagery and relaxation practices are used across many modern wellness and reflective traditions; this service is offered as contemporary guided practice, not as a clinical or historical modality.",
  "properties": {
    "service_scope": [
      "Personalized guided relaxation sessions",
      "Imagery, reflection, and intentional self-exploration",
      "Educational and wellness framing — not medical or psychiatric care"
    ]
  },
  "formulation_rationale": "NOT_APPLICABLE — service offering. Complements the apothecary's reflective and ritual dimension; no product formulation involved.",
  "process": "Session format, length, delivery method (in-person/virtual), and included deliverables are not established in the source catalog — NEEDS_VERIFICATION.",
  "directions": "To book, contact the apothecary. The booking flow (scheduling, confirmation, payment, cancellation policy) is not established in the source catalog — NEEDS_VERIFICATION.",
  "warnings": "Wellness and educational service; not represented as diagnosis or treatment of a medical or psychiatric condition. Not a substitute for professional mental-health care. If you are experiencing psychological distress, seek qualified professional support.",
  "allergens": "NOT_APPLICABLE — service offering.",
  "storage": "NOT_APPLICABLE — service offering.",
  "disclaimer": "Wellness and educational service; not represented as diagnosis or treatment of a medical or psychiatric condition. Offered for spiritual, reflective, educational, and/or entertainment purposes only; not medical, legal, or financial advice and not intended to diagnose, treat, cure, or prevent any disease. Individual experiences vary.",
  "related_products": [
    "energy-work",
    "past-life-inspired-guided-exploration",
    "grimoire-subscription",
    "personalized-botanical-consultation"
  ],
  "frequently_bought_together": [],
  "inventory_status": "SERVICE — availability/scheduling not established; NEEDS_VERIFICATION",
  "review_summary": {},
  "provenance": {
    "sources": [
      "services.csv (merged catalog 2026-09-27 triage extraction)"
    ],
    "notes": "Handle 'hypnotherapy-guided-relaxation' newly coined by slugifying the service title from services.csv (source handle was 'hypnotherapy'). SKU 'AAA-SVC-HYPNOTHERAPY' newly coined; both require owner verification. Price and booking URL were marked VERIFY in services.csv — price recorded as null; no price copied from any older file. Legal/scope language quoted from the source 'legal' column."
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
