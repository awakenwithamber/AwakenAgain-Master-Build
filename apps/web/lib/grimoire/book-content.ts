/**
 * Grimoire book CONTENT — SERVER-ONLY (ingestion follow-on, 2026-10-21).
 *
 * Loads the generated page-content data (data/grimoire/*.json at the
 * repo root — server-only: outside the app/lib/components source
 * trees and never web-served, produced by
 * scripts/build-grimoire-book-data.mjs from the owner's assembly
 * package) and validates it against the edition manifest
 * (lib/grimoire/manifest.ts): every publishable book must be present
 * with exactly its measured page count, and the family edition must
 * be complete at 333 pages — any mismatch throws (fail closed rather
 * than serving a silently truncated book).
 *
 * NEVER import this module from a client component: the full text of
 * the gated book must never enter a client bundle. Client-shared code
 * (components/grimoire/grimoireContent.ts) may import only its TYPES.
 * A source-scan test enforces this boundary.
 *
 * RIGHTS HOLD: there is deliberately NO import for The Black Books
 * of Elverum — its content exists in no data file, so no payload
 * (free, entitled, or otherwise) can ever contain its text.
 */
import {
  getEditionManifest,
  publishableBooks,
  type CollectionBookMeta,
} from './manifest';
import familyEditionData from '../../data/grimoire/family-edition.json';
import sigilLessonData from '../../data/grimoire/sigil-lesson.json';
import framingFullData from '../../data/grimoire/framing-full.json';
import emeraldTabletData from '../../data/grimoire/emerald-tablet-of-hermes.json';
import bookOfRazielData from '../../data/grimoire/book-of-raziel.json';
import albertusMagnusData from '../../data/grimoire/albertus-magnus-egyptian-secrets.json';
import grimoriumVerumData from '../../data/grimoire/grimorium-verum.json';
import powWowsData from '../../data/grimoire/pow-wows-long-lost-friend.json';
import sepherSephirothData from '../../data/grimoire/sepher-sephiroth.json';
import ceremonialMagicData from '../../data/grimoire/book-of-ceremonial-magic-waite-1913.json';
import irishWitchcraftData from '../../data/grimoire/irish-witchcraft-and-demonology.json';
import forbiddenKnowledgeData from '../../data/grimoire/book-of-forbidden-knowledge.json';

/** One page of book content, as extracted (never invented). */
export interface BookPageContent {
  heading: string;
  paragraphs: string[];
  /** Wired illustration paths (public/), in page order. */
  images?: string[];
  /** Full-page facsimile render (public path) for page-image books. */
  pageImage?: string;
}

export interface GrimoireBookContent {
  /** The family edition's 333 pages, in order. */
  familyPages: readonly BookPageContent[];
  /** Publishable collected works by slug. Held books are ABSENT. */
  books: Readonly<Record<string, readonly BookPageContent[]>>;
  /** The original sigil-making lesson (Grimoire-original content). */
  sigilLesson: { heading: string; paragraphs: string[] };
  /**
   * The framing essay's FULL version (verbatim owner copy), as an
   * array of gated pages — server-side ONLY: it must never become a
   * client-shared constant, or the gated text would ship in the
   * client bundle (the payload tests assert its absence).
   */
  framingFullPages: readonly (readonly string[])[];
}

interface BookDataFile {
  pages: BookPageContent[];
}

const BOOK_DATA: Readonly<Record<string, BookDataFile>> = {
  'emerald-tablet-of-hermes': emeraldTabletData as BookDataFile,
  'book-of-raziel': bookOfRazielData as BookDataFile,
  'albertus-magnus-egyptian-secrets': albertusMagnusData as BookDataFile,
  'grimorium-verum': grimoriumVerumData as BookDataFile,
  'pow-wows-long-lost-friend': powWowsData as BookDataFile,
  'sepher-sephiroth': sepherSephirothData as BookDataFile,
  'book-of-ceremonial-magic-waite-1913': ceremonialMagicData as BookDataFile,
  'irish-witchcraft-and-demonology': irishWitchcraftData as BookDataFile,
  'book-of-forbidden-knowledge': forbiddenKnowledgeData as BookDataFile,
};

function validatedPages(meta: CollectionBookMeta): readonly BookPageContent[] {
  const data = BOOK_DATA[meta.id];
  if (!data) {
    throw new Error(
      `Grimoire content: no data loaded for publishable book "${meta.id}"`,
    );
  }
  if (data.pages.length !== meta.pageCount) {
    throw new Error(
      `Grimoire content: "${meta.id}" has ${data.pages.length} pages, manifest says ${meta.pageCount}`,
    );
  }
  return data.pages;
}

/**
 * The full book content, validated against the manifest. Throws on
 * any mismatch — the /grimoire route fails closed rather than serving
 * a partial book.
 */
export function getBookContent(): GrimoireBookContent {
  const manifest = getEditionManifest();
  const familyPages = (familyEditionData as BookDataFile).pages;
  if (familyPages.length !== manifest.familyPageCount) {
    throw new Error(
      `Grimoire content: family edition has ${familyPages.length} pages, manifest says ${manifest.familyPageCount}`,
    );
  }
  const books: Record<string, readonly BookPageContent[]> = {};
  for (const meta of publishableBooks(manifest)) {
    books[meta.id] = validatedPages(meta);
  }
  const framingFullPages = (framingFullData as { pages: string[][] }).pages;
  if (framingFullPages.length !== 2) {
    throw new Error(
      `Grimoire content: framing FULL version has ${framingFullPages.length} pages, expected 2`,
    );
  }
  return {
    familyPages,
    books,
    sigilLesson: sigilLessonData as { heading: string; paragraphs: string[] },
    framingFullPages,
  };
}
