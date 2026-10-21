/**
 * Product safety surface helpers (Fix-All Stage 4, audit R-07/R-18/R-19).
 *
 * Pure, data-driven helpers shared by the product page template and the
 * quiz screening engine. Everything here is derived from the catalog
 * record's OWN fields — nothing is invented, and no hand-built drug or
 * allergen lists exist in this module:
 *
 * - `completeIngredients` reads the record's `complete_ingredients`
 *   field verbatim (the FULL ingredient data, not just the featured
 *   subset the page already renders).
 * - `allergenStatement` returns the record's `allergens` text ONLY when
 *   it is a real determination. The provenance states the catalog uses
 *   for "we do not know" — "None listed in source materials",
 *   "NEEDS_VERIFICATION", "NOT_APPLICABLE", and per-selection "Varies
 *   by…" — are NOT allergen determinations: rendering them (or
 *   paraphrasing them) would imply an allergen position the record
 *   does not hold, so they render NO allergen claim at all.
 * - `isIngestibleProduct` derives ingestibility from the record's
 *   existing format fields (category, subcategory, sizes, tags, and
 *   bundle included-items) — never from the product's name.
 * - `productSafetyText` flattens the record's own warnings/safety text
 *   so callers can match against what the record itself says.
 */
import type { Product } from '../../types';

/** The statutory FDA structure/function disclaimer sentence (§403(r)(6)). */
export const FDA_STATEMENT =
  'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';

/** Trimmed string field, or null when absent/empty/non-string. */
function stringField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The record's complete ingredient data, verbatim. Returns null when
 * the record carries none, an empty list, or only a NOT_APPLICABLE
 * service marker (a service has no ingredients to list).
 */
export function completeIngredients(product: Product): string | null {
  const raw = product.complete_ingredients;
  if (Array.isArray(raw)) {
    const items = raw
      .map((item) => stringField(item))
      .filter((item): item is string => item !== null);
    return items.length > 0 ? items.join(', ') : null;
  }
  const text = stringField(raw);
  if (!text) return null;
  if (/^NOT_APPLICABLE\b/i.test(text)) return null;
  return text;
}

/**
 * The record's allergen statement, ONLY when the record's `allergens`
 * data is a real determination (e.g. "Contains fish…", "Contains goat
 * milk (milk) and shea butter…"). Provenance/unknown states render no
 * allergen claim at all — never an implied "allergen-free".
 */
export function allergenStatement(product: Product): string | null {
  const text = stringField(product.allergens);
  if (!text) return null;
  if (/NEEDS_VERIFICATION/i.test(text)) return null;
  if (/^None listed in source materials\b/i.test(text)) return null;
  if (/^NOT_APPLICABLE\b/i.test(text)) return null;
  if (/^Varies by\b/i.test(text)) return null;
  if (/^Not compiled at bundle level\b/i.test(text)) return null;
  return text;
}

/** Format-bearing text from the record's existing type/format fields. */
function formatText(product: Product): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(item);
        else if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if (typeof record.item === 'string') parts.push(record.item);
        }
      }
    }
  };
  push(product.category);
  push(product.subcategory);
  push(product.sizes);
  push(product.tags);
  push(product.included_items);
  return parts.join(' ').toLowerCase();
}

const INGESTIBLE_FORMAT =
  /\bcapsules?\b|\btea bags?\b|\bloose[- ]leaf\b|\btinctures?\b|\bedibles?\b|\bsoftgels?\b/;

/**
 * True when the record's own format fields describe something taken
 * internally: a capsule/tea/tincture/edible product, or a bundle whose
 * listed components include one. Topicals (balms, soaps, serums),
 * services, and digital products are not ingestible.
 */
export function isIngestibleProduct(product: Product): boolean {
  if (product.category === 'Capsules' || product.category === 'Teas') {
    return true;
  }
  return INGESTIBLE_FORMAT.test(formatText(product));
}

/**
 * The record's own safety/warning text (the `warnings` field, string
 * or list), flattened for matching. Empty string when the record
 * carries none.
 */
export function productSafetyText(product: Product): string {
  const warnings = product.warnings;
  if (typeof warnings === 'string') return warnings;
  if (Array.isArray(warnings)) {
    return warnings
      .map((w) => (typeof w === 'string' ? w : ''))
      .filter((w) => w !== '')
      .join(' ');
  }
  return '';
}

/**
 * True when the record's OWN safety text mentions medication
 * interactions — the words "medication(s)" or "interact…" in the
 * record's warnings. No external drug list is consulted.
 */
export function safetyTextMentionsMedication(product: Product): boolean {
  return /medication|interact/i.test(productSafetyText(product));
}
