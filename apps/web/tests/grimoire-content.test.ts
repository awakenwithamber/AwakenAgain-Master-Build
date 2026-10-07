/**
 * WORKSTREAM D — Living Grimoire content regression suite.
 *
 * Laws under test:
 * - Page sequence is fixed: title → about → index → 12 herb entries →
 *   colophon (16 pages, even count for two-page spreads).
 * - The 12 priority herbs appear in owner-specified order with real catalog
 *   text (no invented entries), a hotlinked CDN illustration, Latin name,
 *   categories, traditional note + benefits.
 * - Every herb page carries the evidence-context footnote (traditional use /
 *   early evidence — never collapsed to "proven").
 * - Allies never include the herb itself and stay within volume one.
 * - The in-book index references only volume-one herbs and jumps resolve to
 *   valid page numbers.
 * - Brand name is exact; no forbidden efficacy/marketing claims are
 *   introduced by the Grimoire copy itself.
 */
import { describe, expect, it } from 'vitest';
import {
  GRIMOIRE_HERB_ORDER,
  GRIMOIRE_INDEX,
  GRIMOIRE_TITLE,
  PARACELSUS_QUOTE,
  EVIDENCE_FOOTNOTE,
  HERB_ILLUSTRATIONS,
  buildGrimoirePages,
  herbPageNumber,
  pageTitle,
  type GrimoireHerbPageData,
  type GrimoirePage,
} from '../components/grimoire/grimoireContent';

const EXPECTED_ORDER = [
  'lavender',
  'chamomile',
  'ashwagandha',
  'valerian',
  'passionflower',
  'lemon-balm',
  'echinacea',
  'elderberry',
  'turmeric',
  'ginger',
  'peppermint',
  'rose',
];

function herbPages(pages: GrimoirePage[]): GrimoireHerbPageData[] {
  return pages.filter(
    (p): p is GrimoireHerbPageData => p.kind === 'herb',
  );
}

describe('grimoire page sequence', () => {
  it('builds 16 pages in the fixed order: title, about, index, 12 herbs, colophon', () => {
    const pages = buildGrimoirePages();
    expect(pages).toHaveLength(16);
    expect(pages.map((p) => p.kind)).toEqual([
      'title',
      'about',
      'index',
      ...EXPECTED_ORDER.map(() => 'herb'),
      'colophon',
    ]);
  });

  it('page numbers are 1-based and sequential', () => {
    const pages = buildGrimoirePages();
    expect(pages.map((p) => p.pageNumber)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  it('title page carries the exact book title and Paracelsus quote', () => {
    expect(GRIMOIRE_TITLE).toBe('The Living Grimoire of Herbs');
    expect(PARACELSUS_QUOTE).toBe(
      'The art of healing comes from nature, not from the physician.',
    );
    const pages = buildGrimoirePages();
    expect(pageTitle(pages[0])).toBe(GRIMOIRE_TITLE);
  });
});

describe('grimoire herb entries', () => {
  it('covers the 12 priority herbs in owner-specified order', () => {
    expect([...GRIMOIRE_HERB_ORDER]).toEqual(EXPECTED_ORDER);
    const pages = herbPages(buildGrimoirePages());
    expect(pages.map((p) => p.herb.id)).toEqual(EXPECTED_ORDER);
  });

  it('every entry has real catalog text: name, latin, note, ≥1 benefit', () => {
    for (const p of herbPages(buildGrimoirePages())) {
      expect(p.herb.name.length).toBeGreaterThan(0);
      expect(p.herb.latin.length).toBeGreaterThan(0);
      expect(p.herb.traditionalNote.length).toBeGreaterThan(20);
      expect(p.herb.traditionalBenefits.length).toBeGreaterThanOrEqual(1);
      expect(p.herb.categories.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has a hotlinked CDN illustration URL', () => {
    for (const p of herbPages(buildGrimoirePages())) {
      expect(p.illustration).toBe(HERB_ILLUSTRATIONS[p.herb.id]);
      expect(p.illustration.startsWith('https://')).toBe(true);
    }
  });

  it('allies never include the herb itself and stay within volume one', () => {
    for (const p of herbPages(buildGrimoirePages())) {
      expect(p.allies).not.toContain(p.herb.id);
      expect(p.allies.length).toBeLessThanOrEqual(3);
      for (const a of p.allies) {
        expect(EXPECTED_ORDER).toContain(a);
      }
    }
  });
});

describe('grimoire index', () => {
  it('every concern references only volume-one herbs', () => {
    for (const c of GRIMOIRE_INDEX) {
      expect(c.herbs.length).toBeGreaterThan(0);
      for (const h of c.herbs) {
        expect(EXPECTED_ORDER).toContain(h);
      }
    }
  });

  it('herbPageNumber resolves to a valid herb page for every referenced herb', () => {
    const pages = buildGrimoirePages();
    const seen = new Set<number>();
    for (const c of GRIMOIRE_INDEX) {
      for (const h of c.herbs) {
        const n = herbPageNumber(h);
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(15);
        expect(pages[n - 1].kind).toBe('herb');
        seen.add(n);
      }
    }
    // Every volume-one herb is reachable from the index.
    expect(seen.size).toBe(12);
  });

  it('index search keywords are non-empty lowercase strings', () => {
    for (const c of GRIMOIRE_INDEX) {
      expect(c.keywords.length).toBeGreaterThan(0);
      for (const k of c.keywords) expect(k).toBe(k.toLowerCase());
    }
  });
});

describe('grimoire copy guardrails', () => {
  it('the evidence footnote frames entries as traditional/early — not proven', () => {
    expect(EVIDENCE_FOOTNOTE.toLowerCase()).toContain('traditional');
    expect(EVIDENCE_FOOTNOTE.toLowerCase()).not.toContain('proven');
    expect(EVIDENCE_FOOTNOTE.toLowerCase()).not.toContain('guaranteed');
  });

  it('grimoire-owned copy never introduces forbidden claims', () => {
    const ownCopy = [
      GRIMOIRE_TITLE,
      PARACELSUS_QUOTE,
      EVIDENCE_FOOTNOTE,
      ...GRIMOIRE_INDEX.map((c) => c.concern),
    ].join(' ');
    for (const bad of ['proven', 'guaranteed', 'miracle', 'cures']) {
      expect(ownCopy.toLowerCase()).not.toContain(bad);
    }
  });

  it('brand name is exact wherever it appears in grimoire copy', () => {
    const ownCopy = [GRIMOIRE_TITLE, EVIDENCE_FOOTNOTE].join(' ');
    expect(ownCopy).not.toMatch(/Amber's Alchemy(?! Apothecary)/);
  });

  it('page titles are human-readable for the aria-live announcements', () => {
    for (const p of buildGrimoirePages()) {
      expect(pageTitle(p).length).toBeGreaterThan(0);
    }
  });
});
