/**
 * WORKSTREAM D — Living Grimoire content model + composed book.
 *
 * THE COMPOSED BOOK (ingestion follow-on, owner directives
 * 2026-10-21: "Make the full grimoire first", "Add them all", free
 * preview = 16 pages / Option B):
 *
 *   pp. 1–16   FREE PREVIEW — cover/title · the ancestor's note (the
 *              quoted note, then the keeper's prose) · the framing
 *              TEASER · the book Overview · the generated table of
 *              contents · the generated index of the full book · one
 *              sample page from EACH of the nine publishable
 *              collected works (the held Elverum contributes none).
 *   pp. 17+    GATED — the framing FULL version · reading guidance ·
 *              the concern index · the family edition COMPLETE (333
 *              pages, real extracted text) · the original sigil
 *              lesson · the collected works IN FULL · colophon.
 *
 * Book text comes ONLY from lib/grimoire/book-content.ts (server
 * side; generated from the owner's assembly package — real extracted
 * text and facsimiles, never invented). This module is client-shared
 * and imports that module's TYPES only, so no gated text can enter a
 * client bundle through here.
 *
 * Herb entry content (names, Latin, traditional notes/benefits) is
 * VERBATIM from lib/catalog/herbs — used by the concern index and
 * the herb surfaces; benefits are framed as TRADITIONAL USE / early
 * evidence, never collapsed to "proven".
 */
import { getHerb, HERBS } from '../../lib/catalog/herbs';
import type { Herb } from '../../types';
import {
  composedPageCount,
  COVER_ONLY_WORKS,
  publishableBooks,
  getEditionManifest,
  type CollectionBookMeta,
  type EditionManifest,
  type EditionPart,
} from '../../lib/grimoire/manifest';
import type {
  BookPageContent,
  GrimoireBookContent,
} from '../../lib/grimoire/book-content';

export const GRIMOIRE_TITLE = 'Living Grimoire of Light & Magic';

export const PARACELSUS_QUOTE =
  'The art of healing comes from nature, not from the physician.';

export const EVIDENCE_FOOTNOTE =
  'Framed as traditional use and early findings — not medical advice, and never a substitute for your own care team.';

/** Priority order per the owner directive (12 herbs, volume one). */
export const GRIMOIRE_HERB_ORDER = [
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
] as const;

export type GrimoireHerbSlug = (typeof GRIMOIRE_HERB_ORDER)[number];

/** Botanical illustration CDN URLs (owner assets — hotlinked directly). */
export const HERB_ILLUSTRATIONS: Record<string, string> = {
  'lavender':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-lavender_c61be9fc.jpg',
  'chamomile':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-chamomile_24f1bf7f.jpg',
  'ashwagandha':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-ashwagandha_4c6d0285.jpg',
  'valerian':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-valerian_1bfa4b56.jpg',
  'passionflower':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-passionflower_72074d7d.jpg',
  'lemon-balm':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-lemon-balm_e6930d34.jpg',
  'echinacea':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-echinacea_472030c0.jpg',
  'elderberry':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-elderberry_1da3f271.jpg',
  'turmeric':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-turmeric_a524e6e8.jpg',
  'ginger':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-ginger_0caa06cd.jpg',
  'peppermint':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-peppermint_bead4a95.jpg',
  'rose':
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663508836609/VDHw29YgzjByjwgsGHGQ8W/herb-rose-hip_c140d24a.jpg',
};

/** Human labels for the catalog's lowercase category keys. */
const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep & Rest',
  energy: 'Energy',
  adaptogen: 'Adaptogen',
  immune: 'Immune Support',
  digestive: 'Digestion',
  pain: 'Comfort & Joints',
  beauty: 'Beauty & Skin',
  spiritual: 'Spirit & Ritual',
  hormonal: 'Hormonal Balance',
  stress: 'Calm & Stress',
  focus: 'Focus',
  cognitive: 'Cognitive',
  mood: 'Mood',
  emotional: 'Emotional Wellbeing',
  mushroom: 'Medicinal Mushroom',
};

export function categoryLabel(key: string): string {
  return (
    CATEGORY_LABELS[key] ??
    key
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

export interface GrimoireHerbPageData {
  kind: 'herb';
  herb: Herb;
  illustration: string;
  allies: string[];
  pageNumber: number;
}

export interface TocEntry {
  label: string;
  detail: string;
}

/** Fields shared by pages carrying collected-work content. */
interface CollectionContentFields {
  bookId: string;
  bookTitle: string;
  heading: string;
  paragraphs: readonly string[];
  images?: readonly string[];
  pageImage?: string;
  attribution?: string;
}

export type GrimoirePage =
  | { kind: 'title'; pageNumber: number }
  | { kind: 'ancestor-note'; pageNumber: number }
  | { kind: 'ancestor-prose'; pageNumber: number }
  | { kind: 'framing'; pageNumber: number }
  | { kind: 'overview'; pageNumber: number }
  | { kind: 'toc'; pageNumber: number; entries: TocEntry[] }
  | { kind: 'book-index'; pageNumber: number; entries: TocEntry[] }
  | ({ kind: 'collection-sample'; pageNumber: number } & CollectionContentFields)
  | {
      kind: 'framing-full';
      pageNumber: number;
      paragraphs: readonly string[];
    }
  | { kind: 'about'; pageNumber: number }
  | { kind: 'index'; pageNumber: number; targetPage: number }
  | GrimoireHerbPageData
  | {
      kind: 'edition-page';
      pageNumber: number;
      /** 1-based page within the 333-page family edition. */
      editionPageNumber: number;
      part: string;
      partTitle: string;
      heading: string;
      paragraphs: readonly string[];
    }
  | {
      kind: 'original-lesson';
      pageNumber: number;
      heading: string;
      paragraphs: readonly string[];
    }
  | ({
      kind: 'collection-page';
      pageNumber: number;
      /** 1-based page within the collected book itself. */
      bookPageNumber: number;
    } & CollectionContentFields)
  | { kind: 'colophon'; pageNumber: number };

/* ------------------------------------------------------------------ */
/* Server-side gating (Stage 2 mechanism, unchanged; boundary moved   */
/* to the owner's 16-page preview, 2026-10-21).                        */
/*                                                                    */
/* FREE_PREVIEW = the first 16 composed pages. Pages 17+ are          */
/* members-only: the SERVER replaces them with a locked placeholder   */
/* carrying ONLY non-content metadata — page number, kind, and a      */
/* label that already appears in the free TOC/index (herb name, book  */
/* title, or section title). Body text of a locked page never leaves  */
/* the server (tests assert this on the serialized payload, and on    */
/* the entitled payload for held content).                            */
/* ------------------------------------------------------------------ */

export const FREE_PREVIEW_LAST_PAGE = 16;

export interface GrimoireLockedPage {
  kind: 'locked';
  pageNumber: number;
  /** Kind of the underlying page. */
  lockedKind: GrimoirePage['kind'];
  /** Herb name — only where it already appears in the free index. */
  herbName?: string;
  /** Collected-work title — already in the free TOC/index. */
  bookTitle?: string;
  /** Section/part title — already in the free TOC/index. */
  sectionLabel?: string;
}

export type GrimoireDisplayPage = GrimoirePage | GrimoireLockedPage;

export function lockedPageFor(page: GrimoirePage): GrimoireLockedPage {
  if (page.kind === 'herb') {
    return {
      kind: 'locked',
      pageNumber: page.pageNumber,
      lockedKind: 'herb',
      herbName: page.herb.name,
    };
  }
  if (page.kind === 'collection-sample' || page.kind === 'collection-page') {
    return {
      kind: 'locked',
      pageNumber: page.pageNumber,
      lockedKind: page.kind,
      bookTitle: page.bookTitle,
    };
  }
  if (page.kind === 'edition-page') {
    return {
      kind: 'locked',
      pageNumber: page.pageNumber,
      lockedKind: page.kind,
      sectionLabel: `Part ${page.part} — ${page.partTitle}`,
    };
  }
  if (page.kind === 'original-lesson') {
    return {
      kind: 'locked',
      pageNumber: page.pageNumber,
      lockedKind: page.kind,
      sectionLabel: page.heading,
    };
  }
  return {
    kind: 'locked',
    pageNumber: page.pageNumber,
    lockedKind: page.kind,
  };
}

/**
 * The payload the server may hand the client reader for a viewer:
 * entitled viewers get every page in full; everyone else gets pages
 * 1–16 in full and locked placeholders for 17+.
 */
export function displayPagesFor(
  pages: GrimoirePage[],
  entitled: boolean,
): GrimoireDisplayPage[] {
  if (entitled) return pages;
  return pages.map((p) =>
    p.pageNumber <= FREE_PREVIEW_LAST_PAGE ? p : lockedPageFor(p),
  );
}

export function displayPageTitle(page: GrimoireDisplayPage): string {
  if (page.kind === 'locked') {
    return page.herbName ?? page.bookTitle ?? page.sectionLabel ?? 'Locked page';
  }
  return pageTitle(page);
}

/** Allies: fellow volume-one herbs sharing a category (never self). */
function alliesFor(slug: string, categories: readonly string[]): string[] {
  return GRIMOIRE_HERB_ORDER.filter(
    (other) =>
      other !== slug &&
      getHerb(other)?.categories.some((c) => categories.includes(c)),
  ).slice(0, 3);
}

export function pageTitle(page: GrimoirePage): string {
  switch (page.kind) {
    case 'title':
      return GRIMOIRE_TITLE;
    case 'ancestor-note':
    case 'ancestor-prose':
      return "The Ancestor's Note";
    case 'framing':
      return GRIMOIRE_TEASER_HEADING;
    case 'overview':
      return 'About this Book';
    case 'toc':
      return 'Table of Contents';
    case 'book-index':
      return 'Index of the Full Book';
    case 'collection-sample':
    case 'collection-page':
      return page.bookTitle;
    case 'framing-full':
      return 'What a True Grimoire Is';
    case 'about':
      return 'How to read this grimoire';
    case 'index':
      return 'Consult the Index';
    case 'herb':
      return page.herb.name;
    case 'edition-page':
      return page.heading;
    case 'original-lesson':
      return page.heading;
    case 'colophon':
      return 'Colophon';
  }
}

export function herbDisplayName(slug: string): string {
  return getHerb(slug)?.name ?? slug;
}

export interface IndexConcern {
  concern: string;
  keywords: string[];
  herbs: GrimoireHerbSlug[];
}

/** In-book concern index: concern → volume-one herbs. Its jumps land
 *  on the family edition's Herbal Allies part (see buildGrimoirePages). */
export const GRIMOIRE_INDEX: IndexConcern[] = [
  {
    concern: 'Sleep & Rest',
    keywords: ['sleep', 'insomnia', 'rest', 'bedtime', 'restless', 'tired'],
    herbs: ['valerian', 'passionflower', 'chamomile', 'lavender', 'lemon-balm'],
  },
  {
    concern: 'Calm & Anxiety',
    keywords: ['anxiety', 'anxious', 'calm', 'nerves', 'nervous', 'worry'],
    herbs: ['lavender', 'passionflower', 'chamomile', 'lemon-balm', 'ashwagandha'],
  },
  {
    concern: 'Stress & Resilience',
    keywords: ['stress', 'cortisol', 'burnout', 'overwhelm', 'adaptogen'],
    herbs: ['ashwagandha', 'lemon-balm', 'chamomile'],
  },
  {
    concern: 'Immune Defense',
    keywords: ['immune', 'immunity', 'cold', 'flu', 'virus', 'illness', 'sick'],
    herbs: ['echinacea', 'elderberry'],
  },
  {
    concern: 'Digestion',
    keywords: ['digestion', 'digestive', 'stomach', 'nausea', 'bloat', 'gut'],
    herbs: ['peppermint', 'ginger', 'chamomile'],
  },
  {
    concern: 'Pain & Inflammation',
    keywords: ['pain', 'inflammation', 'joint', 'arthritis', 'headache', 'ache'],
    herbs: ['turmeric', 'ginger', 'peppermint'],
  },
  {
    concern: 'Skin & Beauty',
    keywords: ['skin', 'beauty', 'rosacea', 'glow', 'redness', 'complexion'],
    herbs: ['rose', 'turmeric', 'chamomile'],
  },
  {
    concern: 'Heart & Spirit',
    keywords: ['grief', 'heart', 'ritual', 'spirit', 'mood', 'emotional'],
    herbs: ['rose', 'lavender', 'lemon-balm'],
  },
  {
    concern: 'Energy & Focus',
    keywords: ['energy', 'focus', 'fatigue', 'alertness', 'tired', 'vitality'],
    herbs: ['ginger', 'peppermint', 'ashwagandha'],
  },
];

/** All herb slugs referenced by every herb-data consumer (for tests). */
export function allGrimoireHerbSlugs(): readonly string[] {
  return HERBS.map((h) => h.id);
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

function partForEditionPage(
  parts: readonly EditionPart[],
  editionPageNumber: number,
): EditionPart {
  for (const part of parts) {
    if (
      editionPageNumber >= part.startPage &&
      editionPageNumber < part.startPage + part.pageCount
    ) {
      return part;
    }
  }
  throw new Error(
    `Grimoire content: edition page ${editionPageNumber} is in no part`,
  );
}

function contentFields(
  meta: CollectionBookMeta,
  src: BookPageContent,
  attribution?: string,
): CollectionContentFields {
  const fields: CollectionContentFields = {
    bookId: meta.id,
    bookTitle: meta.title,
    heading: src.heading,
    paragraphs: src.paragraphs,
  };
  if (src.images?.length) fields.images = src.images;
  if (src.pageImage) fields.pageImage = src.pageImage;
  if (attribution) fields.attribution = attribution;
  return fields;
}

/**
 * Compose the full book. The manifest carries the assembly model
 * (order, counts, rights); `content` carries the actual pages
 * (server-loaded, validated against the manifest). Held books are
 * never read from `content` — they exist in no data file — and
 * appear only as rights-pending TOC/index lines. Throws on any
 * inconsistency (fail closed).
 */
export function buildGrimoirePages(
  manifest: EditionManifest,
  content: GrimoireBookContent,
): GrimoirePage[] {
  const pages: GrimoirePage[] = [];
  let n = 0;
  const next = () => ++n;
  const publishable = publishableBooks(manifest);
  const held = manifest.collectionBooks.filter((b) => b.held);

  /* ---- free preview front (composed pp. 1–7) ---- */
  pages.push({ kind: 'title', pageNumber: next() });
  pages.push({ kind: 'ancestor-note', pageNumber: next() });
  pages.push({ kind: 'ancestor-prose', pageNumber: next() });
  pages.push({ kind: 'framing', pageNumber: next() });
  pages.push({ kind: 'overview', pageNumber: next() });
  const tocSlot = next();
  pages.push({ kind: 'toc', pageNumber: tocSlot, entries: [] });
  const indexSlot = next();
  pages.push({ kind: 'book-index', pageNumber: indexSlot, entries: [] });

  /* ---- samples: one page from each publishable book (pp. 8–16) ---- */
  const samplePages = new Map<string, number>();
  for (const meta of publishable) {
    const bookPages = content.books[meta.id];
    if (!bookPages) {
      throw new Error(`Grimoire content: missing book "${meta.id}"`);
    }
    const src = bookPages[meta.sampleSourcePage - 1];
    if (!src) {
      throw new Error(
        `Grimoire content: "${meta.id}" has no sample source page ${meta.sampleSourcePage}`,
      );
    }
    const fields = contentFields(meta, src, meta.attribution);
    if (meta.cover) {
      fields.images = [meta.cover, ...(fields.images ?? [])];
    }
    const pageNumber = next();
    samplePages.set(meta.id, pageNumber);
    pages.push({ kind: 'collection-sample', pageNumber, ...fields });
  }

  /* ---- gated body ---- */
  const framingFullStart = n + 1;
  for (const paragraphs of content.framingFullPages) {
    pages.push({ kind: 'framing-full', pageNumber: next(), paragraphs });
  }
  const aboutPage = next();
  pages.push({ kind: 'about', pageNumber: aboutPage });
  const concernIndexSlot = next();
  pages.push({ kind: 'index', pageNumber: concernIndexSlot, targetPage: 0 });

  const familyStart = n + 1;
  content.familyPages.forEach((src, i) => {
    const editionPageNumber = i + 1;
    const part = partForEditionPage(manifest.parts333, editionPageNumber);
    pages.push({
      kind: 'edition-page',
      pageNumber: next(),
      editionPageNumber,
      part: part.part,
      partTitle: part.title,
      heading: src.heading,
      paragraphs: src.paragraphs,
    });
  });
  const familyEnd = n;

  const sigilPage = next();
  pages.push({
    kind: 'original-lesson',
    pageNumber: sigilPage,
    heading: content.sigilLesson.heading,
    paragraphs: content.sigilLesson.paragraphs,
  });

  const bookRanges = new Map<string, { start: number; end: number }>();
  for (const meta of publishable) {
    const bookPages = content.books[meta.id];
    const start = n + 1;
    bookPages.forEach((src, i) => {
      pages.push({
        kind: 'collection-page',
        pageNumber: next(),
        bookPageNumber: i + 1,
        ...contentFields(meta, src, i === 0 ? meta.attribution : undefined),
      });
    });
    bookRanges.set(meta.id, { start, end: n });
  }

  const colophonPage = next();
  pages.push({ kind: 'colophon', pageNumber: colophonPage });

  /* ---- concern index target: the Herbal Allies part opening ---- */
  const herbalAllies = manifest.parts333.find((p) => p.part === 'III');
  if (!herbalAllies) throw new Error('Grimoire content: Part III missing');
  const concernIndex = pages[concernIndexSlot - 1];
  if (concernIndex.kind === 'index') {
    concernIndex.targetPage = familyStart + herbalAllies.startPage - 1;
  }

  /* ---- generated TOC + index (positions now known) ---- */
  const partRange = (part: EditionPart) => ({
    start: familyStart + part.startPage - 1,
    end: familyStart + part.startPage + part.pageCount - 2,
  });

  const tocEntries: TocEntry[] = [
    { label: 'Cover & Title', detail: 'page 1' },
    { label: "The Ancestor's Note — T.H. Arthur", detail: 'pages 2–3' },
    { label: GRIMOIRE_TEASER_HEADING, detail: 'page 4' },
    { label: 'About this Book — the Overview', detail: 'page 5' },
    { label: 'Table of Contents', detail: 'page 6' },
    { label: 'Index of the Full Book', detail: 'page 7' },
  ];
  for (const meta of publishable) {
    tocEntries.push({
      label: `A taste of — ${meta.title}`,
      detail: `page ${samplePages.get(meta.id)}`,
    });
  }
  tocEntries.push(
    {
      label: 'What a True Grimoire Is — the full version',
      detail: `pages ${framingFullStart}–${framingFullStart + content.framingFullPages.length - 1}`,
    },
    { label: 'How to Read this Grimoire', detail: `page ${aboutPage}` },
    { label: 'Consult the Index', detail: `page ${concernIndexSlot}` },
    {
      label: 'The Grimoire of Remembered Light — the family edition, complete',
      detail: `pages ${familyStart}–${familyEnd} · the 333-page edition in full`,
    },
  );
  for (const part of manifest.parts333) {
    const r = partRange(part);
    tocEntries.push({
      label: `Part ${part.part} — ${part.title}`,
      detail:
        `pages ${r.start}–${r.end} · edition pages ` +
        `${part.startPage}–${part.startPage + part.pageCount - 1}`,
    });
  }
  tocEntries.push({
    label: `${content.sigilLesson.heading} — an original lesson`,
    detail: `page ${sigilPage}`,
  });
  for (const meta of publishable) {
    const r = bookRanges.get(meta.id);
    if (!r) throw new Error(`Grimoire content: no range for "${meta.id}"`);
    tocEntries.push({
      label: meta.title,
      detail: `in full — pages ${r.start}–${r.end}`,
    });
  }
  for (const meta of held) {
    tocEntries.push({
      label: meta.title,
      detail: 'rights pending — not yet available',
    });
  }
  tocEntries.push({ label: 'Colophon', detail: `page ${colophonPage}` });

  const indexEntries: TocEntry[] = [];
  for (const part of manifest.parts333) {
    const r = partRange(part);
    indexEntries.push({
      label: `Part ${part.part} — ${part.title}`,
      detail:
        `family edition, ${part.pageCount} pages · this volume, ` +
        `pages ${r.start}–${r.end}`,
    });
  }
  indexEntries.push({
    label: content.sigilLesson.heading,
    detail: `an original Living Grimoire lesson · page ${sigilPage}`,
  });
  for (const meta of publishable) {
    const r = bookRanges.get(meta.id);
    if (!r) throw new Error(`Grimoire content: no range for "${meta.id}"`);
    indexEntries.push({
      label: meta.title,
      detail: `${meta.indexLine} · this volume, pages ${r.start}–${r.end}`,
    });
  }
  for (const meta of held) {
    indexEntries.push({
      label: meta.title,
      detail: 'rights pending — not yet available',
    });
  }
  for (const work of COVER_ONLY_WORKS) {
    indexEntries.push({ label: work.title, detail: work.note });
  }

  const toc = pages[tocSlot - 1];
  if (toc.kind === 'toc') toc.entries = tocEntries;
  const bookIndex = pages[indexSlot - 1];
  if (bookIndex.kind === 'book-index') bookIndex.entries = indexEntries;

  if (pages.length !== composedPageCount(manifest)) {
    throw new Error(
      `Grimoire content: composed ${pages.length} pages, manifest model says ${composedPageCount(manifest)}`,
    );
  }
  return pages;
}

/** Default-manifest convenience for tests and metadata consumers. */
export function buildDefaultGrimoirePages(
  content: GrimoireBookContent,
): GrimoirePage[] {
  return buildGrimoirePages(getEditionManifest(), content);
}

/* ------------------------------------------------------------------ */
/* Owner copy (2026-10-21) — VERBATIM, never paraphrase or edit.       */
/*                                                                    */
/* Sources:                                                            */
/* - grimoire-book-overview-th-arthur-2026-10-21.md — the "Overview"  */
/*   of "Grimoire of the Ancient Witchcraft" and the ancestor's note  */
/*   by T.H. Arthur. OVERVIEW = the free preview's About-this-Book    */
/*   page and "about this book" on teaser/subscribe surfaces; the    */
/*   ancestor's OPENING PARAGRAPH is the primary teaser pull-quote;   */
/*   the ancestor's FULL note (quoted note + the owner's closing      */
/*   prose) opens the book, preview pp. 2–3.                          */
/* - grimoire-what-a-true-grimoire-is-2026-10-21.md — the TEASER      */
/*   framing (preview p. 4) and the FULL version (gated front         */
/*   matter, composed pp. 17–18, below).                              */
/* No imagery: owner heirloom pictures are pending; never substitute  */
/* generated imagery.                                                 */
/* ------------------------------------------------------------------ */

export const ANCESTOR_PULL_QUOTE =
  'In the dim light of twilight, when the veil between worlds is thinnest, I, the last heir of an ancient lineage of witches, pen these sacred arts. This tome holds millennia of wisdom and spells passed through generations, a legacy that has shaped our reality. I write with reverence for those who walked this path before me.';

export const ANCESTOR_PULL_QUOTE_ATTRIBUTION = '— T.H. Arthur';

/**
 * The ancestor's FULL note — VERBATIM (owner file
 * grimoire-book-overview-th-arthur-2026-10-21.md, "The ancestor's
 * note"). The quoted note renders on preview p. 2; the owner's prose
 * closing the section renders on preview p. 3.
 */
export const ANCESTOR_NOTE_QUOTE_PARAGRAPHS: readonly string[] = [
  ANCESTOR_PULL_QUOTE,
  'The secrets here are not mere rituals but the essence of a craft that binds us to nature and the universe. To those who explore these pages, I offer caution: respect the craft, honor the spirits, and let your intentions be pure.',
];

export const ANCESTOR_NOTE_ATTRIBUTION = '-T.H. Arthur-';

export const ANCESTOR_NOTE_PROSE_PARAGRAPHS: readonly string[] = [
  'The last note was made by an ancestor when he put together all the knowledge he has from his family into a book that has been in my family for as long as I can remember. It has been passed down from generation to generation, and today, it stands as nothing more than a remnant of the past, which I hope will not be lost. That is why I have taken on the task of rewriting and editing it, so that it may endure for future generations.',
  'In sharing this knowledge, I am breaking the ancient covenant of secrecy that has protected our craft from the eyes of the uninitiated. Yet, it is my hope that by unveiling these mysteries, I will ensure the survival of our ancient traditions.',
];

export const GRIMOIRE_OVERVIEW_PARAGRAPHS: readonly string[] = [
  'Step into the mysterious and enchanting world of ancient witchcraft with this powerful tome, a transcription of a book that has passed through the hands of generations in one family. Originally written by druids and ancient practitioners, this sacred text has been faithfully preserved and transcribed, offering modern readers an authentic glimpse into the timeless art of witchcraft as it was practiced centuries ago.',
  'In "Grimoire of the Ancient Witchcraft," you will discover a profound connection to the roots of magical practice:',
];

export const GRIMOIRE_OVERVIEW_ITEMS: readonly string[] = [
  'A detailed guide to the correct and respectful practice of witchcraft, deeply rooted in the natural world and the elements.',
  'An extensive section dedicated to "The Wizard\'s Inventory," which dives into the use and understanding of magical tools, sacred minerals, and ritual incenses.',
  'The ancient knowledge of herbs and plants, offering detailed descriptions on how to gather and utilize them for spells, healing, and protection, all according to the ancient traditions, with an herbolary description of a list of herbs and their use.',
  "A carefully curated collection of rituals that have been passed down from generation to generation, this book offers a rich compilation of magical practices designed to aid you in your journey—whether you're seeking protection, prosperity, healing, or a deeper connection with the unseen forces of nature.",
  "A list of spells for every conceivable situation, each one enriched over generations with the accumulated wisdom and experiences of those who have walked this path before. From protection to prosperity, healing to love, these spells have been carefully preserved and expanded by each passing generation, ensuring a vast trove of magical knowledge to guide and empower you through life's many challenges.",
];

export const GRIMOIRE_OVERVIEW_CLOSING =
  'Unlock the secrets of the past and immerse yourself in the pure, unaltered magic of the ancient craft. Whether you are a seasoned practitioner or just beginning your journey, "Grimoire of Ancient Witchcraft" will serve as a guide, providing the wisdom and power of the ages for all who dare to open its pages.';

export const GRIMOIRE_TEASER_HEADING = 'What is a true grimoire?';

export const GRIMOIRE_TEASER_PARAGRAPHS: readonly string[] = [
  "A true grimoire was never just a book of spells. It was a family's memory written down — remedies and rituals, planting seasons and prayers, births, deaths, and everything the household knew about staying alive and staying whole. Kept by hand. Copied by hand. Hidden when it had to be.",
  'For centuries, the powerful tried to erase them. Grimoires were condemned from pulpits, burned in public squares, and named forbidden — because a family that keeps its own knowledge cannot be made to forget who it is.',
  'They failed. The real ones survived the way heirlooms survive: passed from hand to hand, mother to daughter, keeper to keeper — protected in kitchens, gardens, floorboards, and memory, generation after generation.',
  'This Living Grimoire is kept in that same spirit: a protected heirloom for a digital age, guarded page by page, and opened only to its keepers.',
];

