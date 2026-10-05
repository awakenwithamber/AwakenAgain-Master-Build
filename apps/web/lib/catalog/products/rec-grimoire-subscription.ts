/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';

export const RECORD: Product = {
  "title": "Grimoire Subscription",
  "handle": "grimoire-subscription",
  "sku": "AAA-GRIMOIRE-SUBSCRIPTION",
  "category": "Grimoire & Digital",
  "subcategory": "Subscriptions",
  "price": 7.77,
  "compare_at_price": null,
  "subscriber_price": null,
  "sizes": [],
  "variants": [
    {
      "name": "Monthly membership",
      "price": 7.77,
      "billing": "monthly",
      "cancel_anytime": true,
      "source": "catalog.master.json (merged catalog 2026-09-27)"
    }
  ],
  "images": [
    {
      "path": "/images/products/grimoire-subscription.webp",
      "fallback": "/images/products/grimoire-subscription.png",
      "alt_text": "Grimoire Subscription by Amber's Alchemy Apothecary",
      "status": "catalog-safe generated fallback; original product photography missing"
    }
  ],
  "short_description": "Monthly access to the Living Grimoire subscriber library and member benefits.",
  "extended_description": "The Living Grimoire is Amber's Alchemy Apothecary's membership offering. Members receive subscriber-only Living Grimoire content and ongoing educational and spiritual releases. Per the current membership plan, benefits include monthly articles and rituals, exclusive recipes, early access to new releases, personalized recommendations, subscriber gifts, and a 10% storewide subscriber discount (subscribers also unlock $75 free-shipping threshold). Safety information is never paywalled: all safety-critical content appears in public entries. Content provenance is labeled per entry: historical sources, folklore, traditional use, modern practice, and AWAKEN-original work are distinguished, never blended. Honest status note: the reviewed content package (2026-10-04 intake review) currently contains 7 public preview entries plus 1 member sample entry; the member library is a draft in progress, not a finished collection. The 12 'Member Books' listed in the package table of contents are planned paths, not 12 existing member entries.",
  "featured_ingredients": [],
  "complete_ingredients": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "traditional_uses": "NOT_APPLICABLE — membership/service offering; no botanical ingredients involved.",
  "properties": {
    "membership_benefits": [
      "Subscriber-only Living Grimoire content and ongoing educational/spiritual releases",
      "Monthly articles and rituals",
      "Exclusive recipes",
      "Early access to new releases",
      "Personalized recommendations",
      "Subscriber gifts",
      "10% storewide subscriber discount",
      "Safety information never paywalled",
      "Content provenance labeled per entry (historical / folklore / traditional use / modern practice / AWAKEN-original distinguished, never blended)"
    ],
    "content_status_note": "Reviewed package (2026-10-04) contains 7 public preview entries + 1 member sample; full member library not yet established. Nothing in the package is approved for publication."
  },
  "formulation_rationale": "NOT_APPLICABLE — membership offering. Rationale: the Living Grimoire is the apothecary's flagship educational/spiritual membership, intended as the ongoing home for botanical education, ritual writing, and community content under one provenance-honest framework.",
  "process": "Subscribe monthly. Access is unlocked by email. Active subscribers receive ongoing content and discounts. Premium/member content is served only after server-side membership entitlement checks (build-time requirement; the reviewing package itself is a source-of-truth draft, not a working entitlement system).",
  "directions": "Subscribe on the site to activate monthly membership; membership content is delivered via email. Checkout/booking flow details NEEDS_VERIFICATION.",
  "warnings": "For educational, spiritual, or informational purposes only. Not medical advice and not intended to diagnose, treat, cure, or prevent any disease. Seek qualified professional care for medical concerns.",
  "allergens": "NOT_APPLICABLE — digital membership.",
  "storage": "NOT_APPLICABLE — digital membership.",
  "disclaimer": "For educational, spiritual, or informational purposes only. Not medical advice and not intended to diagnose, treat, cure, or prevent any disease. Seek qualified professional care for medical concerns.",
  "related_products": [
    "tarot-readings",
    "rune-readings",
    "stress-relief-ritual",
    "personalized-botanical-consultation"
  ],
  "frequently_bought_together": [
    "tarot-readings",
    "stress-relief-ritual"
  ],
  "inventory_status": "DIGITAL — always available",
  "review_summary": {},
  "provenance": {
    "sources": [
      "catalog.master.json (merged catalog 2026-09-27, 'Owner-confirmed current membership price')",
      "grimoire/REVIEW.md (intake review 2026-10-04: 7 public previews + 1 member sample; provenance honored; safety never paywalled)",
      "AWAKEN platform constitution (2026-10-04): Living Grimoire $7.77/month membership terms"
    ],
    "notes": "Handle preserved from baseline catalog. Title preserved from baseline. Price $7.77/month is owner-approved and CURRENT. Content-status honesty per REVIEW.md: do not claim 12 member books exist; member library is a draft.",
    "subscriber_price_note": "No subscriber discount on the membership fee; the Grimoire 10% benefit applies to storewide product purchases.",
    "price": {
      "source_file": "Owner directive 2026-10-05 (newest source of truth; supersedes Sept 27 catalog prices)",
      "date": "2026-10-05",
      "note": "Owner directive 2026-10-05: Living Grimoire stays $7.77/month. Payments Cash App $AmberPatten347 + Venmo @AwakenwithAmber only."
    }
  },
  "field_verification": {
    "price": "OWNER_CONFIRMED",
    "title": "SOURCED_FROM_CATALOG",
    "handle": "PRESERVED_FROM_BASELINE",
    "sku": "SOURCED_FROM_CATALOG",
    "subscriber_price": "NOT_APPLICABLE — the 10% subscriber benefit applies to store products, not to the membership fee itself",
    "compare_at_price": "NOT_APPLICABLE",
    "images": "PLACEHOLDER",
    "extended_description": "DRAFTED_FROM_SOURCES",
    "featured_ingredients": "NOT_APPLICABLE",
    "variants": "SOURCED_FROM_CATALOG",
    "process": "SOURCED_FROM_CATALOG",
    "directions": "NEEDS_VERIFICATION",
    "related_products": "DETERMINISTIC",
    "frequently_bought_together": "DETERMINISTIC",
    "review_summary": "NOT_APPLICABLE"
  },
  "last_verified": "2026-10-05",
  "tags": []
};
