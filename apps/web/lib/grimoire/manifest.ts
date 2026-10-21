/**
 * Edition manifest — the full book's assembly model.
 *
 * Ingestion follow-on (owner directives 2026-10-21: "Make the full
 * grimoire first", "Add them all", free preview = 16 pages, Option B):
 * the interim empty collection has been REPLACED by the real assembled
 * book inventoried in the assembly package
 * (grimoire-full-assembly/full-grimoire-manifest.json — order, page
 * counts and rights flags below are taken from it verbatim in
 * substance). The composed site book is:
 *
 *   free preview (16 composed pages: cover/title, the ancestor's
 *   note ×2, framing teaser, book overview, generated TOC, generated
 *   index, and one sample page from EACH of the nine publishable
 *   collected works) → the framing FULL version → reading guidance →
 *   the concern index → the family edition COMPLETE (333 pages) →
 *   the original sigil-making lesson → the collected works IN FULL →
 *   colophon. Pages 17+ are gated (subscription ∪ PERMANENT_UNLOCK ∪
 *   keeper — lib/grimoire/entitlement).
 *
 * THE 16TH PREVIEW PAGE, reconciled: Option B's six fixed elements +
 * nine publishable samples = 15. The sixteenth page is the SECOND
 * page of the ancestor's note (the owner's own prose closing the
 * note), which the assembly manifest's front-matter budget already
 * carries (front matter pp. 2–3) and Option B had condensed into one
 * page. No book's sample was dropped to make the count.
 *
 * RIGHTS HOLD: The Black Books of Elverum (© 1999 Mary S. Rustad)
 * is metadata ONLY here — `held: true`. It contributes no pages, no
 * sample, and no content anywhere; it appears solely as a locked
 * "rights pending" line in the generated TOC and index. Its page
 * content lives in NO data file (lib/grimoire/book-content.ts never
 * loads it; a test proves its text is absent from every payload).
 *
 * One further supplied cover was EXCLUDED by owner directive
 * (2026-10-21): it is named nowhere in this manifest, the book, the
 * TOC, or the index (the exclusion is recorded in the assembly
 * package and the ingestion report, not in code). Corpus Hermeticum
 * and The Veil of Isis are cover-only (the
 * books were never received) — they are not book entries; the
 * generated index notes them as not-yet-received.
 *
 * CLIENT-SAFE: pure data + functions, no server imports, NO book
 * text. Page CONTENT lives server-side in lib/grimoire/book-content.ts
 * (generated data under data/grimoire/ at the repo root) and is injected into the
 * composition by the server page — never through this module.
 */

export interface EditionPart {
  part: string;
  title: string;
  /** 1-based first page within the 333-page edition (evidenced). */
  startPage: number;
  /** Page count within the 333-page edition (evidenced). */
  pageCount: number;
}

/** The 333-page edition's parts — audit Deliverable D §1.3 (VERIFIED). */
export const EDITION_333_PARTS: readonly EditionPart[] = [
  { part: 'I', title: 'Foundations', startPage: 1, pageCount: 15 },
  { part: 'II', title: 'Wheel of the Year', startPage: 16, pageCount: 56 },
  { part: 'III', title: 'Herbal Allies', startPage: 72, pageCount: 145 },
  { part: 'IV', title: 'Five Elements', startPage: 217, pageCount: 25 },
  { part: 'V', title: 'Rituals & Reflections', startPage: 242, pageCount: 50 },
  { part: 'VI', title: 'Recipes', startPage: 292, pageCount: 27 },
  { part: 'VII', title: 'Apothecary & Closing', startPage: 319, pageCount: 15 },
];

export type CollectionStrategy =
  | 'text'
  | 'text-images'
  | 'page-image-text'
  | 'page-image';

/**
 * One collected work, as inventoried in the assembly package.
 * Metadata only — this module never carries book text.
 */
export interface CollectionBookMeta {
  /** Slug — matches the assembly package and the data/asset paths. */
  id: string;
  title: string;
  /** Measured page count of the supplied book (assembly manifest). */
  pageCount: number;
  strategy: CollectionStrategy;
  /** Short rights flag (assembly manifest §6, in substance). */
  rights: string;
  /** Attribution / edition note kept with the book's content. */
  attribution: string;
  /** One-line index entry: the book's major contents. */
  indexLine: string;
  /** Supplied cover art (public path), or null when none was supplied. */
  cover: string | null;
  /**
   * 1-based page within the book used as its free-preview sample
   * (assembly manifest §5 sample table). 0 for a held book (no sample).
   */
  sampleSourcePage: number;
  /** Rights hold: TOC/index list it as rights-pending; never served. */
  held?: boolean;
}

/**
 * The collected works, in the assembly's order (front matter → family
 * edition → collection oldest-first by underlying work, the modern
 * compilation last). Page counts measured in the assembly package.
 */
export const COLLECTION_BOOKS: readonly CollectionBookMeta[] = [
  {
    id: 'emerald-tablet-of-hermes',
    title: 'The Emerald Tablet of Hermes',
    pageCount: 17,
    strategy: 'text',
    rights:
      'Underlying text ancient / public domain; this file’s history and apparatus are 20th-century scholarship — LOW–MODERATE flag.',
    attribution:
      'The Emerald Tablet of Hermes — the ancient Tabula Smaragdina with its history and translations, incl. Isaac Newton’s (c. 1680).',
    indexLine:
      'History of the Tablet; translations — Latin, Giorgio Beato, Isaac Newton (c. 1680), Kriegsmann, Roger Bacon’s Secretum Secretorum.',
    cover: '/grimoire/emerald-tablet-of-hermes/cover.jpg',
    sampleSourcePage: 4, // the Newton translation page (manifest §5)
  },
  {
    id: 'book-of-raziel',
    title: 'The Book of Raziel (Sefer Raziel HaMalakh / Liber Razielis)',
    pageCount: 74,
    strategy: 'page-image-text',
    rights:
      'Medieval text, public domain; this file is a modern folio-marked scholarly transcription of unstated provenance — LOW–MODERATE flag.',
    attribution:
      'The Book of Raziel — the medieval Liber Razielis in Middle English translation, shown in facsimile with its text.',
    indexLine:
      'The ix Precepts; seven treatises (incl. the Treatise of Times); the names of God; the Solomonic frame.',
    cover: '/grimoire/book-of-raziel/cover.jpg',
    sampleSourcePage: 1, // the Precepts opening (manifest §5)
  },
  {
    id: 'albertus-magnus-egyptian-secrets',
    title:
      'Albertus Magnus — Egyptian Secrets, or White and Black Art for Man and Beast',
    pageCount: 216,
    strategy: 'page-image',
    rights:
      'Pre-1929 pamphlet tradition, public-domain-likely; this scan’s edition is unidentified until OCR — pending identification.',
    attribution:
      'Albertus Magnus — Egyptian Secrets: a scanned pamphlet of the Albertus Magnus “Secrets” tradition, shown page by page as facsimile (text awaits OCR).',
    indexLine:
      'Remedies, charms and “white and black art” for man and beast — contents not yet enumerable: scanned pages only, OCR pending.',
    cover: '/grimoire/albertus-magnus-egyptian-secrets/cover.jpg',
    sampleSourcePage: 1, // facsimile scan page (manifest §5)
  },
  {
    id: 'grimorium-verum',
    title: 'Grimorium Verum (The True Grimoire)',
    pageCount: 27,
    strategy: 'text-images',
    rights:
      '18th-century French original, public domain; this file is the 1999 Phil Legard PDF transcription — LOW flag.',
    attribution:
      'Grimorium Verum — “translated from the Hebrew by Plangiere”, from the 18th-century French original (1999 PDF edition, Phil Legard).',
    indexLine:
      'Book I: Characters of the Daemons; Book II: Natural & Supernatural Secrets; Book III: Key to the Work — Lucifer, Beelzebuth, Astaroth.',
    cover: null,
    sampleSourcePage: 1, // title page (manifest §5)
  },
  {
    id: 'pow-wows-long-lost-friend',
    title: 'Pow-Wows; or, The Long Lost Friend (John George Hohman, 1820)',
    pageCount: 56,
    strategy: 'text',
    rights: '1820 US publication — public domain.',
    attribution:
      'Pow-Wows; or, The Long Lost Friend — John George Hohman’s collection of arts and remedies, first published in the U.S. in 1820.',
    indexLine:
      'Arts and remedies for man and animals; charms, cures and protections; the book’s own printed index closes the volume.',
    cover: null,
    sampleSourcePage: 1, // title page (manifest §5)
  },
  {
    id: 'sepher-sephiroth',
    title: 'Sepher Sephiroth (sub figura D) — A∴A∴',
    pageCount: 116,
    strategy: 'page-image-text',
    rights: 'The Equinox Vol. I No. 8 (1912) — public domain (US).',
    attribution:
      'Sepher Sephiroth — the Qabalistic dictionary of Crowley and Allan Bennett, The Equinox I:8 (1912), shown in facsimile with its text.',
    indexLine:
      'Preface on the dictionary method; the Dictionary proper: Hebrew words by numerical value (gematria), in tables.',
    cover: null,
    sampleSourcePage: 17, // first dictionary page (manifest §5)
  },
  {
    id: 'book-of-ceremonial-magic-waite-1913',
    title: 'The Book of Ceremonial Magic (Arthur Edward Waite, 1913)',
    pageCount: 266,
    strategy: 'text-images',
    rights: 'London 1913 (first ed. 1898) — public domain (US).',
    attribution:
      'The Book of Ceremonial Magic — Arthur Edward Waite, London 1913 (scanned at sacred-texts.com, J. B. Hare, redactor).',
    indexLine:
      'Part I, The Literature of Ceremonial Magic — the Key of Solomon, the Lesser Key, Abramelin, the Grimorium Verum and more; Part II, The Complete Grimoire — preparation of the operator and the ritual texts.',
    cover: '/grimoire/book-of-ceremonial-magic-waite-1913/cover.jpg',
    sampleSourcePage: 1, // Waite title page (manifest §5)
  },
  {
    id: 'irish-witchcraft-and-demonology',
    title: 'Irish Witchcraft and Demonology (St. John D. Seymour, 1913)',
    pageCount: 145,
    strategy: 'text-images',
    rights:
      '1913 original — public domain; this file is Project Gutenberg eBook #43651.',
    attribution:
      'Irish Witchcraft and Demonology — St. John D. Seymour (1913), via Project Gutenberg eBook #43651.',
    indexLine:
      'Nine chapters on Irish witchcraft trials, fairy-faith and demonology, from the 1324 Kilkenny proceedings forward.',
    cover: null,
    sampleSourcePage: 8, // Chapter I opening page (manifest §5)
  },
  {
    id: 'book-of-forbidden-knowledge',
    title: 'The Book of Forbidden Knowledge',
    pageCount: 117,
    strategy: 'text-images',
    rights:
      'Early-20th-century US compendium (Johnson Smith & Co. tradition) — public-domain-likely.',
    attribution:
      'The Book of Forbidden Knowledge — the Johnson Smith & Co. compendium of black magic, superstitions, charms, divination, signs and omens.',
    indexLine:
      'Charms and spells; fortune-telling; physiognomy; natal astrology; dream lore — an item-numbered compendium.',
    cover: '/grimoire/book-of-forbidden-knowledge/cover.jpg',
    sampleSourcePage: 40, // a representative charms page (manifest §5)
  },
  {
    id: 'black-books-of-elverum',
    title: 'The Black Books of Elverum',
    pageCount: 176,
    strategy: 'page-image-text',
    rights:
      '© 1999 Mary S. Rustad, all rights reserved (the book’s own copyright page) — RIGHTS PENDING: not published, not previewed, no access sold until the owner/counsel resolve permission.',
    attribution:
      'The Black Books of Elverum — rights pending; not yet available.',
    indexLine:
      'Two Norwegian black books of the Cyprianus tradition — rights pending; not yet available.',
    cover: null,
    sampleSourcePage: 0, // held — no sample, ever, while the hold stands
    held: true,
  },
];

/** Cover-only works: covers received, books never received. They are
 *  NOT part of the book; the generated index notes them honestly. */
export const COVER_ONLY_WORKS: readonly { title: string; note: string }[] = [
  {
    title: 'The Corpus Hermeticum',
    note: 'cover received; the book itself has not yet been received',
  },
  {
    title: 'The Veil of Isis, or the Mysteries of the Druids',
    note: 'frontispiece received; the book itself has not yet been received',
  },
];

/** Pages of the family edition (the owner's 333-page Grimoire). */
export const FAMILY_EDITION_PAGE_COUNT = 333;
/** The original sigil-making lesson, counted as one page. */
export const SIGIL_LESSON_PAGE_COUNT = 1;
/** Composed preview front pages: cover/title, ancestor note ×2,
 *  framing teaser, overview, TOC, index. */
export const PREVIEW_FRONT_PAGE_COUNT = 7;
/** The framing essay's FULL version, gated front matter: 2 pages. */
export const FRAMING_FULL_PAGE_COUNT = 2;
/** "How to read this grimoire" guidance page. */
export const ABOUT_PAGE_COUNT = 1;
/** The concern index page. */
export const CONCERN_INDEX_PAGE_COUNT = 1;
/** Closing colophon page. */
export const COLOPHON_PAGE_COUNT = 1;

export interface EditionManifest {
  editionId: 'living-grimoire-333';
  editionName: 'Living Grimoire — 333-page edition';
  parts333: readonly EditionPart[];
  /** Pages in the family edition (complete, ingested). */
  familyPageCount: number;
  collectionBooks: readonly CollectionBookMeta[];
}

export function getEditionManifest(): EditionManifest {
  return {
    editionId: 'living-grimoire-333',
    editionName: 'Living Grimoire — 333-page edition',
    parts333: EDITION_333_PARTS,
    familyPageCount: FAMILY_EDITION_PAGE_COUNT,
    collectionBooks: COLLECTION_BOOKS,
  };
}

/** Books that may be read (held books are excluded everywhere). */
export function publishableBooks(
  manifest: EditionManifest,
): readonly CollectionBookMeta[] {
  return manifest.collectionBooks.filter((b) => !b.held);
}

/** Total composed pages of the served book, from manifest metadata. */
export function composedPageCount(manifest: EditionManifest): number {
  const publishable = publishableBooks(manifest);
  const samples = publishable.length;
  const full = publishable.reduce((sum, b) => sum + b.pageCount, 0);
  return (
    PREVIEW_FRONT_PAGE_COUNT +
    samples +
    FRAMING_FULL_PAGE_COUNT +
    ABOUT_PAGE_COUNT +
    CONCERN_INDEX_PAGE_COUNT +
    manifest.familyPageCount +
    SIGIL_LESSON_PAGE_COUNT +
    full +
    COLOPHON_PAGE_COUNT
  );
}
