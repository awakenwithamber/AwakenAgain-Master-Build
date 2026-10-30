/**
 * Herbal Encyclopedia detail-page wiring tests (Project 2, Phase 2B,
 * 2026-10-29).
 *
 * Laws under test:
 * - The section builder renders a section ONLY for fields the sourced
 *   overlay actually states (honest-empty: no entry → no sections;
 *   partial entry → only its fields' sections), and every rendered
 *   section carries at least one https source link.
 * - Corrected illustration slugs (Track B audit) resolve through the
 *   card view-model to their verified Wikimedia Commons URLs and are
 *   renderable; the deliberately removed slugs (19 compound/blend
 *   records + coptis) resolve to NO illustration (monogram slot).
 * - Every corrected entry carries an illustration credit; every
 *   CC BY / CC BY-SA entry's credit line names its license.
 * - Related herbs are deterministic (catalog order), capped at 6,
 *   exclude the herb itself, and share a category with it.
 */
import { describe, expect, it } from 'vitest';
import { getEncyclopediaEntry } from '../catalog/herb-encyclopedia';
import { getHerb } from '../catalog/herbs';
import {
  BOTANICAL_ILLUSTRATIONS,
  ILLUSTRATION_CREDITS,
  illustrationCreditFor,
} from '../herbs/illustrations';
import correctedIllustrations from './corrected-illustrations.audit.json';
import { getHerbalCard } from './cards';
import {
  detailAttributionFor,
  encyclopediaSectionsFor,
  relatedHerbsFor,
} from './encyclopedia-sections';

const CORRECTED = correctedIllustrations as Record<
  string,
  { url: string; license: string; attribution: string }
>;
const CORRECTED_SLUGS = Object.keys(CORRECTED);

const NO_ILLUSTRATION_SLUGS = [
  'apigenin',
  'luteolin',
  'astaxanthin',
  'menthol',
  'trikatu',
  'alpha-lipoic',
  'berberine',
  'coq10',
  'n-acetyl-cysteine',
  'vitamin-d3',
  'vitamin-k2',
  'b12-methylcobalamin',
  'folate',
  'zinc-bisglycinate',
  'probiotics',
  'triphala',
  'propolis',
  'pearl-powder',
  'deer-antler',
  'coptis',
];

describe('encyclopedia section builder', () => {
  it('renders the family section for a known herb: arnica is Asteraceae', () => {
    const sections = encyclopediaSectionsFor(getEncyclopediaEntry('arnica'));
    const family = sections.find((s) => s.key === 'family');
    expect(family).toBeDefined();
    expect(family!.heading).toBe('Botanical family');
    expect(family!.paragraphs[0]).toBe('Asteraceae');
  });

  it('every rendered section carries at least one https source link', () => {
    for (const id of ['arnica', 'lavender', 'chamomile', 'valerian']) {
      const sections = encyclopediaSectionsFor(getEncyclopediaEntry(id));
      expect(sections.length, id).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.sources.length, `${id}.${section.key}`).toBeGreaterThan(
          0,
        );
        for (const source of section.sources) {
          expect(source.url.startsWith('https://')).toBe(true);
        }
        for (const paragraph of section.paragraphs) {
          expect(paragraph.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('absent fields produce no section (honest-empty)', () => {
    // No overlay entry at all → no sections. ('probiotics' is one of
    // the records the Track A overlay verifiably carries nothing for.)
    expect(encyclopediaSectionsFor(undefined)).toEqual([]);
    expect(encyclopediaSectionsFor(getEncyclopediaEntry('probiotics'))).toEqual(
      [],
    );
    // Synthetic partial entry: only the stated field renders.
    const partial = encyclopediaSectionsFor({
      family: {
        value: 'Testaceae',
        source: {
          name: 'Wikidata',
          url: 'https://www.wikidata.org/wiki/Q1',
          retrieved: '2026-10-29',
        },
      },
    });
    expect(partial.map((s) => s.key)).toEqual(['family']);
  });

  it('section order is family → description → distribution → cultivation → constituents', () => {
    const sections = encyclopediaSectionsFor(getEncyclopediaEntry('arnica'));
    const keys = sections.map((s) => s.key);
    const order = [
      'family',
      'description',
      'distribution',
      'cultivation',
      'constituents',
    ];
    const filtered = order.filter((k) => keys.includes(k));
    expect(keys).toEqual(filtered);
  });
});

describe('illustration corrections through the card view-model', () => {
  it('corrected slugs resolve to their Commons URLs and render', () => {
    expect(CORRECTED_SLUGS).toHaveLength(17);
    for (const slug of CORRECTED_SLUGS) {
      expect(BOTANICAL_ILLUSTRATIONS[slug], slug).toBe(CORRECTED[slug].url);
      const card = getHerbalCard(slug);
      expect(card, slug).toBeDefined();
      expect(card!.illustrationUrl, slug).toBe(CORRECTED[slug].url);
      expect(card!.illustrationRenderable, slug).toBe(true);
    }
  });

  it('compound/blend records and coptis resolve to no illustration (monogram)', () => {
    for (const slug of NO_ILLUSTRATION_SLUGS) {
      expect(BOTANICAL_ILLUSTRATIONS[slug], slug).toBeUndefined();
      const card = getHerbalCard(slug);
      expect(card, slug).toBeDefined();
      expect(card!.illustrationUrl, slug).toBeNull();
      expect(card!.illustrationRenderable, slug).toBe(false);
    }
  });
});

describe('illustration credits (attribution plumbing)', () => {
  it('every corrected entry carries a credit record matching the audit', () => {
    expect(Object.keys(ILLUSTRATION_CREDITS).sort()).toEqual(
      [...CORRECTED_SLUGS].sort(),
    );
    for (const slug of CORRECTED_SLUGS) {
      const credit = illustrationCreditFor(slug);
      expect(credit, slug).toBeDefined();
      expect(credit!.attribution, slug).toBe(CORRECTED[slug].attribution);
      expect(credit!.license, slug).toBe(CORRECTED[slug].license);
      expect(credit!.sourceUrl, slug).toContain('commons.wikimedia.org');
    }
  });

  it('every CC BY / CC BY-SA credit line names its license', () => {
    const ccSlugs = CORRECTED_SLUGS.filter((s) =>
      /^CC BY/.test(CORRECTED[s].license),
    );
    expect(ccSlugs.length).toBeGreaterThanOrEqual(10);
    for (const slug of ccSlugs) {
      expect(illustrationCreditFor(slug)!.attribution, slug).toContain(
        CORRECTED[slug].license,
      );
    }
  });

  it('non-corrected slugs carry no credit', () => {
    expect(illustrationCreditFor('lavender')).toBeUndefined();
    expect(illustrationCreditFor('coptis')).toBeUndefined();
  });
});

describe('related herbs + detail attribution', () => {
  it('related herbs are deterministic, capped, self-excluding, category-sharing', () => {
    const first = relatedHerbsFor('arnica');
    const second = relatedHerbsFor('arnica');
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(6);
    const arnica = getHerb('arnica')!;
    for (const related of first) {
      expect(related.slug).not.toBe('arnica');
      expect(related.href).toBe(`/herbal-library/${related.slug}`);
      const record = getHerb(related.slug)!;
      expect(
        record.categories.some((c) => arnica.categories.includes(c)),
      ).toBe(true);
    }
  });

  it('unknown herbs have no related list', () => {
    expect(relatedHerbsFor('no-such-herb')).toEqual([]);
  });

  it('attribution: corrected slugs carry credit; sections switch the Wikipedia/Wikidata line on', () => {
    const withSections = detailAttributionFor(
      'ginkgo',
      encyclopediaSectionsFor(getEncyclopediaEntry('ginkgo')),
    );
    expect(withSections.illustrationCredit).not.toBeNull();
    expect(withSections.creditWikipediaWikidata).toBe(
      encyclopediaSectionsFor(getEncyclopediaEntry('ginkgo')).length > 0,
    );
    const bare = detailAttributionFor('coptis', []);
    expect(bare.illustrationCredit).toBeNull();
    expect(bare.creditWikipediaWikidata).toBe(false);
  });
});
