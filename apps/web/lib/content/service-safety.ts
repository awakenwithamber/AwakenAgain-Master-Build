/**
 * Service-page safety copy — render-layer cleanup (2026-10-14).
 *
 * Catalog records carry their safety text as a `warnings` list PLUS a
 * separate `disclaimer` string that was assembled by concatenating the
 * same source disclaimers (its own tail tag: "(Combined sourced
 * disclaimers.)"). Rendered naively — a warnings paragraph followed by
 * the disclaimer block — a /services/<slug> page repeated the same
 * sentences up to three times, and several strings still carried their
 * internal provenance tags ("(Sourced from services.csv.)",
 * "(Sourced.)") into customer-facing copy.
 *
 * The catalog records are generated files and are NOT edited. This
 * helper cleans the text at render time, for the service landing
 * pages only (product pages render their warnings elsewhere and are
 * untouched):
 *
 *   1. Trailing source-attribution parentheticals are stripped.
 *   2. Exact duplicates (compared after whitespace/case
 *      normalization) are dropped.
 *   3. A string fully contained in a longer one is dropped — the
 *      combined disclaimer therefore absorbs the individual warnings
 *      it repeats verbatim, while genuinely distinct warnings are
 *      preserved.
 *
 * Order is stable: surviving strings keep their source order
 * (warnings first, then the disclaimer), except that a warning
 * absorbed by the later combined disclaimer yields its place to it.
 */

/**
 * A trailing parenthetical attribution, e.g. "(Sourced from
 * services.csv.)", "(Sourced.)", "(Combined sourced disclaimers.)".
 * Anchored to the END of the string only — parentheticals that are
 * part of the sentence itself are never touched.
 */
const ATTRIBUTION_TAIL =
  /\s*\((?:sourced\b[^)]*|combined sourced disclaimers\.?)\)\s*$/i;

/** Remove trailing source-attribution parentheticals from one string. */
export function stripSourceAttribution(text: string): string {
  let out = text.trim();
  // A string can carry more than one trailing tag; strip repeatedly.
  while (ATTRIBUTION_TAIL.test(out)) {
    out = out.replace(ATTRIBUTION_TAIL, '').trim();
  }
  return out;
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Clean and dedupe a list of safety strings (see the module header for
 * the rules). Non-string and empty-after-cleaning entries are skipped.
 */
export function dedupeSafetyCopy(
  items: readonly (string | null | undefined)[],
): string[] {
  const kept: string[] = [];
  const keptNormalized: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const text = stripSourceAttribution(item);
    if (text.length === 0) continue;
    const normalized = normalizeForComparison(text);
    // Already kept verbatim, or fully contained in a longer kept string.
    if (keptNormalized.some((k) => k.includes(normalized))) continue;
    // This string fully contains an earlier one — keep the longer.
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      if (normalized.includes(keptNormalized[i])) {
        kept.splice(i, 1);
        keptNormalized.splice(i, 1);
      }
    }
    kept.push(text);
    keptNormalized.push(normalized);
  }
  return kept;
}

/**
 * The display-ready safety copy for one catalog record: its `warnings`
 * (an array in most records, a bare string in some) followed by its
 * `disclaimer`, cleaned and deduped as one list so the disclaimer can
 * never repeat a warning.
 */
export function serviceSafetyCopy(
  record: { readonly [key: string]: unknown } | null | undefined,
): string[] {
  if (!record) return [];
  const items: (string | null)[] = [];
  if (Array.isArray(record.warnings)) {
    for (const w of record.warnings) items.push(String(w));
  } else if (typeof record.warnings === 'string') {
    items.push(record.warnings);
  }
  items.push(
    typeof record.disclaimer === 'string' ? record.disclaimer : null,
  );
  return dedupeSafetyCopy(items);
}
