/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Home, Aura & Space Cleansing",
  "handle": "home-aura-space-cleansing",
  "sku": "AAA-SVC-SPACE-CLEANSING",
  "category": "Services",
  "subcategory": "Wellness & Spiritual Services",
  "price": null,
  "compare_at_price": null,
  "subscriber_price": null,
  "sizes": [],
  "variants": [],
  "images": [
    {
      "path": "images/elements-metaphysics.webp",
      "status": "mapped from merged-catalog services.csv; association unverified — not confirmed as representative service photography"
    }
  ],
  "short_description": "A personalized spiritual cleansing ritual using intention, symbolism, and selected aromatic or botanical elements.",
  "extended_description": "A personalized spiritual cleansing ritual using intention, symbolism, and selected aromatic or botanical elements. A personalized spiritual ritual offered for reflective and symbolic purposes. No claim is made that it removes disease, toxins, or objectively measurable entities. Individual experiences vary.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "traditional_uses": "Space-clearing rituals using intention, aroma, and botanical elements appear in many folk and spiritual traditions; this offering is framed as modern spiritual practice, with no measurable physical claims.",
  "properties": {
    "service_scope": [
      "Personalized spiritual cleansing ritual",
      "Intention, symbolism, and selected aromatic or botanical elements",
      "Reflective and symbolic purposes only"
    ]
  },
  "formulation_rationale": "NOT_APPLICABLE — service offering. Complements the apothecary's botanical and ritual dimension; no product formulation involved.",
  "process": "Session format, length, delivery method (in-person/virtual), and included deliverables are not established in the source catalog — NEEDS_VERIFICATION.",
  "directions": "To book, contact the apothecary. The booking flow (scheduling, confirmation, payment, cancellation policy) is not established in the source catalog — NEEDS_VERIFICATION.",
  "warnings": "Spiritual service; no claim is made that it removes disease, toxins, or objectively measurable entities. Spiritual service only — not a cleaning, medical, or remediation service.",
  "allergens": "NOT_APPLICABLE — service offering.",
  "storage": "NOT_APPLICABLE — service offering.",
  "disclaimer": "Spiritual service; no claim is made that it removes disease, toxins, or objectively measurable entities. Offered for spiritual, reflective, educational, and/or entertainment purposes only; not medical, legal, or financial advice and not intended to diagnose, treat, cure, or prevent any disease. Individual experiences vary.",
  "related_products": [
    "energy-work",
    "grimoire-subscription",
    "stress-relief-ritual"
  ],
  "frequently_bought_together": [],
  "inventory_status": "SERVICE — availability/scheduling not established; NEEDS_VERIFICATION",
  "review_summary": {},
  "provenance": {
    "sources": [
      "services.csv (merged catalog 2026-09-27 triage extraction)"
    ],
    "notes": "Handle 'home-aura-space-cleansing' newly coined by slugifying the service title from services.csv (source handle was 'space-cleansing'). SKU 'AAA-SVC-SPACE-CLEANSING' newly coined; both require owner verification. Price and booking URL were marked VERIFY in services.csv — price recorded as null; no price copied from any older file. Legal/scope language quoted from the source 'legal' column."
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
