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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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

const DESKTOP_QUERY = '(min-width: 900px)';
const TURN_MS = 600;
const SWIPE_PX = 48;

interface TurnState {
  dir: 'fwd' | 'back';
  from: number;
  to: number;
}

/* ------------------------------------------------------------------ */
/* Page renderers                                                      */
/* ------------------------------------------------------------------ */

function PageShell({
  page,
  side,
  children,
}: {
  page: GrimoirePage;
  side: 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <div className={styles.pageSlot}>
      <div
        className={`${styles.page} ${side === 'left' ? styles.pageLeft : styles.pageRight}`}
      >
        {children}
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
        Turn these pages as you would a real book. Tap the page edges, use the
        brass arrows, swipe left or right, or press your ← → keys. Each entry
        holds a botanical illustration, the herb&apos;s Latin name, its
        traditional wisdom, and the allies it keeps company with.
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
        Here ends the first volume of the Living Grimoire — twelve herbs,
        written by hand and bound in leather. More entries are being written
        and verified as this new site grows; the book is alive, and it will
        keep growing.
      </p>
      <p className={styles.handBody}>
        Keepers of the Living Grimoire receive new entries, monthly rituals,
        and subscriber gifts as the archive grows.
      </p>
      <p style={{ marginTop: '1em' }}>
        <Link href="/grimoire/subscribe" className={styles.entryLink}>
          Become a keeper — Living Grimoire $7.77/mo →
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
  const touchX = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxPage = pages.length - 1;
  const bookOpen = coverState === 'open';
  const displayPage = turn ? turn.from : page;
  const spreadBase = isDesktop ? Math.floor(displayPage / 2) * 2 : displayPage;

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

  const goTo = useCallback(
    (target: number) => {
      const g = guardRef.current;
      if (g.turn || !g.bookOpen) return;
      const t = Math.max(0, Math.min(maxPage, Math.round(target)));
      if (t === g.page) return;
      const dir: TurnState['dir'] = t > g.page ? 'fwd' : 'back';
      setTurn({ dir, from: g.page, to: t });
      setPage(t);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setTurn(null);
        setAnnounce(`Page ${t + 1} of ${pages.length} — ${pageTitle(pages[t])}`);
      }, TURN_MS);
    },
    [maxPage, pages],
  );

  const step = isDesktop ? 2 : 1;
  const next = useCallback(() => goTo(page + step), [goTo, page, step]);
  const prev = useCallback(() => goTo(page - step), [goTo, page, step]);

  const openBook = useCallback(() => {
    if (coverState !== 'closed') return;
    setCoverState('opening');
    window.setTimeout(() => {
      setCoverState('open');
      setAnnounce(
        `The grimoire is open. Page 1 of ${pages.length} — ${pageTitle(pages[0])}`,
      );
    }, 650);
  }, [coverState, pages]);

  const goToIndex = useCallback(() => {
    if (!guardRef.current.bookOpen) {
      openBook();
      // The book finishes opening at ~650ms; goTo reads live guard state.
      window.setTimeout(() => goTo(2), 750);
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

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || !bookOpen || turn) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -SWIPE_PX) next();
    else if (dx > SWIPE_PX) prev();
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
    const frontIdx = dir === 'fwd' ? (isDesktop ? from + 1 : from) : from;
    const backIdx = dir === 'fwd' ? (isDesktop ? to + 1 : to) : to;
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
  const atEnd = page >= maxPage;

  return (
    <section
      className={styles.stage}
      role="region"
      aria-label="The Living Grimoire — an interactive handmade-style book of herbal wisdom"
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
                  The Living
                  <br />
                  Grimoire
                  <br />
                  of Herbs
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
                  Open the Grimoire ✦
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
                  aria-label="Previous page"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className={`${styles.edgeZone} ${styles.edgeZoneRight}`}
                  onClick={next}
                  disabled={atEnd || !!turn}
                  aria-label="Next page"
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
  );
}
