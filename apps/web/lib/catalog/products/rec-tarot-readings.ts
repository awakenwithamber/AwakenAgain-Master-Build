/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Tarot Readings",
  "handle": "tarot-readings",
  "sku": "AAA-TAROT-READINGS",
  "category": "Grimoire & Digital",
  "subcategory": "Digital Products",
  "price": 11.11,
  "compare_at_price": null,
  "subscriber_price": 10,
  "sizes": "",
  "variants": [
    {
      "name": "Mini Reading",
      "sku": "AAA- TAROTREADINGS-MINI",
      "price": 11.11,
      "unit": "digital reading",
      "requires_shipping": false,
      "fulfillment": "digital"
    },
    {
      "name": "Full Reading",
      "sku": "AAA- TAROTREADINGS-FULL",
      "price": 33.33,
      "unit": "digital reading",
      "requires_shipping": false,
      "fulfillment": "digital"
    }
  ],
  "tags": [],
  "images": [],
  "short_description": "Mystical tarot readings for insight, reflection, and intuitive guidance through the Awaken Again experience.",
  "extended_description": "Reflective tarot sessions using symbolism and archetypes for personal insight and intention-setting. (Sourced from services.csv.) Readings are framed as a reflective, spiritual practice — for personal insight and intention-setting, not as predictions with guaranteed outcomes. Card count, spread type, session length, and delivery format are not published in the source and are flagged NEEDS_VERIFICATION.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — digital service; no ingredients. (Sourced.)",
  "traditional_uses": [],
  "properties": [
    {
      "property": "Digital/intuitive service",
      "evidence_context": "not_applicable",
      "note": "Service feature from source, not an efficacy claim."
    },
    {
      "property": "Supports reflection",
      "evidence_context": "not_applicable",
      "note": "Service feature from source; reflective framing, no predictive claims."
    },
    {
      "property": "Pairs with ritual products",
      "evidence_context": "not_applicable",
      "note": "Service feature from source."
    },
    {
      "property": "Great recurring content offer",
      "evidence_context": "not_applicable",
      "note": "Business attribute from source, not a customer-facing claim."
    }
  ],
  "formulation_rationale": "NOT_APPLICABLE — reflective digital service; no formulation.",
  "process": "Sourced workflow: customer selects a reading type (Mini or Full) and submits a question or topic. Spread type, card count, session length, delivery format (written/video), and turnaround time are not published in the source and are flagged NEEDS_VERIFICATION. No predictive powers are claimed.",
  "directions": "How it works: select your reading type and submit your question or topic. (Sourced.) How the question is submitted (form/checkout note), how the reading is delivered, and turnaround time are not published in the source — NEEDS_VERIFICATION. No booking URL is invented.",
  "warnings": [
    "For spiritual, reflective, and entertainment purposes; not professional medical, legal, or financial advice. (Sourced from services.csv.)",
    "Spiritual/reflective service; outcomes are not guaranteed. (Sourced from services.csv.)",
    "Not medical advice and not intended to diagnose, treat, cure, or prevent any disease. Seek qualified professional care for medical concerns. (Sourced.)",
    "No predictive powers are claimed; readings are framed as reflective and symbolic.",
    "Individual experiences vary."
  ],
  "allergens": "NOT_APPLICABLE — digital service; no ingredients.",
  "storage": "NOT_APPLICABLE — digital service; no physical product to store.",
  "disclaimer": "For educational, spiritual, or informational purposes only. Not medical advice and not intended to diagnose, treat, cure, or prevent any disease. Seek qualified professional care for medical concerns. For spiritual, reflective, and entertainment purposes; not professional medical, legal, or financial advice. (Combined sourced disclaimers.)",
  "related_products": [
    "custom-remedy-consultation",
    "personalized-herbal-protocols",
    "alchemy-tea-blend"
  ],
  "frequently_bought_together": [
    "alchemy-tea-blend",
    "custom-remedy-consultation"
  ],
  "inventory_status": "service — no inventory",
  "review_summary": "",
  "provenance": {
    "sources": [
      "catalog.master.json (AwakenAgain_Merged_Master_Catalog, merged master catalog)",
      "services.csv (merged master catalog) — tariff/legal framing for tarot service"
    ],
    "price_authority": "Owner-approved price list 2026-10-04 (parent task)",
    "image_source": "IMAGE_MAP.md + image_manifest.csv (no product image mapped for these 6 handles)",
    "last_verified": "2026-10-04",
    "notes": [
      "Handle preserved as canonical ID.",
      "Sourced category is 'Grimoire & Digital' / 'Digital Products'; included in the TEAS, CUSTOMS & CONSULTATIONS enrichment batch per task assignment.",
      "Non-botanical service — featured_ingredients intentionally empty per binding rules.",
      "Reading mechanics (spread, card count, session length, delivery format, turnaround) not published in source — flagged, not invented.",
      "Legacy variant prices (Mini $11.11; Full $33.33) are legacy-sourced; base price $11.11 per owner price authority."
    ],
    "service_listing_note": "services.csv also lists 'Tarot Readings' as a service with no price; treated as the same offering as this $11.11 product per newest-catalog-wins. Owner to confirm whether the service and product are one offering or two. Duplicate service record merged away 2026-10-04."
  },
  "field_verification": {
    "price": "VERIFIED — owner price authority 2026-10-04",
    "featured_ingredients": "NOT_APPLICABLE — service; note recorded, no ingredients invented",
    "complete_ingredients": "NOT_APPLICABLE — sourced 'Digital service; no ingredients'",
    "traditional_uses": "NOT_APPLICABLE — service",
    "formulation_rationale": "NOT_APPLICABLE — service",
    "process": "PARTIAL — reading-type selection + question submission sourced; mechanics and delivery NEEDS_VERIFICATION",
    "directions": "PARTIAL — selection + question submission sourced; submission/delivery/turnaround NEEDS_VERIFICATION",
    "images": "MISSING_ASSET — no product image mapped in IMAGE_MAP.md or image_manifest.csv; catalog image fields point to /images/products/tarot-readings.webp/.png which are catalog-safe generated fallbacks (image_status: placeholder)",
    "inventory_status": "service — no inventory (honest status for a service)",
    "review_summary": "EMPTY — no reviews sourced; not fabricated",
    "service_identity": "NEEDS_VERIFICATION — confirm product/service are one offering"
  },
  "last_verified": "2026-10-05"
};
