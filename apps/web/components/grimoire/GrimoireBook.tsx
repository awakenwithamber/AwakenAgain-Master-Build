'use client';

/**
 * WORKSTREAM D — <GrimoireBook>.
 *
 * A leather-bound, handmade-book rendering of the Living Grimoire:
 * parchment pages, handwritten-style text (Caveat), 3D page-turn
 * animation (~600ms), edge tap zones + arrows + keyboard + swipe.
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
        Here the free pages end — but the book goes on. The first 17
        pages are open to every seeker, free; this page is kept for
        members of the Living Grimoire, and subscribers who have
        verified their email see it in full.
      </p>
      <p className={styles.handBody}>
        Awaken your $7.77/month subscription and the entire Living
        Grimoire opens to you: all 1,051 pages of spells, rituals, and
        lost knowledge, yours to read for as long as your membership
        lives. And if you already have access, verify your email below
        the book to open it.
      </p>
      <p style={{ marginTop: '1em' }}>
        <Link href="/grimoire/subscribe" className={styles.entryLink}>
          Awaken your subscription →
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
  const [coverState, setCoverState] = useState<'closed' | 'open'>('closed');
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
  const scrollMemoryRef = useRef<Map<number, number>>(new Map());

  const turnMs = reducedMotion ? TURN_MS_REDUCED : TURN_MS;

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
    bookOpen: false,
    page: 0,
    frontPage: 'intro' as 'intro' | 'contents' | null,
  });
  guardRef.current.turn = turn;
  guardRef.current.bookOpen = bookOpen;
  guardRef.current.page = page;
  guardRef.current.frontPage = frontPage;

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

  const goTo = useCallback(
    (target: number) => {
      const g = guardRef.current;
      if (g.turn || !g.bookOpen) return;
      // Desktop targets are spread bases, never a right-hand page itself:
      // targeting the final page index directly made the turn sheet read
      // pages[pages.length] (undefined) and throw. See grimoirePagination.
      const t = clampNavigationTarget(target, pages.length, isDesktop);
      if (t === g.page) {
        /* Already on that page — but if a front page is showing, the
           navigation still means "take me into the book, here". */
        if (g.frontPage !== null) setFrontPage(null);
        return;
      }
      const dir: TurnState['dir'] = t > g.page ? 'fwd' : 'back';
      setTurn({ dir, from: g.page, to: t });
      /* Any composed-page navigation leaves the front pages behind. */
      setFrontPage(null);
      setPage(t);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setTurn(null);
        setAnnounce(`Page ${t + 1} of ${pages.length} — ${displayPageTitle(pages[t])}`);
      }, turnMs);
    },
    [isDesktop, maxPage, pages, turnMs],
  );

  const step = isDesktop ? 2 : 1;

  /*
   * Moving through the front pages: Introduction → Contents → the
   * composed book's first page. Plain state changes — no staged
   * animation between front pages (owner directive 2026-11-09).
   */
  const advanceFront = useCallback(() => {
    if (!bookOpen) return;
    if (frontPage === 'intro') {
      setFrontPage('contents');
      setAnnounce('Contents — tap a section to jump to it.');
      return;
    }
    if (frontPage === 'contents') {
      setFrontPage(null);
      setAnnounce(
        `Page 1 of ${pages.length} — ${displayPageTitle(pages[0])}`,
      );
    }
  }, [bookOpen, frontPage, pages]);

  /*
   * A Contents entry tap: jump straight to that section's first
   * composed page. Instant, like the front-page turns — the flip
   * sheet belongs to page-by-page reading inside the composed book.
   */
  const jumpFromContents = useCallback(
    (target: number) => {
      if (!bookOpen) return;
      const t = clampNavigationTarget(target, pages.length, isDesktop);
      setFrontPage(null);
      setPage(t);
      setAnnounce(
        `Page ${t + 1} of ${pages.length} — ${displayPageTitle(pages[t])}`,
      );
    },
    [bookOpen, isDesktop, pages],
  );

  const next = useCallback(() => {
    if (frontPage !== null) {
      advanceFront();
      return;
    }
    goTo(page + step);
  }, [advanceFront, frontPage, goTo, page, step]);

  const prev = useCallback(() => {
    if (!bookOpen || turn) return;
    if (frontPage === 'contents') {
      /* Back from the Contents page returns to the Introduction. */
      setFrontPage('intro');
      setAnnounce('Introduction — turn the page to begin.');
      return;
    }
    if (frontPage === 'intro') return;
    if (page <= 0) {
      /* Turning back from the first composed page returns to the
         Contents page, as turning back in a real book would. */
      setFrontPage('contents');
      setAnnounce('Contents — tap a section to jump to it.');
      return;
    }
    goTo(page - step);
  }, [bookOpen, frontPage, goTo, page, step, turn]);

  /*
   * Entry (owner correction 2026-11-09): the book simply opens —
   * directly and immediately onto the Introduction. The earlier
   * table-scene/zoom sequence is removed entirely; there is nothing
   * to wait for and nothing that can stall on a phone.
   */
  const openBook = useCallback(() => {
    if (coverState !== 'closed') return;
    setCoverState('open');
    setAnnounce('The grimoire is open. Introduction — turn the page to begin.');
  }, [coverState]);

  const goToIndex = useCallback(() => {
    if (!guardRef.current.bookOpen) {
      openBook();
      // The book now opens instantly; the short delay only lets the
      // open state land before goTo reads live guard state.
      window.setTimeout(() => goTo(2), 100);
    } else {
      goTo(2);
    }
  }, [goTo, openBook]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Let focused buttons/links handle their own keys (avoids double-open).
    if ((e.target as HTMLElement).closest('button, a, input')) return;
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
    if (!start || !bookOpen || turn) return;
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
    if (!start || e.pointerType === 'touch' || !bookOpen || turn) return;
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
      {/* Handwriting font — hoisted to <head> by React 19. layout.tsx untouched. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap"
        rel="stylesheet"
      />

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

          <div
            className={`${styles.spread} ${coverState === 'closed' ? styles.spreadClosed : ''}`}
            aria-hidden={!bookOpen}
          >
            {frontPage !== null ? (
              <>
                {frontPage === 'intro' ? (
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
            {bookOpen && (
              <>
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneLeft}`}
                  onClick={prev}
                  disabled={atIntro || !!turn}
                  aria-label="Previous page — turn from the bottom-left page corner"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneRight}`}
                  onClick={next}
                  disabled={atEnd || !!turn}
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

      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prev}
          disabled={!bookOpen || atIntro || !!turn}
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
            : 'The book is closed'}
        </p>
        <button
          type="button"
          className={styles.navBtn}
          onClick={next}
          disabled={!bookOpen || atEnd || !!turn}
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
