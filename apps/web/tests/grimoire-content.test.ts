/**
 * WORKSTREAM D — Living Grimoire content regression suite
 * (ingestion follow-on, owner directives 2026-10-21: "Make the full
 * grimoire first", "Add them all", free preview = 16 pages).
 *
 * Laws under test:
 * - Composed book = 1,389 pages: free preview pp. 1–16 (title,
 *   ancestor note ×2, framing teaser, overview, TOC, full-book
 *   index, one sample from EACH of the nine publishable collected
 *   works) → gated framing FULL (17–18) → about (19) → concern
 *   index (20) → the family edition COMPLETE (21–353 = its 333
 *   pages) → the original sigil lesson (354) → the collected works
 *   in full (355–1388) → colophon (1389).
 * - Composition reconciles with the assembly model in
 *   lib/grimoire/manifest.ts (333 = parts sum; per-book counts;
 *   oldest-first order).
 * - The held Black Books of Elverum appears ONLY as a rights-pending
 *   TOC/index entry — no sample, no full pages, no content.
 * - Owner copy is verbatim (framing teaser + full, ancestor note,
 *   overview); book text is the assembly's extracted text/facsimiles.
 * - The 12 priority herbs keep their owner order, CDN illustrations,
 *   and the concern index still references only volume-one herbs;
 *   its jump lands on the family edition's Herbal Allies opening.
 * - Brand name is exact; no forbidden efficacy claims in Grimoire copy.
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
  displayPagesFor,
  pageTitle,
  type GrimoirePage,
} from '../components/grimoire/grimoireContent';
import {
  composedPageCount,
  COVER_ONLY_WORKS,
  getEditionManifest,
  publishableBooks,
  type EditionManifest,
} from '../lib/grimoire/manifest';
import { getBookContent } from '../lib/grimoire/book-content';

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

const manifest = getEditionManifest();
const content = getBookContent();
const pages = buildGrimoirePages(manifest, content);

function kindAt(n: number): GrimoirePage['kind'] {
  return pages[n - 1].kind;
}

describe('grimoire composed book', () => {
  it('composes 1,389 pages, reconciled with the manifest model', () => {
    expect(composedPageCount(manifest)).toBe(1389);
    expect(pages).toHaveLength(1389);
    expect(pages.map((p) => p.pageNumber)).toEqual(
      Array.from({ length: 1389 }, (_, i) => i + 1),
    );
    expect(pages[1388].kind).toBe('colophon');
  });

  it('free preview pp. 1–16: front matter + one sample per publishable book', () => {
    expect(pages.slice(0, 7).map((p) => p.kind)).toEqual([
      'title',
      'ancestor-note',
      'ancestor-prose',
      'framing',
      'overview',
      'toc',
      'book-index',
    ]);
    const samples = pages.slice(7, 16);
    expect(samples.every((p) => p.kind === 'collection-sample')).toBe(true);
    const publishable = publishableBooks(manifest);
    expect(publishable).toHaveLength(9);
    expect(
      samples.map((p) => (p.kind === 'collection-sample' ? p.bookId : '')),
    ).toEqual(publishable.map((b) => b.id));
    // Each sample carries its book's chosen source page, verbatim.
    for (const [i, meta] of publishable.entries()) {
      const sample = samples[i];
      const src = content.books[meta.id][meta.sampleSourcePage - 1];
      if (sample.kind !== 'collection-sample') throw new Error('not a sample');
      expect(sample.heading).toBe(src.heading);
      expect(sample.paragraphs).toEqual(src.paragraphs);
      expect(sample.attribution).toBe(meta.attribution);
    }
  });

  it('gated body: framing full, about, concern index, family, lesson, books', () => {
    expect(kindAt(17)).toBe('framing-full');
    expect(kindAt(18)).toBe('framing-full');
    expect(kindAt(19)).toBe('about');
    expect(kindAt(20)).toBe('index');
    expect(kindAt(21)).toBe('edition-page');
    expect(kindAt(353)).toBe('edition-page');
    expect(kindAt(354)).toBe('original-lesson');
    expect(kindAt(355)).toBe('collection-page');
    expect(kindAt(1388)).toBe('collection-page');
  });

  it('framing FULL version is verbatim owner copy on pp. 17–18', () => {
    const a = pages[16];
    const b = pages[17];
    if (a.kind !== 'framing-full' || b.kind !== 'framing-full') {
      throw new Error('framing-full pages missing');
    }
    expect(a.paragraphs.join(' ')).toContain('living document');
    expect(b.paragraphs.join(' ')).toContain('hide it when riders come');
    expect(b.paragraphs[b.paragraphs.length - 2]).toBe(
      'They tried to erase the real ones. They could not stop us from keeping them.',
    );
    expect(b.paragraphs[b.paragraphs.length - 1]).toBe(
      '— kept by Amber’s Alchemy Apothecary',
    );
  });

  it('the family edition is complete: composed 21–353 = edition pages 1–333', () => {
    const family = pages.filter((p) => p.kind === 'edition-page');
    expect(family).toHaveLength(333);
    expect(family.map((p) => p.pageNumber)).toEqual(
      Array.from({ length: 333 }, (_, i) => i + 21),
    );
    for (const [i, p] of family.entries()) {
      if (p.kind !== 'edition-page') throw new Error('shape');
      expect(p.editionPageNumber).toBe(i + 1);
      expect(p.paragraphs).toEqual(content.familyPages[i].paragraphs);
      expect(p.heading).toBe(content.familyPages[i].heading);
    }
    // Part boundaries land where the manifest's 333 model puts them.
    const partStarts = manifest.parts333.map(
      (part) => family[part.startPage - 1],
    );
    for (const [i, p] of partStarts.entries()) {
      if (p.kind !== 'edition-page') throw new Error('shape');
      expect(p.part).toBe(manifest.parts333[i].part);
      expect(p.partTitle).toBe(manifest.parts333[i].title);
    }
    expect(
      manifest.parts333.reduce((sum, p) => sum + p.pageCount, 0),
    ).toBe(333);
  });

  it('the sigil lesson is the original page, at composed p. 354', () => {
    const lesson = pages[353];
    if (lesson.kind !== 'original-lesson') throw new Error('lesson missing');
    expect(lesson.heading).toBe('Sigil-Making');
    expect(lesson.paragraphs).toEqual(content.sigilLesson.paragraphs);
    expect(lesson.paragraphs.join(' ')).toContain('Austin Osman Spare');
    // The held Spells8 article text is NOT the lesson (rights hold).
    expect(lesson.paragraphs.join(' ')).not.toContain('Spells8');
  });

  it('collected works appear in full, oldest-first, with manifest counts', () => {
    let cursor = 355;
    for (const meta of publishableBooks(manifest)) {
      const slice = pages.slice(cursor - 1, cursor - 1 + meta.pageCount);
      expect(slice).toHaveLength(meta.pageCount);
      for (const [i, p] of slice.entries()) {
        if (p.kind !== 'collection-page') throw new Error('shape');
        expect(p.bookId).toBe(meta.id);
        expect(p.bookPageNumber).toBe(i + 1);
        expect(p.paragraphs).toEqual(content.books[meta.id][i].paragraphs);
      }
      // Attribution rides the book's opening page only.
      const first = slice[0];
      if (first.kind !== 'collection-page') throw new Error('shape');
      expect(first.attribution).toBe(meta.attribution);
      cursor += meta.pageCount;
    }
    expect(cursor).toBe(1389); // last book ends at 1388; colophon follows
  });

  it('Albertus Magnus is facsimile-only: page images, no text paragraphs', () => {
    const albertus = pages.filter(
      (p) => p.kind === 'collection-page' && p.bookId.startsWith('albertus'),
    );
    expect(albertus).toHaveLength(216);
    for (const p of albertus) {
      if (p.kind !== 'collection-page') throw new Error('shape');
      expect(p.paragraphs).toEqual([]);
      expect(p.pageImage).toMatch(/^\/grimoire\/albertus[^/]+\/page-\d+\.jpg$/);
    }
  });

  it('title page carries the exact book title and Paracelsus quote', () => {
    expect(GRIMOIRE_TITLE).toBe('Living Grimoire of Light & Magic');
    expect(PARACELSUS_QUOTE).toBe(
      'The art of healing comes from nature, not from the physician.',
    );
    expect(pageTitle(pages[0])).toBe(GRIMOIRE_TITLE);
  });

  it('TOC and full-book index are generated from the manifest', () => {
    const toc = pages.find((p) => p.kind === 'toc');
    const bookIndex = pages.find((p) => p.kind === 'book-index');
    if (toc?.kind !== 'toc' || bookIndex?.kind !== 'book-index') {
      throw new Error('front matter pages missing');
    }
    const partEntries = bookIndex.entries.filter((e) =>
      e.label.startsWith('Part '),
    );
    expect(partEntries).toHaveLength(7);
    expect(
      partEntries.some((e) => e.label.includes('Herbal Allies')),
    ).toBe(true);
    // Every publishable book is indexed with its composed range.
    for (const meta of publishableBooks(manifest)) {
      expect(
        bookIndex.entries.some((e) => e.label === meta.title),
      ).toBe(true);
      expect(
        toc.entries.some(
          (e) => e.label === meta.title && e.detail.includes('in full'),
        ),
      ).toBe(true);
      expect(
        toc.entries.some((e) => e.label === `A taste of — ${meta.title}`),
      ).toBe(true);
    }
    // Cover-only works are indexed as not-yet-received, not content.
    for (const work of COVER_ONLY_WORKS) {
      expect(
        bookIndex.entries.some(
          (e) => e.label === work.title && e.detail === work.note,
        ),
      ).toBe(true);
    }
  });

  it('Elverum: rights-pending TOC/index entries ONLY — no sample, no pages', () => {
    const toc = pages.find((p) => p.kind === 'toc');
    const bookIndex = pages.find((p) => p.kind === 'book-index');
    if (toc?.kind !== 'toc' || bookIndex?.kind !== 'book-index') {
      throw new Error('front matter pages missing');
    }
    for (const surface of [toc.entries, bookIndex.entries]) {
      const held = surface.filter((e) => e.label.includes('Elverum'));
      expect(held).toHaveLength(1);
      expect(held[0].detail).toBe('rights pending — not yet available');
    }
    expect(
      pages.some(
        (p) =>
          (p.kind === 'collection-sample' || p.kind === 'collection-page') &&
          p.bookId.includes('elverum'),
      ),
    ).toBe(false);
    expect(manifest.collectionBooks).toHaveLength(10);
    expect(manifest.collectionBooks[9].held).toBe(true);
  });

  it('composition is manifest-driven: a reduced manifest composes a smaller book', () => {
    const emerald = manifest.collectionBooks.find((b) =>
      b.id.startsWith('emerald'),
    );
    if (!emerald) throw new Error('emerald meta missing');
    const reduced: EditionManifest = { ...manifest, collectionBooks: [emerald] };
    const reducedContent = {
      familyPages: content.familyPages,
      sigilLesson: content.sigilLesson,
      framingFullPages: content.framingFullPages,
      books: { [emerald.id]: content.books[emerald.id] },
    };
    const small = buildGrimoirePages(reduced, reducedContent);
    // 7 front + 1 sample + 2 framing + 1 about + 1 index + 333 + 1 + 17 + 1
    expect(small).toHaveLength(364);
    expect(small[7].kind).toBe('collection-sample');
    expect(small[small.length - 1].kind).toBe('colophon');
  });

  it('displayPagesFor keeps pp. 1–16 open and locks 17+', () => {
    const free = displayPagesFor(pages, false);
    expect(free.slice(0, 16).every((p) => p.kind !== 'locked')).toBe(true);
    expect(free[16].kind).toBe('locked');
    expect(free.filter((p) => p.kind === 'locked')).toHaveLength(1389 - 16);
  });
});

describe('grimoire herb data (concern index + illustrations)', () => {
  it('covers the 12 priority herbs in owner-specified order', () => {
    expect([...GRIMOIRE_HERB_ORDER]).toEqual(EXPECTED_ORDER);
  });

  it('every priority herb has a hotlinked CDN illustration URL', () => {
    for (const slug of EXPECTED_ORDER) {
      expect(HERB_ILLUSTRATIONS[slug]).toMatch(/^https:\/\//);
    }
  });

  it('every concern references only volume-one herbs; keywords lowercase', () => {
    for (const c of GRIMOIRE_INDEX) {
      expect(c.herbs.length).toBeGreaterThan(0);
      for (const h of c.herbs) expect(EXPECTED_ORDER).toContain(h);
      expect(c.keywords.length).toBeGreaterThan(0);
      for (const k of c.keywords) expect(k).toBe(k.toLowerCase());
    }
  });

  it('the concern index jumps to the Herbal Allies opening (composed p. 92)', () => {
    const index = pages.find((p) => p.kind === 'index');
    if (index?.kind !== 'index') throw new Error('index page missing');
    expect(index.targetPage).toBe(92);
    const target = pages[index.targetPage - 1];
    if (target.kind !== 'edition-page') throw new Error('target shape');
    expect(target.part).toBe('III');
    expect(target.editionPageNumber).toBe(72);
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
    for (const p of pages) {
      expect(pageTitle(p).length).toBeGreaterThan(0);
    }
  });
});
