/**
 * Drift guard for the GENERATED herb search data
 * (lib/search/herb-search-data.ts).
 *
 * The site search runs in the browser, so it cannot import the full
 * herbal registries without bloating every page's bundle — it reads
 * the compact generated file instead. That file must never drift
 * from the source of truth: this test re-derives every record from
 * the exact modules the herb pages render from
 * (lib/herbal-index/cards: herbalRouteParams + getHerbalCard;
 * lib/content/herbs: HERB_INDEX) and compares field by field.
 *
 * If this test fails, the source registries changed — regenerate,
 * do not hand-edit the data file:
 *   node scripts/generate-herb-search-data.mjs
 */
import { describe, expect, it } from 'vitest';
import { HERB_SEARCH_DATA } from './herb-search-data';
import {
  getHerbalCard,
  herbalRouteParams,
} from '../herbal-index/cards';
import { HERB_INDEX } from '../content/herbs';

describe('HERB_SEARCH_DATA — generated herb search data stays true to source', () => {
  it('carries exactly one record per herb page route, in route order', () => {
    const routes = herbalRouteParams().map(({ herb }) => herb);
    expect(HERB_SEARCH_DATA.map((r) => r.slug)).toEqual(routes);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('every record matches its source card, field by field, verbatim', () => {
    const indexBySlug = new Map(HERB_INDEX.map((e) => [e.slug, e]));
    for (const record of HERB_SEARCH_DATA) {
      const card = getHerbalCard(record.slug);
      expect(card, `no herbal card for route ${record.slug}`).toBeDefined();
      expect(record.name).toBe(card!.name);
      expect(record.latin).toBe(card!.latin);
      expect(record.labels).toEqual(card!.categoryLabels);
      expect(record.props).toEqual(card!.properties);
      const indexEntry = indexBySlug.get(record.slug);
      const expectedAka =
        indexEntry && indexEntry.name !== card!.name ? indexEntry.name : undefined;
      expect(record.aka).toBe(expectedAka);
    }
  });

  it('carries no record for a route the herbal library does not serve', () => {
    const routes = new Set(herbalRouteParams().map(({ herb }) => herb));
    for (const record of HERB_SEARCH_DATA) {
      expect(routes.has(record.slug)).toBe(true);
    }
  });
});
