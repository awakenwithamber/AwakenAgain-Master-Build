'use client';

/**
 * WORKSTREAM D — <GrimoireBook>.
 *
 * A leather-bound, handmade-book rendering of the Living Grimoire:
 * parchment pages, calligraphic display text (Tangerine, self-hosted)
 * with EB Garamond reading text, 3D page-turn animation (~600ms),
 * edge tap zones + arrows + keyboard + swipe.
 *
 * Desktop (≥900px): two-page spread, turns advance 2 pages.
 * Mobile: single page, turns advance 1 page.
 *
 * Content comes from ./grimoireContent (real catalog text — never invented).
 * Does NOT touch the /grimoire/subscribe route or globals.css.
 *
 * PROJECT 1 FIX (2026-10-20): pages carry an internal scroll region
 * (.pageScroll) so long entries scroll inside the page; a touch turns a
 * page only when ./pageTurnGesture classifies it as an unmistakable
 * horizontal swipe — vertical scrolling never turns a page. Each page's
 * scroll position is remembered and restored when the reader returns.
 * Turn zones are the bottom page corners only, not full-height edges.
 *
 * COVER OVERHAUL (2026-11-09, owner directive): the cover is PURE ART —
 * a photorealistic centuries-old handmade leather book whose title is
 * tooled into the artwork itself ("The Living Grimoire — The Collective
 * Works of Light Magic & Lost Knowledge"). No text is overlaid on the
 * book and no heading repeats the title above it. Below the book sit
 * the tagline and a pulsing "✦ Click to enter ✦" prompt; tapping the
 * book itself also enters.
 *
 * READER FIX (2026-11-09, owner correction the same day): the shipped
 * cinematic entry (table-scene beat → zoom) "does not seem to work" on
 * her phone, so it is GONE — tapping the cover opens the book directly
 * and immediately. The book opens onto reader-level FRONT PAGES that
 * are NOT part of the composed 1,051-page pagination: first the
 * INTRODUCTION page (owner's words, verbatim), then a CONTENTS page
 * derived entirely from the composed book's own generated table of
 * contents (tap a section to jump to it), then composed page 1.
 * Turning back from page 1 returns through Contents to Introduction.
 * Navigation is the plain way it worked before the overhaul: brass
 * arrows under the book, swipe, keys, bottom-corner tap zones — and
 * one quiet line of instruction under the arrows. No tutorial
 * overlays.
 *
 * IMMERSIVE READER (2026-11-09, owner directive 17:06 MST — this
 * supersedes the reader fix's direct entry): tapping the cover now
 * plays the owner's approved opening animation (the Grimoire on
 * royal purple velvet, its cover lifting, the view drawing into the
 * pages) as the book's DOORWAY, then hands off — event-driven only
 * (the film's end, a skip, or a failure) — into this same reader on
 * the Introduction. The failed sequence's lessons are binding: no
 * timer stages the entry, controls are never dead (a skip is
 * visible from the first frame, and tapping the film skips), every
 * failure opens the book (fail-open), and reduced motion bypasses
 * the film entirely. Page turns now also flip the front pages and
 * Contents jumps, and a turn never swallows input — navigation
 * during a turn coalesces to the newest target. Typography:
 * Tangerine for the book's display hand, EB Garamond for
 * extended-reading body text — chosen from rendered comparisons
 * (see the stage report); the arrangement is the owner's to
 * confirm or flip.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import styles from './grimoire.module.css';
import { HerbChip } from '../herbs/HerbChip';
import {
  GRIMOIRE_INDEX,
  GRIMOIRE_TITLE,
  PARACELSUS_QUOTE,
  EVIDENCE_FOOTNOTE,
  ANCESTOR_NOTE_ATTRIBUTION,
  ANCESTOR_NOTE_PROSE_PARAGRAPHS,
  ANCESTOR_NOTE_QUOTE_PARAGRAPHS,
  ANCESTOR_PULL_QUOTE,
  ANCESTOR_PULL_QUOTE_ATTRIBUTION,
  GRIMOIRE_OVERVIEW_CLOSING,
  GRIMOIRE_OVERVIEW_ITEMS,
  GRIMOIRE_OVERVIEW_PARAGRAPHS,
  GRIMOIRE_TEASER_HEADING,
  GRIMOIRE_TEASER_PARAGRAPHS,
  categoryLabel,
  displayPageTitle,
  FREE_PREVIEW_LAST_PAGE,
  frontContentsEntries,
  herbDisplayName,
  type FrontContentsEntry,
  type GrimoireDisplayPage,
  type GrimoireLockedPage,
  type GrimoirePage,
} from './grimoireContent';
import {
  clampNavigationTarget,
  lastSpreadBase,
  sheetPageIndices,
  spreadBaseFor,
} from './grimoirePagination';
import { classifyPageTurnGesture } from './pageTurnGesture';

const DESKTOP_QUERY = '(min-width: 900px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TURN_MS = 600;
/** JS lockout matching the CSS 0.01s animation under reduced motion. */
const TURN_MS_REDUCED = 10;

interface TurnState {
  dir: 'fwd' | 'back';
  from: number;
  to: number;
}

/** A front page of the book, or the composed book itself. */
type FrontView = 'intro' | 'contents' | 'book';

/**
 * A page turn that involves the front pages (immersive reader,
 * 2026-11-09): Introduction ↔ Contents, Contents → a composed page
 * (Contents jumps included), or composed page 1 → Contents. The
 * destination state lands at once — exactly as with composed turns —
 * and the sheet carries the eye across.
 */
interface FrontTurnState {
  dir: 'fwd' | 'back';
  from: FrontView;
  to: FrontView;
  /** Composed page index the flip lands on when `to` is the book. */
  landPage: number;
}

/** A navigation intent named while a front turn is flying. */
type FrontIntent = 'next' | 'prev' | { jump: number };

/* ------------------------------------------------------------------ */
/* Page renderers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Per-page scroll positions (pageNumber → scrollTop), shared by every
 * PageShell in the book so a reader who turns away from a half-read page
 * returns to where they left off. Session-only, in-memory by design.
 */
const ScrollMemoryContext = createContext<Map<number, number>>(new Map());

/**
 * Per-viewer watermark (Stage 2): the entitled viewer's own email,
 * rendered subtly on gated pages (17+) they are entitled to read.
 * Null for anonymous/preview viewers — locked placeholders carry none.
 */
const WatermarkContext = createContext<string | null>(null);

function PageShell({
  page,
  side,
  children,
}: {
  page: GrimoireDisplayPage;
  side: 'left' | 'right';
  children: React.ReactNode;
}) {
  const scrollMemory = useContext(ScrollMemoryContext);
  const watermarkEmail = useContext(WatermarkContext);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* Restore this page's remembered position whenever it (re)appears. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = scrollMemory.get(page.pageNumber);
    if (typeof saved === 'number' && el.scrollTop !== saved) {
      el.scrollTop = saved;
    }
  }, [page.pageNumber, scrollMemory]);

  return (
    <div className={styles.pageSlot}>
      <div
        className={`${styles.page} ${side === 'left' ? styles.pageLeft : styles.pageRight}`}
      >
        <div
          ref={scrollRef}
          className={styles.pageScroll}
          data-grimoire-scroll=""
          tabIndex={0}
          aria-label={`Page ${page.pageNumber} — scrollable page content`}
          onScroll={(e) => {
            scrollMemory.set(page.pageNumber, e.currentTarget.scrollTop);
          }}
        >
          {children}
        </div>
        {watermarkEmail &&
        page.pageNumber > FREE_PREVIEW_LAST_PAGE &&
        page.kind !== 'locked' ? (
          <p className={styles.watermark} aria-hidden="true">
            {watermarkEmail}
          </p>
        ) : null}
        <p className={styles.pageNum} aria-hidden="true">
          · {page.pageNumber} ·
        </p>
      </div>
    </div>
  );
}

function TitlePageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ The Living Grimoire ✦</p>
      <h2 className={styles.handTitle}>{GRIMOIRE_TITLE}</h2>
      <p className={styles.quote}>“{PARACELSUS_QUOTE}”</p>
      <p className={styles.attribution}>— Paracelsus</p>
      <p className={`${styles.handBody} ${styles.dropcap}`} style={{ marginTop: '1.4em' }}>
        This is a living book of botanical wisdom — the herbs, roots, flowers,
        and fungi kept close by Amber&apos;s Alchemy Apothecary, written down
        in a living hand so their stories are never lost.
      </p>
    </PageShell>
  );
}

/**
 * The INTRODUCTION page (owner directive 2026-11-09) — the first of
 * the reader-level front pages, deliberately NOT a composed page: it
 * has no page number, no place in the 1,051-page pagination, and no
 * entitlement gate (it is front matter every visitor lands on when the
 * book opens). The text is the owner's, verbatim. Turning from it
 * (button, arrows, swipe, keys) advances to the Contents page;
 * turning back from there returns here.
 */
function IntroPageView({
  side,
  onBegin,
}: {
  side: 'left' | 'right';
  onBegin: () => void;
}) {
  return (
    <div className={styles.pageSlot}>
      <div
        className={`${styles.page} ${side === 'left' ? styles.pageLeft : styles.pageRight}`}
      >
        <div
          className={styles.pageScroll}
          data-grimoire-scroll=""
          tabIndex={0}
          aria-label="Introduction — scrollable page content"
        >
          <div className={styles.introPage}>
            <p className={styles.categoryRow}>✦ The Living Grimoire ✦</p>
            <h2 className={styles.handTitle}>Introduction</h2>
            <p className={`${styles.handBody} ${styles.dropcap}`}>
              This book was not written by one hand. It was gathered — page
              by page, book by book — from ancient grimoires, some reaching
              back as far as four thousand years. Their words have been
              translated and compiled here so they would not be lost.
            </p>
            <p className={styles.handBody}>
              Many of us come to this knowledge as orphans of it. The wisdom
              our families once carried — the spells, the rituals, the
              protections, the plant lore — was scattered, forgotten, or
              left behind along the way. This book was compiled for us: for
              those who lost that knowledge in their own families, and are
              finding their way back to it.
            </p>
            <p className={styles.handBody}>
              So read slowly, and learn deeply. And as you learn, I
              encourage you to begin a grimoire of your own — write down
              what you discover, what has helped you, and how it has shaped
              your life — so one day you can pass it on, and this knowledge
              will never be lost again.
            </p>
            <p className={styles.quote}>
              The door is open. Turn the page, and begin.
            </p>
            <p className={styles.introAdvanceRow}>
              <button
                type="button"
                className={styles.introAdvance}
                onClick={onBegin}
              >
                Turn the page to begin ✦
              </button>
            </p>
          </div>
        </div>
        <p className={styles.pageNum} aria-hidden="true">
          ✦
        </p>
      </div>
    </div>
  );
}

/**
 * The CONTENTS page (owner directive 2026-11-09) — the second
 * reader-level front page, between the Introduction and composed
 * page 1, in the same pattern as the Introduction: no page number, no
 * place in the pagination, no entitlement gate. Its entries come
 * ENTIRELY from the composed book's own generated table of contents
 * (see frontContentsEntries in ./grimoireContent) — same labels, same
 * order, each with its starting page. Tapping an entry jumps straight
 * to that section's first page; entries with no page of their own yet
 * (rights-pending works) are listed plainly and cannot be tapped. The
 * list scrolls inside the page when it overflows, like any long page
 * in this book. Turning forward enters the composed book at page 1;
 * turning back returns to the Introduction.
 */
function ContentsPageView({
  side,
  entries,
  onJump,
}: {
  side: 'left' | 'right';
  entries: FrontContentsEntry[];
  onJump: (pageIndex: number) => void;
}) {
  return (
    <div className={styles.pageSlot}>
      <div
        className={`${styles.page} ${side === 'left' ? styles.pageLeft : styles.pageRight}`}
      >
        <div
          className={styles.pageScroll}
          data-grimoire-scroll=""
          tabIndex={0}
          aria-label="Contents — scrollable page content"
        >
          <div className={styles.introPage}>
            <p className={styles.categoryRow}>✦ The Living Grimoire ✦</p>
            <h2 className={styles.handTitle}>Contents</h2>
            <p className={styles.contentsHint}>Tap a section to jump to it.</p>
            <ul className={styles.contentsList}>
              {entries.map((e) => {
                const startPage = e.startPage;
                return (
                  <li key={e.label} className={styles.contentsItem}>
                    {startPage !== null ? (
                      <button
                        type="button"
                        className={styles.contentsBtn}
                        onClick={() => onJump(startPage - 1)}
                      >
                        <span className={styles.contentsLabel}>{e.label}</span>
                        <span className={styles.contentsPage}>
                          page {startPage}
                        </span>
                      </button>
                    ) : (
                      <span className={styles.contentsStatic}>
                        <span className={styles.contentsLabel}>{e.label}</span>
                        <span className={styles.contentsPage}>{e.detail}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p className={styles.pageNum} aria-hidden="true">
          ✦
        </p>
      </div>
    </div>
  );
}

function AboutPageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <h2 className={styles.handHeading}>How to read this grimoire</h2>
      <p className={`${styles.handBody} ${styles.dropcap}`}>
        Turn these pages as you would a real book. Tap a bottom page corner,
        use the brass arrows, swipe left or right, or press your ← → keys.
        Longer entries scroll gently within their own page — scrolling never
        turns the page. Ahead lie The Grimoire of Ancient Teachings complete
        and the collected works in full; the oldest books are shown
        as facsimiles of their own printed pages, exactly as they were
        handed down.
      </p>
      <h3 className={styles.handHeading}>A note on these words</h3>
      <p className={styles.handBody}>
        The herbal wisdom here is framed as <em>traditional use</em> and early
        findings — the way herbalists have spoken of these plants for
        generations — never as proven medical claims. The collected works are
        historical texts, kept whole and unedited, as a keeper keeps them.
      </p>
      <p className={styles.handBody}>
        About this book — the Overview — stands in the front matter, ahead of
        the table of contents, together with the ancestor&apos;s note and the
        framing: {GRIMOIRE_TEASER_HEADING}
      </p>
    </PageShell>
  );
}

function AncestorNotePageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ Front Matter ✦</p>
      <h2 className={styles.handHeading}>The Ancestor&apos;s Note</h2>
      {/* VERBATIM owner content (T.H. Arthur) — never paraphrase. */}
      <p className={styles.quote}>
        “{ANCESTOR_NOTE_QUOTE_PARAGRAPHS.join(' ')}”
      </p>
      <p className={styles.attribution}>{ANCESTOR_NOTE_ATTRIBUTION}</p>
    </PageShell>
  );
}

function AncestorProsePageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ Front Matter ✦</p>
      <h2 className={styles.handHeading}>The Ancestor&apos;s Note</h2>
      {/* VERBATIM owner prose closing the ancestor's-note section
          (grimoire-book-overview-th-arthur-2026-10-21.md). This is
          the preview's 16th-page reconciliation: the note's second
          page, from the assembly front-matter budget (pp. 2–3). */}
      {ANCESTOR_NOTE_PROSE_PARAGRAPHS.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
    </PageShell>
  );
}

function OverviewPageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ Front Matter ✦</p>
      <h2 className={styles.handHeading}>About this Book</h2>
      {/* Owner copy 2026-10-21 (VERBATIM): the Overview of "Grimoire
          of the Ancient Witchcraft" — see grimoireContent.ts. */}
      {GRIMOIRE_OVERVIEW_PARAGRAPHS.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
      <ul className={styles.handList}>
        {GRIMOIRE_OVERVIEW_ITEMS.map((item) => (
          <li key={item.slice(0, 32)}>{item}</li>
        ))}
      </ul>
      <p className={styles.handBody}>{GRIMOIRE_OVERVIEW_CLOSING}</p>
      <p className={styles.quote}>“{ANCESTOR_PULL_QUOTE}”</p>
      <p className={styles.attribution}>{ANCESTOR_PULL_QUOTE_ATTRIBUTION}</p>
    </PageShell>
  );
}

function FramingFullPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'framing-full' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ Front Matter ✦</p>
      <h2 className={styles.handHeading}>What a True Grimoire Is</h2>
      {/* VERBATIM full framing version (owner, 2026-10-21) — the
          gated front matter of the full edition. */}
      {page.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
    </PageShell>
  );
}

function FramingPageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ Front Matter ✦</p>
      <h2 className={styles.handHeading}>{GRIMOIRE_TEASER_HEADING}</h2>
      {/* VERBATIM teaser framing (owner, 2026-10-21). The FULL framing
          version is reserved for the full edition's front matter. */}
      {GRIMOIRE_TEASER_PARAGRAPHS.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
    </PageShell>
  );
}

function TocPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'toc' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <h2 className={styles.handHeading}>Table of Contents</h2>
      <p className={styles.handBody}>
        The Living Grimoire — The Grimoire of Ancient Teachings
        complete, together with the collected works preserved with it.
        The book keeps growing as more works are digitized.
      </p>
      <ul className={styles.handList}>
        {page.entries.map((e) => (
          <li key={e.label}>
            {e.label} — {e.detail}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

function BookIndexPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'book-index' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <h2 className={styles.handHeading}>Index of the Full Book</h2>
      <p className={styles.handBody}>
        What the full book holds — generated from the edition manifest.
      </p>
      <ul className={styles.handList}>
        {page.entries.map((e) => (
          <li key={e.label}>
            {e.label} — {e.detail}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

function CollectionPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'collection-sample' | 'collection-page' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>
        {page.kind === 'collection-sample'
          ? `✦ A taste of — ${page.bookTitle} ✦`
          : `✦ ${page.bookTitle} ✦`}
      </p>
      <h2 className={styles.handHeading}>{page.heading}</h2>
      {page.pageImage ? (
        <img
          src={page.pageImage}
          alt={`${page.bookTitle} — facsimile of the printed page`}
          className={styles.pageImage}
          loading="lazy"
        />
      ) : null}
      {page.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
      {page.images?.map((src) => (
        <img
          key={src}
          src={src}
          alt={`${page.bookTitle} — illustration from the book`}
          className={styles.bookFigure}
          loading="lazy"
        />
      ))}
      {page.attribution ? (
        <p className={styles.footnote}>{page.attribution}</p>
      ) : null}
    </PageShell>
  );
}

function EditionPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'edition-page' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>
        ✦ The Grimoire of Ancient Teachings — Part {page.part} · {page.partTitle}{' '}
        ✦
      </p>
      <h2 className={styles.handHeading}>{page.heading}</h2>
      {page.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
      <p className={styles.footnote}>
        Edition page {page.editionPageNumber} — The Grimoire of Ancient
        Teachings, complete.
      </p>
    </PageShell>
  );
}

function OriginalLessonPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'original-lesson' }>;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>
        ✦ From the Keeper&apos;s Hand — an original lesson ✦
      </p>
      <h2 className={styles.handHeading}>{page.heading}</h2>
      {page.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
    </PageShell>
  );
}

function IndexPageView({
  page,
  side,
  query,
  setQuery,
  onJump,
}: {
  page: Extract<GrimoirePage, { kind: 'index' }>;
  side: 'left' | 'right';
  query: string;
  setQuery: (q: string) => void;
  onJump: (pageIndex: number) => void;
}) {
  const q = query.trim().toLowerCase();
  const concerns = GRIMOIRE_INDEX.filter(
    (c) =>
      !q ||
      c.concern.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q)) ||
      c.herbs.some((h) => herbDisplayName(h).toLowerCase().includes(q)),
  );
  return (
    <PageShell page={page} side={side}>
      <h2 className={styles.handHeading}>🔖 Consult the Index</h2>
      <p className={styles.handBody}>
        Name what troubles you, and the index will point to its pages.
      </p>
      <label className={styles.srOnly} htmlFor="grimoire-index-search">
        Search the index by symptom or keyword
      </label>
      <input
        id="grimoire-index-search"
        className={styles.indexSearch}
        type="search"
        placeholder="sleep, digestion, stress…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {concerns.length === 0 && (
        <p className={styles.noMatch}>
          Nothing in this volume answers to that name yet — try another word,
          or open the full Herb Index below.
        </p>
      )}
      {concerns.map((c) => (
        <div key={c.concern} className={styles.concernBlock}>
          <p className={styles.concernName}>{c.concern}</p>
          <div className={styles.concernHerbs}>
            {c.herbs.map((h) => (
              <button
                key={h}
                type="button"
                className={styles.concernHerbBtn}
                onClick={() => onJump(page.targetPage - 1)}
              >
                {herbDisplayName(h)} · Herbal Allies, p.{page.targetPage}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p style={{ marginTop: '1em' }}>
        <Link href="/herb-index" className={styles.entryLink}>
          Open the full Herb Index →
        </Link>
      </p>
    </PageShell>
  );
}

function HerbPageView({
  page,
  side,
}: {
  page: Extract<GrimoirePage, { kind: 'herb' }>;
  side: 'left' | 'right';
}) {
  const { herb, illustration, allies } = page;
  return (
    <PageShell page={page} side={side}>
      <img
        src={illustration}
        alt={`Botanical illustration of ${herb.name}`}
        className={styles.illustration}
        loading="lazy"
      />
      <h2 className={`${styles.hand} ${styles.herbName}`}>{herb.name}</h2>
      <p className={styles.latin}>{herb.latin}</p>
      <p className={styles.categoryRow}>
        {herb.categories.map(categoryLabel).join(' · ')}
      </p>
      <h3 className={styles.handHeading}>Traditional Wisdom</h3>
      <p className={`${styles.handBody} ${styles.dropcap}`}>{herb.traditionalNote}</p>
      <h3 className={styles.handHeading}>Traditional Uses & Early Evidence</h3>
      <ul className={styles.handList}>
        {herb.traditionalBenefits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {allies.length > 0 && (
        <>
          <h3 className={styles.handHeading}>Allies of this Herb</h3>
          <div className={styles.allyRow}>
            {allies.map((a) => (
              <HerbChip key={a} herb={a} />
            ))}
          </div>
        </>
      )}
      <p className={styles.footnote}>{EVIDENCE_FOOTNOTE}</p>
      <p>
        <Link href={`/herbal-library/${herb.id}`} className={styles.entryLink}>
          Read the full library entry →
        </Link>
      </p>
    </PageShell>
  );
}

function ColophonPageView({
  page,
  side,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <h2 className={styles.handHeading}>Colophon</h2>
      <p className={`${styles.handBody} ${styles.dropcap}`}>
        Here ends this volume of the Living Grimoire of Light & Magic —
        The Grimoire of Ancient Teachings complete, the
        keeper&apos;s own lessons, and the collected works in full, kept
        together as one book. The book is alive, and it will keep growing
        as more found works are digitized and verified.
      </p>
      <p className={styles.handBody}>
        Keepers of the Living Grimoire of Light & Magic receive new entries, monthly rituals,
        and subscriber gifts as the archive grows.
      </p>
      <p style={{ marginTop: '1em' }}>
        <Link href="/grimoire/subscribe" className={styles.entryLink}>
          Become a keeper — Living Grimoire of Light & Magic $7.77/mo →
        </Link>
      </p>
      <p>
        <Link href="/herb-index" className={styles.entryLink}>
          Browse the Herb Index →
        </Link>
      </p>
      <p className={styles.quote} style={{ marginTop: '1.6em' }}>
        “The art of healing comes from nature, not from the physician.”
      </p>
      <p className={styles.attribution}>— Paracelsus</p>
    </PageShell>
  );
}

function LockedPageView({
  page,
  side,
}: {
  page: GrimoireLockedPage;
  side: 'left' | 'right';
}) {
  return (
    <PageShell page={page} side={side}>
      <p className={styles.categoryRow}>✦ The Living Grimoire ✦</p>
      {page.herbName ? (
        <h2 className={`${styles.hand} ${styles.herbName}`}>{page.herbName}</h2>
      ) : page.bookTitle ? (
        <h2 className={styles.handHeading}>{page.bookTitle}</h2>
      ) : page.sectionLabel ? (
        <h2 className={styles.handHeading}>{page.sectionLabel}</h2>
      ) : page.lockedKind === 'colophon' ? (
        <h2 className={styles.handHeading}>Colophon</h2>
      ) : (
        <h2 className={styles.handHeading}>A Kept Page</h2>
      )}
      <p className={`${styles.handBody} ${styles.dropcap}`}>
        This page is kept for members of the Living Grimoire.
        Subscribers and permanent-unlock holders who have verified
        their email see it in full; everyone else sees the first seventeen
        pages freely.
      </p>
      <p className={styles.handBody}>
        Unlock it once for $8.88, or subscribe for $7.77/month — and if you
        already have access, verify your email below the book to open it.
      </p>
      <p style={{ marginTop: '1em' }}>
        <Link href="/grimoire/subscribe" className={styles.entryLink}>
          See the unlock &amp; subscription options →
        </Link>
      </p>
    </PageShell>
  );
}

function PageView({
  page,
  side,
  query,
  setQuery,
  onJump,
}: {
  page: GrimoireDisplayPage;
  side: 'left' | 'right';
  query: string;
  setQuery: (q: string) => void;
  onJump: (pageIndex: number) => void;
}) {
  if (page.kind === 'locked') {
    return <LockedPageView page={page} side={side} />;
  }
  switch (page.kind) {
    case 'ancestor-note':
      return <AncestorNotePageView page={page} side={side} />;
    case 'ancestor-prose':
      return <AncestorProsePageView page={page} side={side} />;
    case 'framing':
      return <FramingPageView page={page} side={side} />;
    case 'overview':
      return <OverviewPageView page={page} side={side} />;
    case 'toc':
      return <TocPageView page={page} side={side} />;
    case 'book-index':
      return <BookIndexPageView page={page} side={side} />;
    case 'collection-sample':
    case 'collection-page':
      return <CollectionPageView page={page} side={side} />;
    case 'framing-full':
      return <FramingFullPageView page={page} side={side} />;
    case 'edition-page':
      return <EditionPageView page={page} side={side} />;
    case 'original-lesson':
      return <OriginalLessonPageView page={page} side={side} />;
    case 'title':
      return <TitlePageView page={page} side={side} />;
    case 'about':
      return <AboutPageView page={page} side={side} />;
    case 'index':
      return (
        <IndexPageView
          page={page}
          side={side}
          query={query}
          setQuery={setQuery}
          onJump={onJump}
        />
      );
    case 'herb':
      return <HerbPageView page={page} side={side} />;
    case 'colophon':
      return <ColophonPageView page={page} side={side} />;
  }
}

/* ------------------------------------------------------------------ */
/* Book                                                                */
/* ------------------------------------------------------------------ */

export interface GrimoireBookProps {
  /**
   * Pages as resolved SERVER-SIDE (Stage 2): entitled viewers receive
   * all composed pages in full; everyone else receives pages 1–17 in full and
   * locked placeholders for 18+. This component never builds content
   * itself — gated body text is simply absent from its props.
   */
  pages: GrimoireDisplayPage[];
  /** The entitled viewer's email (their watermark); null otherwise. */
  viewerEmail?: string | null;
}

export function GrimoireBook({ pages, viewerEmail = null }: GrimoireBookProps) {
  /*
   * Entry states (immersive reader, 2026-11-09): 'closed' shows the
   * cover; 'doorway' plays the opening animation over the book;
   * 'open' is the reader itself. The doorway is exited only by
   * events — the film ending, a skip, or a failure (finishDoorway).
   */
  const [coverState, setCoverState] = useState<'closed' | 'doorway' | 'open'>('closed');
  /** The doorway film layer cross-dissolving away after the handoff. */
  const [doorwayLeaving, setDoorwayLeaving] = useState(false);
  /** The film can paint (its poster shows until then). */
  const [videoReady, setVideoReady] = useState(false);
  /*
   * The front pages (2026-11-09): an opened book lands on the
   * Introduction, turns forward to the Contents, then into the
   * composed book. Reader-level state only — `page` always indexes
   * the composed pages, so the front pages never enter the
   * pagination. null = reading the composed book itself.
   */
  const [frontPage, setFrontPage] = useState<'intro' | 'contents' | null>(
    'intro',
  );
  const atIntro = frontPage === 'intro';
  const atContents = frontPage === 'contents';
  const [isDesktop, setIsDesktop] = useState(false);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<TurnState | null>(null);
  const [frontTurn, setFrontTurn] = useState<FrontTurnState | null>(null);
  const [query, setQuery] = useState('');
  const [announce, setAnnounce] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchRef = useRef<{
    x: number;
    y: number;
    startedAt: number;
    scrollEl: HTMLElement | null;
    scrollTopAtStart: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frontTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /*
   * Navigation named while a turn is flying (immersive reader,
   * 2026-11-09): a turn must never swallow input, so the newest
   * target is kept here and the flying turn chains on to it.
   */
  const pendingTurnRef = useRef<number | null>(null);
  /** The same, for turns involving the front pages. */
  const pendingFrontRef = useRef<FrontIntent | null>(null);
  /** A jump queued behind the doorway (the ribbon's index jump). */
  const pendingAfterOpenRef = useRef<'index' | null>(null);
  /* Latest navigation callbacks, for the front-turn timer to run a
     queued intent after the sheet lands. */
  const nextRef = useRef<() => void>(() => {});
  const prevRef = useRef<() => void>(() => {});
  const jumpRef = useRef<(target: number) => void>(() => {});
  const scrollMemoryRef = useRef<Map<number, number>>(new Map());

  const turnMs = reducedMotion ? TURN_MS_REDUCED : TURN_MS;
  /* Mirrors for callbacks that must read live values without
     re-subscribing (the entry callback's shape is pinned by tests). */
  const turnMsRef = useRef(turnMs);
  turnMsRef.current = turnMs;

  const maxPage = pages.length - 1;
  const bookOpen = coverState === 'open';
  const displayPage = turn ? turn.from : page;
  const spreadBase = spreadBaseFor(displayPage, isDesktop);

  /* Contents-page entries, derived from the composed book's own TOC
     page (present in full for every viewer — it sits in the free
     preview). Recomputed only when the page payload changes. */
  const contentsEntries = frontContentsEntries(pages);

  /* Ref mirror of guard state so delayed calls (ribbon → open → jump) never
     act on a stale closure. */
  const guardRef = useRef({
    turn: null as TurnState | null,
    frontTurn: null as FrontTurnState | null,
    bookOpen: false,
    coverState: 'closed' as 'closed' | 'doorway' | 'open',
    page: 0,
    frontPage: 'intro' as 'intro' | 'contents' | null,
    isDesktop: false,
    reducedMotion: false,
  });
  guardRef.current.turn = turn;
  guardRef.current.frontTurn = frontTurn;
  guardRef.current.bookOpen = bookOpen;
  guardRef.current.coverState = coverState;
  guardRef.current.page = page;
  guardRef.current.frontPage = frontPage;
  guardRef.current.isDesktop = isDesktop;
  guardRef.current.reducedMotion = reducedMotion;

  /*
   * Which front view the spread shows. During a front turn the FROM
   * view stays under the sheet — the destination view appears as
   * the sheet lands, exactly as composed turns keep the from-spread
   * under their sheet.
   */
  const frontDisplay: FrontView = frontTurn
    ? frontTurn.from
    : frontPage === null
      ? 'book'
      : frontPage;

  /* Viewport tracking — desktop gets a two-page spread. */
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const apply = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (desktop) setPage((p) => (p % 2 === 1 ? p - 1 : p));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (frontTimer.current) clearTimeout(frontTimer.current);
    };
  }, []);

  /* Reduced-motion tracking — the JS turn lockout must shrink with the
     CSS animation, or reduced-motion readers get a 600ms dead pause. */
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /*
   * Begin a composed-page turn. When the sheet lands, a target named
   * mid-turn (pendingTurnRef) chains straight into the next turn —
   * input during a turn is never swallowed (immersive reader,
   * 2026-11-09). Reads only refs, state setters, and the stable
   * pages payload, so any render's copy of this function is safe
   * for the memoized callbacks below to call.
   */
  const beginTurn = (from: number, to: number) => {
    setTurn({ dir: to > from ? 'fwd' : 'back', from, to });
    setPage(to);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const pending = pendingTurnRef.current;
      pendingTurnRef.current = null;
      if (pending !== null && pending !== to) {
        beginTurn(to, pending);
        return;
      }
      setTurn(null);
      setAnnounce(
        `Page ${to + 1} of ${pages.length} — ${displayPageTitle(pages[to])}`,
      );
    }, turnMsRef.current);
  };

  const goTo = useCallback(
    (target: number) => {
      const g = guardRef.current;
      if (!g.bookOpen) return;
      // Desktop targets are spread bases, never a right-hand page itself:
      // targeting the final page index directly made the turn sheet read
      // pages[pages.length] (undefined) and throw. See grimoirePagination.
      const t = clampNavigationTarget(target, pages.length, isDesktop);
      if (g.frontTurn) {
        /* A front-page turn is flying: queue the jump behind it. */
        pendingFrontRef.current = { jump: t };
        return;
      }
      if (g.turn) {
        /* A turn is flying: coalesce to the newest target — the
           flying turn chains on to it when it lands. Naming the
           in-flight destination again simply settles there. */
        pendingTurnRef.current = t === g.turn.to ? null : t;
        return;
      }
      if (t === g.page) {
        /* Already on that page — but if a front page is showing, the
           navigation still means "take me into the book, here". */
        if (g.frontPage !== null) setFrontPage(null);
        return;
      }
      /* Any composed-page navigation leaves the front pages behind. */
      setFrontPage(null);
      beginTurn(g.page, t);
    },
    [isDesktop, pages],
  );

  const step = isDesktop ? 2 : 1;

  /*
   * Turn a leaf that involves the front pages (immersive reader,
   * 2026-11-09). The destination state lands at once — exactly as
   * with composed turns — and the sheet carries the eye across.
   * Whether a sheet renders at all is geometry: on mobile the
   * single page always flips; on desktop the front pages share a
   * spread whose right leaf is the flyleaf, so front-to-front turns
   * keep the front pages' own gentle fade, while turns to or from
   * the composed book flip a leaf of the spread. A navigation named
   * mid-turn is queued (pendingFrontRef) and runs as the sheet
   * lands — input is never swallowed here either.
   */
  const startFrontTurn = (ft: FrontTurnState) => {
    if (ft.to === 'book') {
      setFrontPage(null);
      setPage(ft.landPage);
    } else if (ft.to === 'contents') {
      setFrontPage('contents');
    } else {
      setFrontPage('intro');
    }
    const sheetRenders =
      !guardRef.current.isDesktop || ft.from === 'book' || ft.to === 'book';
    if (!sheetRenders) {
      if (ft.to === 'contents') {
        setAnnounce('Contents — tap a section to jump to it.');
      } else if (ft.to === 'intro') {
        setAnnounce('Introduction — turn the page to begin.');
      }
      return;
    }
    setFrontTurn(ft);
    if (frontTimer.current) clearTimeout(frontTimer.current);
    frontTimer.current = setTimeout(() => {
      setFrontTurn(null);
      if (ft.to === 'book') {
        setAnnounce(
          `Page ${ft.landPage + 1} of ${pages.length} — ${displayPageTitle(pages[ft.landPage])}`,
        );
      } else if (ft.to === 'contents') {
        setAnnounce('Contents — tap a section to jump to it.');
      } else {
        setAnnounce('Introduction — turn the page to begin.');
      }
      const pending = pendingFrontRef.current;
      pendingFrontRef.current = null;
      if (pending === 'next') nextRef.current();
      else if (pending === 'prev') prevRef.current();
      else if (pending) jumpRef.current(pending.jump);
    }, turnMsRef.current);
  };

  /*
   * Moving through the front pages: Introduction → Contents → the
   * composed book's first page — each step now turns its leaf
   * (immersive reader, 2026-11-09).
   */
  const advanceFront = useCallback(() => {
    const g = guardRef.current;
    if (g.coverState !== 'open') return;
    if (g.frontTurn) {
      pendingFrontRef.current = 'next';
      return;
    }
    if (g.frontPage === 'intro') {
      startFrontTurn({ dir: 'fwd', from: 'intro', to: 'contents', landPage: 0 });
      return;
    }
    if (g.frontPage === 'contents') {
      startFrontTurn({
        dir: 'fwd',
        from: 'contents',
        to: 'book',
        landPage: clampNavigationTarget(g.page, pages.length, isDesktop),
      });
    }
  }, [isDesktop, pages]);

  /*
   * A Contents entry tap: turn straight to that section's first
   * composed page. The leaf turns in the direction of the jump —
   * the flip belongs to this navigation too (immersive reader,
   * 2026-11-09), not only to page-by-page reading.
   */
  const jumpFromContents = useCallback(
    (target: number) => {
      const g = guardRef.current;
      if (g.coverState !== 'open') return;
      if (g.frontTurn) {
        pendingFrontRef.current = { jump: target };
        return;
      }
      const t = clampNavigationTarget(target, pages.length, isDesktop);
      startFrontTurn({
        dir: 'fwd',
        from: g.frontPage ?? 'contents',
        to: 'book',
        landPage: t,
      });
    },
    [isDesktop, pages],
  );

  const next = useCallback(() => {
    if (guardRef.current.frontTurn) {
      pendingFrontRef.current = 'next';
      return;
    }
    if (frontPage !== null) {
      advanceFront();
      return;
    }
    goTo(page + step);
  }, [advanceFront, frontPage, goTo, page, step]);

  const prev = useCallback(() => {
    if (!bookOpen) return;
    const g = guardRef.current;
    if (g.frontTurn) {
      pendingFrontRef.current = 'prev';
      return;
    }
    if (g.turn) {
      /* A composed turn is flying: coalesce like any other input. */
      goTo(page - step);
      return;
    }
    if (frontPage === 'contents') {
      /* Back from the Contents page returns to the Introduction —
         its leaf turns back, as any page's would. */
      startFrontTurn({ dir: 'back', from: 'contents', to: 'intro', landPage: 0 });
      return;
    }
    if (frontPage === 'intro') return;
    if (page <= 0) {
      /* Turning back from the first composed page returns to the
         Contents page, as turning back in a real book would. */
      startFrontTurn({ dir: 'back', from: 'book', to: 'contents', landPage: 0 });
      return;
    }
    goTo(page - step);
  }, [bookOpen, frontPage, goTo, page, step]);

  /* Keep the callback mirrors current for the front-turn timer. */
  nextRef.current = next;
  prevRef.current = prev;
  jumpRef.current = jumpFromContents;

  /*
   * Entry (owner directive 2026-11-09 17:06 MST): the cover tap
   * plays the approved opening animation as the book's doorway —
   * the film draws the visitor in, and its end hands off into the
   * open book (finishDoorway). Under reduced motion the film is
   * bypassed entirely and the book simply opens, at once, onto the
   * Introduction — the reader fix's direct entry, preserved for
   * exactly the readers it protects.
   */
  const openBook = useCallback(() => {
    if (coverState !== 'closed') return;
    if (guardRef.current.reducedMotion) {
      guardRef.current.bookOpen = true;
      setCoverState('open');
      setAnnounce('The grimoire is open. Introduction — turn the page to begin.');
      return;
    }
    setVideoReady(false);
    setCoverState('doorway');
    setAnnounce('The grimoire is opening…');
  }, [coverState]);

  /*
   * The doorway handoff — EVENT-DRIVEN only. The film's end, a tap
   * on the film, the skip control, and any load or play failure all
   * land here, and every path opens the book onto the Introduction:
   * the doorway can enhance the entrance but can never bar it
   * (fail-open). The film layer then cross-dissolves away; its own
   * transitionend unmounts it. No timer stages any of this.
   */
  const finishDoorway = useCallback(() => {
    if (guardRef.current.coverState !== 'doorway') return;
    guardRef.current.bookOpen = true;
    setCoverState('open');
    setDoorwayLeaving(true);
    setAnnounce('The grimoire is open. Introduction — turn the page to begin.');
    const intent = pendingAfterOpenRef.current;
    pendingAfterOpenRef.current = null;
    if (intent === 'index') goTo(2);
  }, [goTo]);

  /* If the film cannot even start, the book opens — fail-open. */
  useEffect(() => {
    if (coverState !== 'doorway') return;
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p) p.catch(() => finishDoorway());
  }, [coverState, finishDoorway]);

  const goToIndex = useCallback(() => {
    const g = guardRef.current;
    if (g.coverState !== 'open') {
      /* The index waits behind the doorway: queue the jump, and
         opening the book delivers it (the film's end, a skip, or —
         under reduced motion — the direct open below). */
      pendingAfterOpenRef.current = 'index';
      if (g.coverState === 'closed') {
        openBook();
        if (guardRef.current.reducedMotion) {
          pendingAfterOpenRef.current = null;
          goTo(2);
        }
      }
      return;
    }
    if (g.frontTurn) {
      pendingFrontRef.current = { jump: 2 };
      return;
    }
    if (g.frontPage !== null) {
      jumpFromContents(2);
      return;
    }
    goTo(2);
  }, [goTo, jumpFromContents, openBook]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Let focused buttons/links handle their own keys (avoids double-open).
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (coverState === 'doorway') {
      /* The doorway answers the keyboard too — any forward key or
         Escape skips straight into the book. */
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'Escape' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        finishDoorway();
      }
      return;
    }
    if (!bookOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openBook();
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(maxPage);
    }
  };

  /*
   * Touch handling (PROJECT 1 FIX): record where the touch began, which
   * scroll region it began in, and that region's scrollTop. On release,
   * the pure classifier in ./pageTurnGesture decides — and it can only
   * ever say yes to an unmistakable horizontal swipe that did not scroll
   * the page content. Vertical scrolling can never turn a page.
   */
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchRef.current = null;
      return;
    }
    const t = e.touches[0];
    const scrollEl = (e.target as HTMLElement).closest?.(
      '[data-grimoire-scroll]',
    ) as HTMLElement | null;
    touchRef.current = {
      x: t.clientX,
      y: t.clientY,
      startedAt: Date.now(),
      scrollEl,
      scrollTopAtStart: scrollEl ? scrollEl.scrollTop : 0,
    };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    /* A swipe during a turn is an intent, not an interruption: it
       reaches next()/prev(), which coalesce it (2026-11-09). */
    if (!start || !bookOpen) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const contentScrolled =
      start.scrollEl !== null &&
      start.scrollEl.scrollTop !== start.scrollTopAtStart;
    const intent = classifyPageTurnGesture({
      startX: start.x,
      startY: start.y,
      endX: t.clientX,
      endY: t.clientY,
      durationMs: Date.now() - start.startedAt,
      contentScrolled,
    });
    if (intent === 'next') next();
    else if (intent === 'prev') prev();
  };

  /*
   * Pointer handling (2026-10-30, owner directive: swipe with mouse or
   * pen as well as touch). Mouse/pen gestures run through the SAME pure
   * classifier and the SAME scroll guard as touch — a drag that scrolls
   * the page content can never turn a page. Touch pointers are left to
   * the touch handlers above (no double-firing), and a swipe that
   * begins on an interactive element (button, link, input) is left to
   * that element, mirroring the keyboard handler's guard.
   */
  const pointerRef = useRef<{
    x: number;
    y: number;
    startedAt: number;
    scrollEl: HTMLElement | null;
    scrollTopAtStart: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0) {
      pointerRef.current = null;
      return;
    }
    if ((e.target as HTMLElement).closest?.('button, a, input')) {
      pointerRef.current = null;
      return;
    }
    const scrollEl = (e.target as HTMLElement).closest?.(
      '[data-grimoire-scroll]',
    ) as HTMLElement | null;
    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      startedAt: Date.now(),
      scrollEl,
      scrollTopAtStart: scrollEl ? scrollEl.scrollTop : 0,
    };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || e.pointerType === 'touch' || !bookOpen) return;
    const contentScrolled =
      start.scrollEl !== null &&
      start.scrollEl.scrollTop !== start.scrollTopAtStart;
    const intent = classifyPageTurnGesture({
      startX: start.x,
      startY: start.y,
      endX: e.clientX,
      endY: e.clientY,
      durationMs: Date.now() - start.startedAt,
      contentScrolled,
    });
    if (intent === 'next') next();
    else if (intent === 'prev') prev();
  };

  /* Which pages are visible under the (possibly turning) sheet. */
  const leftPage = pages[spreadBase];
  const rightPage = isDesktop ? pages[spreadBase + 1] : undefined;

  /* Sheet faces for the 3D flip. */
  let sheet: React.ReactNode = null;
  if (turn && bookOpen) {
    const { dir, from, to } = turn;
    const full = !isDesktop;
    const sideClass = full
      ? `${styles.sheetFull} ${dir === 'back' ? styles.sheetFullBack : ''}`
      : dir === 'fwd'
        ? styles.sheetRight
        : styles.sheetLeft;
    const { frontIdx, backIdx } = sheetPageIndices(
      dir,
      from,
      to,
      isDesktop,
      pages.length,
    );
    const faceSide = full || dir === 'fwd' ? 'right' : 'left';
    sheet = (
      <div
        className={`${styles.sheet} ${sideClass} ${dir === 'fwd' ? styles.sheetFwd : styles.sheetBack}`}
        aria-hidden="true"
      >
        <div className={`${styles.face} ${styles.faceFront}`}>
          <PageView
            page={pages[frontIdx]}
            side={faceSide as 'left' | 'right'}
            query={query}
            setQuery={setQuery}
            onJump={goTo}
          />
        </div>
        <div className={`${styles.face} ${styles.faceBack}`}>
          <PageView
            page={pages[backIdx]}
            side={faceSide as 'left' | 'right'}
            query={query}
            setQuery={setQuery}
            onJump={goTo}
          />
        </div>
      </div>
    );
  }

  /*
   * Sheet for a turn involving the front pages. Its faces are whole
   * views, not composed pages. Geometry follows the composed sheet:
   * on mobile the single page flips whole; on desktop a turn into
   * the book flips the spread's right leaf — the flyleaf going in
   * (its face front), revealing the landing spread's right page —
   * and a turn back out flips the left leaf, page 1 giving way to
   * the front page it returns to. (Front-to-front turns on desktop
   * render no sheet: their spread's leaves do not change, and the
   * front pages keep their own fade — see startFrontTurn.)
   */
  let frontSheet: React.ReactNode = null;
  if (frontTurn && bookOpen) {
    const { dir, from, to, landPage } = frontTurn;
    const frontViewNode = (v: 'intro' | 'contents', side: 'left' | 'right') =>
      v === 'intro' ? (
        <IntroPageView side={side} onBegin={() => {}} />
      ) : (
        <ContentsPageView
          side={side}
          entries={contentsEntries}
          onJump={() => {}}
        />
      );
    const bookViewNode = (idx: number, side: 'left' | 'right') => (
      <PageView
        page={pages[idx]}
        side={side}
        query={query}
        setQuery={setQuery}
        onJump={goTo}
      />
    );
    if (!isDesktop) {
      const faceSide = dir === 'fwd' ? 'right' : 'left';
      frontSheet = (
        <div
          className={`${styles.sheet} ${styles.sheetFull} ${dir === 'back' ? styles.sheetFullBack : ''} ${dir === 'fwd' ? styles.sheetFwd : styles.sheetBack}`}
          aria-hidden="true"
        >
          <div className={`${styles.face} ${styles.faceFront}`}>
            {from === 'book'
              ? bookViewNode(page, faceSide as 'left' | 'right')
              : frontViewNode(from as 'intro' | 'contents', faceSide as 'left' | 'right')}
          </div>
          <div className={`${styles.face} ${styles.faceBack}`}>
            {to === 'book'
              ? bookViewNode(landPage, faceSide as 'left' | 'right')
              : frontViewNode(to as 'intro' | 'contents', faceSide as 'left' | 'right')}
          </div>
        </div>
      );
    } else if (to === 'book') {
      frontSheet = (
        <div
          className={`${styles.sheet} ${styles.sheetRight} ${styles.sheetFwd}`}
          aria-hidden="true"
        >
          <div className={`${styles.face} ${styles.faceFront}`}>
            <div className={styles.pageSlot}>
              <div className={`${styles.page} ${styles.pageRight}`}>
                <p className={styles.flyleafMark} aria-hidden="true">
                  ✦
                </p>
              </div>
            </div>
          </div>
          <div className={`${styles.face} ${styles.faceBack}`}>
            {bookViewNode(Math.min(landPage + 1, pages.length - 1), 'right')}
          </div>
        </div>
      );
    } else if (from === 'book') {
      frontSheet = (
        <div
          className={`${styles.sheet} ${styles.sheetLeft} ${styles.sheetBack}`}
          aria-hidden="true"
        >
          <div className={`${styles.face} ${styles.faceFront}`}>
            {bookViewNode(0, 'left')}
          </div>
          <div className={`${styles.face} ${styles.faceBack}`}>
            {frontViewNode(to as 'intro' | 'contents', 'left')}
          </div>
        </div>
      );
    }
  }

  // On desktop the book ends at the final SPREAD (base of the last page),
  // not at the last page index — the old comparison left Next enabled on
  // the final spread and invited the crashing extra turn.
  const atEnd = page >= lastSpreadBase(pages.length, isDesktop);

  return (
    <ScrollMemoryContext.Provider value={scrollMemoryRef.current}>
    <WatermarkContext.Provider value={viewerEmail}>
    <section
      className={styles.stage}
      role="region"
      aria-label="The Living Grimoire — The Collective Works of Light Magic & Lost Knowledge — an interactive handmade book of botanical wisdom"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Typography (immersive reader, 2026-11-09): the display hand
          is Tangerine, SELF-HOSTED via @font-face in
          grimoire.module.css; reading text is EB Garamond, loaded
          site-wide by layout.tsx. No font CDN link lives here any
          more. layout.tsx untouched. */}

      <p className={styles.eyebrow}>✦ A living archive of botanical wisdom ✦</p>
      <div className={styles.ribbonRow}>
        <button type="button" className={styles.ribbonBtn} onClick={goToIndex}>
          🔖 Consult the Index
        </button>
      </div>

      <div
        className={styles.bookScene}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className={styles.book}>
          {coverState === 'closed' && (
            <div className={styles.cover} onClick={openBook}>
              {/* Pure cover art (owner directive 2026-11-09): the title is
                  tooled into the artwork itself, so NO text is overlaid on
                  the book. Tapping/clicking the book enters it; the
                  labelled entry prompt sits below the book (coverActions). */}
              <img
                className={styles.coverArt}
                src="/images/living-grimoire-cover.webp"
                alt="The Living Grimoire — The Collective Works of Light Magic & Lost Knowledge: a centuries-old handmade leather book with brass corners and a gold sun-and-crescent emblem"
                draggable={false}
              />
            </div>
          )}

          {/* The doorway (owner directive 2026-11-09 17:06 MST): the
              approved opening animation plays in the cover's own
              panel — the cover art is its poster and backdrop, so the
              first frame is the book itself while the film loads. The
              film is muted and decorative (aria-hidden); the skip is
              a real button, visible from the first frame, and tapping
              the film skips too. Every exit — end, skip, error —
              lands in finishDoorway, which opens the book. */}
          {(coverState === 'doorway' || doorwayLeaving) && (
            <div
              className={`${styles.doorway} ${doorwayLeaving ? styles.doorwayLeaving : ''}`}
              onClick={finishDoorway}
              onTransitionEnd={(e) => {
                if (e.propertyName === 'opacity') setDoorwayLeaving(false);
              }}
            >
              <video
                ref={videoRef}
                className={`${styles.doorwayVideo} ${videoReady ? styles.doorwayVideoReady : ''}`}
                src="/video/grimoire-opening.mp4"
                poster="/images/living-grimoire-cover.webp"
                autoPlay
                muted
                playsInline
                aria-hidden="true"
                onCanPlay={() => setVideoReady(true)}
                onEnded={finishDoorway}
                onError={finishDoorway}
              />
              {!doorwayLeaving && (
                <button
                  type="button"
                  className={styles.doorwaySkip}
                  onClick={(e) => {
                    e.stopPropagation();
                    finishDoorway();
                  }}
                >
                  Open the book ✦
                </button>
              )}
            </div>
          )}

          <div
            className={`${styles.spread} ${coverState !== 'open' ? styles.spreadClosed : ''}`}
            aria-hidden={!bookOpen}
          >
            {frontDisplay !== 'book' ? (
              <>
                {frontDisplay === 'intro' ? (
                  <IntroPageView side="left" onBegin={advanceFront} />
                ) : (
                  <ContentsPageView
                    side="left"
                    entries={contentsEntries}
                    onJump={jumpFromContents}
                  />
                )}
                {isDesktop && (
                  <div className={styles.pageSlot}>
                    <div className={`${styles.page} ${styles.pageRight}`}>
                      <p className={styles.flyleafMark} aria-hidden="true">
                        ✦
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <PageView
                  page={leftPage}
                  side="left"
                  query={query}
                  setQuery={setQuery}
                  onJump={goTo}
                />
                {isDesktop && rightPage && (
                  <PageView
                    page={rightPage}
                    side="right"
                    query={query}
                    setQuery={setQuery}
                    onJump={goTo}
                  />
                )}
              </>
            )}
            {sheet}
            {frontSheet}
            {bookOpen && (
              <>
                {/* The corner zones stay live during a turn — a tap
                    mid-turn is an intent, and navigation coalesces
                    it (immersive reader, 2026-11-09). */}
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneLeft}`}
                  onClick={prev}
                  disabled={atIntro}
                  aria-label="Previous page — turn from the bottom-left page corner"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneRight}`}
                  onClick={next}
                  disabled={atEnd}
                  aria-label="Next page — turn from the bottom-right page corner"
                  tabIndex={-1}
                />
              </>
            )}
          </div>

        </div>
      </div>

      {/* Closed view only (owner directives 2026-11-09): below the book
          sit the tagline and the single entry prompt — a gently pulsing
          "✦ Click to enter ✦" button. Nothing is written over the cover
          art, and the title is never repeated in text. Clicking the
          book itself enters too. */}
      {coverState === 'closed' && (
        <div className={styles.coverActions}>
          <p className={styles.coverTagline}>
            a handmade book of botanical wisdom, written in a living hand
          </p>
          <button
            type="button"
            className={`${styles.openBtn} ${styles.enterBtn}`}
            onClick={openBook}
          >
            ✦ Click to enter ✦
          </button>
        </div>
      )}

      {/* While the doorway film plays, the same place below the book
          carries its skip — a second, unmissable way in. */}
      {coverState === 'doorway' && (
        <div className={styles.coverActions}>
          <button
            type="button"
            className={styles.openBtn}
            onClick={finishDoorway}
          >
            Skip — open the book
          </button>
        </div>
      )}

      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prev}
          disabled={!bookOpen || atIntro}
          aria-label="Turn to the previous page"
        >
          ‹
        </button>
        <p className={styles.pageStatus} aria-hidden="true">
          {bookOpen
            ? atIntro
              ? 'Introduction'
              : atContents
                ? 'Contents'
                : `Page ${displayPage + 1} of ${pages.length}`
            : coverState === 'doorway'
              ? 'Opening the grimoire…'
              : 'The book is closed'}
        </p>
        <button
          type="button"
          className={styles.navBtn}
          onClick={next}
          disabled={!bookOpen || atEnd}
          aria-label="Turn to the next page"
        >
          ›
        </button>
      </div>

      {/* One quiet line of instruction (owner directive 2026-11-09 —
          the plain way the reader worked before the overhaul). No
          overlays, no tutorials: just the words, under the arrows,
          whenever the book is open. */}
      {bookOpen && (
        <p className={styles.navHint}>Use the arrows or swipe to turn the pages.</p>
      )}

      <p className={styles.srOnly} aria-live="polite" role="status">
        {announce}
      </p>
    </section>
    </WatermarkContext.Provider>
    </ScrollMemoryContext.Provider>
  );
}
