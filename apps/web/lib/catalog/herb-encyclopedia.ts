/**
 * Per-herb encyclopedia overlay (Herbal Encyclopedia, Project 2 —
 * Phase 2A pilot approved by the owner 2026-10-29).
 *
 * Where herb-cautions.ts and herb-references.ts carry safety and
 * citation data, this overlay carries the encyclopedia fields the
 * Herbal Encyclopedia entries need: botanical family, traditional /
 * historical names, botanical description, distribution & habitat,
 * cultivation & harvesting, and phytochemical constituents.
 *
 * Every field is a SOURCED field: a value fetched from the named
 * source, carried with the source's name, URL, and retrieval date.
 *
 * - `family` comes from Wikidata taxonomy ONLY — the matched taxon's
 *   P171 parent-taxon chain walked to the family-rank taxon. Never
 *   from article prose.
 * - `traditionalNames` are the matched taxon's Wikidata English
 *   aliases.
 * - `description`, `distribution`, `cultivation`, and `constituents`
 *   are short extracts (≤ ~600 chars, truncated at a sentence
 *   boundary) from the corresponding sections of the taxon's English
 *   Wikipedia article; `description` falls back to the article intro,
 *   the source's own summary. Wikipedia is a starting reference, not
 *   the sole authority — taxonomy never comes from it.
 *
 * Data lives in the GENERATED herb-encyclopedia-data.ts (produced by
 * scripts/build-encyclopedia-overlay.mjs from cached Wikidata /
 * Wikipedia responses). A herb ABSENT from that data — or a field
 * absent from its entry — means the sources did not state it. Absence
 * is honest and renders nothing; no value in this overlay is written
 * by hand or inferred.
 *
 * NOT yet wired into the herb records or pages: the barrel
 * (lib/catalog/herbs.ts) deliberately does not apply this overlay.
 * That integration is a later, separately approved tranche. Callers
 * resolve HERB_INDEX slugs to catalog ids first (via
 * HERB_INDEX_SLUG_ALIASES in lib/herbal-index/cards.ts), exactly as
 * the other overlays' consumers do.
 */
import { HERB_ENCYCLOPEDIA_DATA } from './herb-encyclopedia-data';

/** Provenance carried by every sourced field in this overlay. */
export interface EncyclopediaSource {
  /** Source name, e.g. 'Wikidata' or 'Wikipedia'. */
  name: string;
  /** Canonical URL of the exact entity / article the value came from. */
  url: string;
  /** Retrieval date (ISO yyyy-mm-dd) the value was fetched. */
  retrieved: string;
}

/** A single encyclopedia field value with its provenance. */
export interface SourcedField<T> {
  value: T;
  source: EncyclopediaSource;
}

/**
 * The sourced encyclopedia fields for one herb. Every property is
 * OPTIONAL: a missing property means the sources did not state it —
 * never fill one in by inference.
 */
export interface EncyclopediaEntry {
  /** Botanical family (Wikidata taxonomy only). */
  family?: SourcedField<string>;
  /** Traditional / historical names (Wikidata English aliases). */
  traditionalNames?: SourcedField<readonly string[]>;
  /** Botanical description (Wikipedia Description section or intro). */
  description?: SourcedField<string>;
  /** Geographic distribution & habitat (Wikipedia). */
  distribution?: SourcedField<string>;
  /** Cultivation & harvesting (Wikipedia). */
  cultivation?: SourcedField<string>;
  /** Phytochemical / constituent information (Wikipedia). */
  constituents?: SourcedField<string>;
}

/** Field names of EncyclopediaEntry, for coverage checks and tests. */
export const ENCYCLOPEDIA_FIELDS = [
  'family',
  'traditionalNames',
  'description',
  'distribution',
  'cultivation',
  'constituents',
] as const satisfies readonly (keyof EncyclopediaEntry)[];

/**
 * The sourced encyclopedia entry for a catalog herb id, or undefined
 * when the sources stated nothing for it. `slug` is a CATALOG record
 * id (e.g. 'valerian'); HERB_INDEX slugs that differ from their record
 * id ('valerian-root') must be alias-resolved by the caller first.
 */
export function getEncyclopediaEntry(
  slug: string,
): EncyclopediaEntry | undefined {
  return HERB_ENCYCLOPEDIA_DATA[slug];
}

/** The full generated overlay data, keyed by catalog herb id. */
export { HERB_ENCYCLOPEDIA_DATA };
