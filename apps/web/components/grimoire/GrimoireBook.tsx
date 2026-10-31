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
  herbDisplayName,
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
const COVER_OPEN_MS = 650;

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
      <p className={styles.categoryRow}>✦ Living Grimoire — 333-page edition ✦</p>
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
        turns the page. Ahead lie the family edition complete — all 333
        pages — and the collected works in full; the oldest books are shown
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
        The Living Grimoire — 333-page edition, together with the
        owner&apos;s collected works. The full book may grow beyond 333
        pages as the collection is added.
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
        ✦ The Grimoire of Remembered Light — Part {page.part} · {page.partTitle}{' '}
        ✦
      </p>
      <h2 className={styles.handHeading}>{page.heading}</h2>
      {page.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className={styles.handBody}>
          {p}
        </p>
      ))}
      <p className={styles.footnote}>
        Edition page {page.editionPageNumber} of 333 — the family edition,
        complete.
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
        Here ends this volume of the Living Grimoire of Light & Magic — the
        family edition complete in its 333 pages, the keeper&apos;s own
        lessons, and the collected works in full, kept together as one book.
        The book is alive, and it will keep growing as more of the family
        archive is transcribed and verified.
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
      <p className={styles.categoryRow}>✦ Living Grimoire — 333-page edition ✦</p>
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
        This page is kept for members of the Living Grimoire — 333-page
        edition. Subscribers and permanent-unlock holders who have verified
        their email see it in full; everyone else sees the first sixteen
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
   * all composed pages in full; everyone else receives pages 1–16 in full and
   * locked placeholders for 17+. This component never builds content
   * itself — gated body text is simply absent from its props.
   */
  pages: GrimoireDisplayPage[];
  /** The entitled viewer's email (their watermark); null otherwise. */
  viewerEmail?: string | null;
}

export function GrimoireBook({ pages, viewerEmail = null }: GrimoireBookProps) {
  const [coverState, setCoverState] = useState<'closed' | 'opening' | 'open'>(
    'closed',
  );
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

  /* Ref mirror of guard state so delayed calls (ribbon → open → jump) never
     act on a stale closure. */
  const guardRef = useRef({
    turn: null as TurnState | null,
    bookOpen: false,
    page: 0,
  });
  guardRef.current.turn = turn;
  guardRef.current.bookOpen = bookOpen;
  guardRef.current.page = page;

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
      if (t === g.page) return;
      const dir: TurnState['dir'] = t > g.page ? 'fwd' : 'back';
      setTurn({ dir, from: g.page, to: t });
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
  const next = useCallback(() => goTo(page + step), [goTo, page, step]);
  const prev = useCallback(() => goTo(page - step), [goTo, page, step]);

  const openBook = useCallback(() => {
    if (coverState !== 'closed') return;
    setCoverState('opening');
    window.setTimeout(
      () => {
        setCoverState('open');
        setAnnounce(
          `The grimoire is open. Page 1 of ${pages.length} — ${displayPageTitle(pages[0])}`,
        );
      },
      reducedMotion ? TURN_MS_REDUCED : COVER_OPEN_MS,
    );
  }, [coverState, pages, reducedMotion]);

  const goToIndex = useCallback(() => {
    if (!guardRef.current.bookOpen) {
      openBook();
      // The book finishes opening at ~650ms (near-instant under reduced
      // motion); goTo reads live guard state.
      window.setTimeout(
        () => goTo(2),
        reducedMotion ? TURN_MS_REDUCED + 50 : COVER_OPEN_MS + 100,
      );
    } else {
      goTo(2);
    }
  }, [goTo, openBook, reducedMotion]);

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

  const atStart = page <= 0;
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
      aria-label="Living Grimoire of Light & Magic — an interactive handmade-style book of herbal wisdom"
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
          {coverState !== 'open' && (
            <div
              className={`${styles.cover} ${coverState === 'opening' ? styles.coverOpening : ''}`}
            >
              <div className={styles.coverInner}>
                <p className={styles.coverBrand}>
                  Amber&apos;s Alchemy Apothecary
                </p>
                <h2 className={styles.coverTitle}>
                  Living Grimoire
                  <br />
                  of Light
                  <br />
                  &amp; Magic
                </h2>
                <p className={styles.coverRule} aria-hidden="true">
                  ✦ ✦ ✦
                </p>
                <p className={styles.coverSub}>
                  a handmade book of botanical wisdom,
                  <br />
                  written in a living hand
                </p>
                <button
                  type="button"
                  className={styles.openBtn}
                  onClick={openBook}
                  disabled={coverState === 'opening'}
                >
                  Open the Living Grimoire of Light &amp; Magic ✦
                </button>
              </div>
            </div>
          )}

          <div className={styles.spread} aria-hidden={!bookOpen}>
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
            {sheet}
            {bookOpen && (
              <>
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneLeft}`}
                  onClick={prev}
                  disabled={atStart || !!turn}
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

      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prev}
          disabled={!bookOpen || atStart || !!turn}
          aria-label="Turn to the previous page"
        >
          ‹
        </button>
        <p className={styles.pageStatus} aria-hidden="true">
          {bookOpen
            ? `Page ${displayPage + 1} of ${pages.length}`
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

      <p className={styles.srOnly} aria-live="polite" role="status">
        {announce}
      </p>
    </section>
    </WatermarkContext.Provider>
    </ScrollMemoryContext.Provider>
  );
}
