/**
 * Herbal Encyclopedia — detail-page section view-model (Project 2,
 * Phase 2B wiring, 2026-10-29).
 *
 * Pure helpers that turn a herb's sourced encyclopedia overlay entry
 * (lib/catalog/herb-encyclopedia) plus its catalog record into the
 * structured sections the /herbal-library/[herb] detail page renders.
 * Extracted from the page (a server component) so the section rules can
 * be unit-tested in this repo's no-JSX vitest setup.
 *
 * Honest-empty law, same as every other overlay consumer: a field the
 * sources did not state produces NO section — never a placeholder, a
 * paraphrase, or a value borrowed from another herb. Every section
 * carries the source link(s) of the field(s) it renders, so a reader
 * can trace each statement to Wikidata / Wikipedia.
 *
 * Attribution: the illustration credit comes from the 2026-10-29
 * Commons correction pass (lib/herbs/illustrations ILLUSTRATION_CREDITS,
 * data-driven from the Track B audit). When any encyclopedia section
 * renders, the detail page also credits Wikipedia (CC BY-SA) and
 * Wikidata (CC0) in its Sources & attribution block.
 */
import { HERBS } from '../catalog/herbs';
import type { EncyclopediaEntry } from '../catalog/herb-encyclopedia';
import {
  illustrationCreditFor,
  type IllustrationCredit,
} from '../herbs/illustrations';

/** One rendered encyclopedia section: heading, body, and its sources. */
export interface EncyclopediaSection {
  /** Stable key: 'family' | 'description' | 'distribution' | 'cultivation' | 'constituents'. */
  key: string;
  /** Visible section heading on the detail page. */
  heading: string;
  /** Body paragraphs, verbatim from the sourced overlay fields. */
  paragraphs: readonly string[];
  /** Deduped source links for the field(s) in this section. */
  sources: readonly { name: string; url: string }[];
}

function sourceLink(source: { name: string; url: string }): {
  name: string;
  url: string;
} {
  return { name: source.name, url: source.url };
}

function dedupeSources(
  links: readonly { name: string; url: string }[],
): { name: string; url: string }[] {
  const seen = new Set<string>();
  const out: { name: string; url: string }[] = [];
  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}

/**
 * Build the encyclopedia sections for one entry, in page order:
 * Botanical family (family + traditional names) → Botanical
 * description → Distribution & habitat → Cultivation & harvesting →
 * Constituents. Absent fields produce no section; an absent entry
 * produces no sections at all.
 */
export function encyclopediaSectionsFor(
  entry: EncyclopediaEntry | undefined,
): EncyclopediaSection[] {
  if (!entry) return [];
  const sections: EncyclopediaSection[] = [];

  if (entry.family || entry.traditionalNames) {
    const paragraphs: string[] = [];
    const sources: { name: string; url: string }[] = [];
    if (entry.family) {
      paragraphs.push(entry.family.value);
      sources.push(sourceLink(entry.family.source));
    }
    if (entry.traditionalNames) {
      paragraphs.push(
        `Also known as: ${entry.traditionalNames.value.join(', ')}`,
      );
      sources.push(sourceLink(entry.traditionalNames.source));
    }
    sections.push({
      key: 'family',
      heading: 'Botanical family',
      paragraphs,
      sources: dedupeSources(sources),
    });
  }

  const proseSections = [
    ['description', 'Botanical description', entry.description],
    ['distribution', 'Distribution & habitat', entry.distribution],
    ['cultivation', 'Cultivation & harvesting', entry.cultivation],
    ['constituents', 'Constituents', entry.constituents],
  ] as const;
  for (const [key, heading, field] of proseSections) {
    if (!field) continue;
    sections.push({
      key,
      heading,
      paragraphs: [field.value],
      sources: [sourceLink(field.source)],
    });
  }

  return sections;
}

/** A related-herb link for the detail page's Related herbs section. */
export interface RelatedHerb {
  slug: string;
  name: string;
  latin: string;
  href: string;
}

/**
 * Related herbs, deterministically: other catalog records sharing at
 * least one category with the target record, in catalog order, capped
 * at `limit`. Derived only from existing record data (categories) —
 * nothing is curated or invented. Unknown id → no related herbs.
 */
export function relatedHerbsFor(
  catalogId: string,
  limit = 6,
): RelatedHerb[] {
  const target = HERBS.find((h) => h.id === catalogId);
  if (!target || target.categories.length === 0) return [];
  const wanted = new Set<string>(target.categories);
  const out: RelatedHerb[] = [];
  for (const herb of HERBS) {
    if (herb.id === catalogId) continue;
    if (!herb.categories.some((c) => wanted.has(c))) continue;
    out.push({
      slug: herb.id,
      name: herb.name,
      latin: herb.latin,
      href: `/herbal-library/${herb.id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The Sources & attribution inputs for one detail page: the Commons
 * illustration credit for the record (when its illustration came from
 * the 2026-10-29 correction pass) and whether the Wikipedia/Wikidata
 * credit line applies (true when any encyclopedia section rendered).
 */
export interface DetailAttribution {
  illustrationCredit: IllustrationCredit | null;
  creditWikipediaWikidata: boolean;
}

export function detailAttributionFor(
  catalogId: string,
  sections: readonly EncyclopediaSection[],
): DetailAttribution {
  return {
    illustrationCredit: illustrationCreditFor(catalogId) ?? null,
    creditWikipediaWikidata: sections.length > 0,
  };
}

/**
 * The Wikipedia/Wikidata credit line rendered when encyclopedia
 * sections appear. Wording states the licenses exactly: Wikipedia
 * text is CC BY-SA; Wikidata data is CC0.
 */
export const WIKIPEDIA_WIKIDATA_CREDIT =
  'Encyclopedia fields on this page draw on Wikipedia (text available under CC BY-SA) and Wikidata (data available under CC0), retrieved 2026-10-29; each section links its exact source.';
