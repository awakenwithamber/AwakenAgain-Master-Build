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
  buildGrimoirePages,
  categoryLabel,
  herbDisplayName,
  herbPageNumber,
  pageTitle,
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

function PageShell({
  page,
  side,
  children,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
  children: React.ReactNode;
}) {
  const scrollMemory = useContext(ScrollMemoryContext);
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
      <p className={styles.categoryRow}>✦ Volume One ✦</p>
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
        turns the page. Each entry holds a botanical illustration, the
        herb&apos;s Latin name, its traditional wisdom, and the allies it
        keeps company with.
      </p>
      <h3 className={styles.handHeading}>A note on these words</h3>
      <p className={styles.handBody}>
        Everything written here is framed as <em>traditional use</em> and early
        findings — the way herbalists have spoken of these plants for
        generations — never as proven medical claims. New entries are still
        being written and verified for this new site; what you read here is
        real, and what isn&apos;t ready is simply left unwritten.
      </p>
      <p className={styles.handBody}>
        When a page is finished, its ribbon will point you to the fuller entry
        in the herb library.
      </p>
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
  page: GrimoirePage;
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
                onClick={() => onJump(herbPageNumber(h) - 1)}
              >
                {herbDisplayName(h)} · p.{herbPageNumber(h)}
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
        Here ends the first volume of the Living Grimoire of Light & Magic — twelve herbs,
        written by hand and bound in leather. More entries are being written
        and verified as this new site grows; the book is alive, and it will
        keep growing.
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

function PageView({
  page,
  side,
  query,
  setQuery,
  onJump,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
  query: string;
  setQuery: (q: string) => void;
  onJump: (pageIndex: number) => void;
}) {
  switch (page.kind) {
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

export function GrimoireBook() {
  const [pages] = useState<GrimoirePage[]>(buildGrimoirePages);
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
        setAnnounce(`Page ${t + 1} of ${pages.length} — ${pageTitle(pages[t])}`);
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
          `The grimoire is open. Page 1 of ${pages.length} — ${pageTitle(pages[0])}`,
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
    </ScrollMemoryContext.Provider>
  );
}
