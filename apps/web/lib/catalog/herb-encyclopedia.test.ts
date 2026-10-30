/**
 * Herb encyclopedia overlay (Herbal Encyclopedia, Project 2, Phase 2A).
 *
 * Laws: the overlay is populated ONLY from Wikidata / Wikipedia via
 * scripts/build-encyclopedia-overlay.mjs, every populated field carries
 * its provenance (source name, canonical URL, retrieval date), family
 * comes from Wikidata taxonomy alone, and herbs the sources did not
 * cover — including the catalog's non-botanical compound records —
 * carry NO entry: nothing is fabricated to fill a gap.
 */
import { describe, expect, it } from 'vitest';
import { HERBS } from './herbs';
import {
  ENCYCLOPEDIA_FIELDS,
  HERB_ENCYCLOPEDIA_DATA,
  getEncyclopediaEntry,
  type EncyclopediaEntry,
} from './herb-encyclopedia';
import { HERB_INDEX } from '../content/herbs';
import { HERB_INDEX_SLUG_ALIASES } from '../herbal-index/cards';

const CATALOG_IDS = new Set(HERBS.map((h) => h.id));
const ENTRIES = Object.entries(HERB_ENCYCLOPEDIA_DATA);

/** The catalog's non-botanical compound / supplement records. */
const NON_BOTANICAL_IDS = [
  'propolis',
  'triphala',
  'pearl-powder',
  'deer-antler',
  'trikatu',
  'coq10',
  'n-acetyl-cysteine',
  'vitamin-d3',
  'vitamin-k2',
  'b12-methylcobalamin',
  'folate',
  'probiotics',
];

/** HERB_INDEX (pilot tranche) slugs resolved to catalog record ids. */
const PILOT_IDS = HERB_INDEX.map(
  (entry) => HERB_INDEX_SLUG_ALIASES[entry.slug] ?? entry.slug,
);

function populatedFields(entry: EncyclopediaEntry) {
  return ENCYCLOPEDIA_FIELDS.filter((f) => entry[f] !== undefined);
}

describe('herb encyclopedia overlay (Phase 2A)', () => {
  it('keys are all real catalog ids — no entry for anything else', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    for (const [id] of ENTRIES) {
      expect(CATALOG_IDS.has(id), `unknown catalog id: ${id}`).toBe(true);
    }
  });

  it('every entry carries at least one populated field', () => {
    for (const [id, entry] of ENTRIES) {
      expect(
        populatedFields(entry).length,
        `empty entry: ${id}`,
      ).toBeGreaterThan(0);
    }
  });

  it('every populated field carries full provenance', () => {
    for (const [id, entry] of ENTRIES) {
      for (const field of populatedFields(entry)) {
        const sourced = entry[field];
        if (!sourced) continue;
        expect(sourced.source.name, `${id}.${field} source name`).toBeTruthy();
        expect(
          sourced.source.url.startsWith('https://'),
          `${id}.${field} source url`,
        ).toBe(true);
        expect(sourced.source.retrieved, `${id}.${field} retrieved`).toBe(
          '2026-10-29',
        );
        if (typeof sourced.value === 'string') {
          expect(sourced.value.trim().length, `${id}.${field}`).toBeGreaterThan(
            0,
          );
        } else {
          expect(sourced.value.length, `${id}.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('family and traditional names come from Wikidata; prose fields from Wikipedia', () => {
    for (const [id, entry] of ENTRIES) {
      if (entry.family) {
        expect(entry.family.source.name, `${id}.family`).toBe('Wikidata');
        expect(entry.family.source.url).toContain('wikidata.org/wiki/Q');
      }
      if (entry.traditionalNames) {
        expect(entry.traditionalNames.source.name, `${id}.names`).toBe(
          'Wikidata',
        );
      }
      for (const field of [
        'description',
        'distribution',
        'cultivation',
        'constituents',
      ] as const) {
        const sourced = entry[field];
        if (sourced) {
          expect(sourced.source.name, `${id}.${field}`).toBe('Wikipedia');
          expect(sourced.source.url).toContain('en.wikipedia.org/wiki/');
        }
      }
    }
  });

  it('text extracts stay within the ~600-char cap', () => {
    for (const [id, entry] of ENTRIES) {
      for (const field of [
        'description',
        'distribution',
        'cultivation',
        'constituents',
      ] as const) {
        const sourced = entry[field];
        if (sourced) {
          expect(sourced.value.length, `${id}.${field}`).toBeLessThanOrEqual(
            650,
          );
        }
      }
    }
  });

  it('fabricates nothing for herbs the sources did not cover', () => {
    for (const herb of HERBS) {
      if (!(herb.id in HERB_ENCYCLOPEDIA_DATA)) {
        expect(getEncyclopediaEntry(herb.id)).toBeUndefined();
      }
    }
    // The catalog's non-botanical compounds have no taxon to match:
    // they must stay absent rather than inherit a plant's data.
    for (const id of NON_BOTANICAL_IDS) {
      expect(CATALOG_IDS.has(id), `compound id drifted: ${id}`).toBe(true);
      expect(getEncyclopediaEntry(id), `fabricated entry: ${id}`).toBeUndefined();
    }
    expect(getEncyclopediaEntry('no-such-herb')).toBeUndefined();
  });

  it('no field value carries a forbidden payment-provider token', () => {
    // Mirrors tests/no-forbidden-providers.test.ts at overlay level:
    // "square" is botanical English, so the generator shortens any
    // extract containing a token to its verbatim prefix (or omits it).
    const forbidden = /\b(shopify|paypal|square)\b/i;
    for (const [id, entry] of ENTRIES) {
      for (const field of populatedFields(entry)) {
        const value = entry[field]?.value;
        const text =
          typeof value === 'string' ? value : (value ?? []).join(' ');
        expect(forbidden.test(text), `${id}.${field}`).toBe(false);
      }
    }
  });

  it('pilot tranche: the 29 canonical HERB_INDEX herbs resolve to catalog ids', () => {
    expect(PILOT_IDS).toHaveLength(29);
    for (const id of PILOT_IDS) {
      expect(CATALOG_IDS.has(id), `pilot id not in catalog: ${id}`).toBe(true);
    }
  });

  it('pilot spot-checks: chamomile and valerian carry a Wikidata family', () => {
    for (const id of ['chamomile', 'valerian']) {
      const entry = getEncyclopediaEntry(id);
      expect(entry, `missing pilot entry: ${id}`).toBeDefined();
      expect(entry?.family?.value).toBeTruthy();
      expect(entry?.family?.source.name).toBe('Wikidata');
    }
  });
});
