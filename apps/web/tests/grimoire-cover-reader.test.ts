/**
 * Grimoire cover + reader overhaul (owner directive 2026-11-09),
 * with the owner's reader correction later the same day.
 *
 * The owner, looking at the live reader on her phone, rejected (a) the
 * title text repeated over/around the book and (b) text placed OVER
 * the cover art. Her orders, pinned here:
 *
 * - the book is titled "The Living Grimoire — The Collective Works of
 *   Light Magic & Lost Knowledge" — tooled into the cover artwork
 *   itself, carried by the page's accessible (visually hidden) h1, the
 *   metadata, the edition name, the subscribe h1, and the sitemap /
 *   links surfaces;
 * - the cover is PURE IMAGE — no overlaid brand/title/rule/subtitle
 *   markup, and no visible heading repeating the title above the book;
 * - on the closed view the only text with the book is the tagline and
 *   the pulsing "✦ Click to enter ✦" prompt, both BELOW the book.
 *
 * The correction (owner, 2026-11-09, after the combined release
 * shipped): "The animating of the book does not seem to work. I liked
 * the way it was before with the arrows and simple instructions.
 * Include a table of contents page in the first pages of the book."
 * Pinned here:
 *
 * - entry is DIRECT — tapping the cover opens the book at once onto
 *   the Introduction. The table-scene beat and the zoom are gone from
 *   component and CSS alike (the table-scene image file stays in the
 *   repo, unreferenced);
 * - the front pages are reader-level state only (Introduction →
 *   Contents → composed page 1; back turns return through Contents to
 *   the Introduction) and NEVER enter the composed pagination — the
 *   book stays exactly 1,051 pages behind the same 17-page gate;
 * - the Contents page is derived entirely from the composed book's
 *   own generated TOC (same labels, same order, starting pages parsed
 *   from the TOC's own detail strings) and each entry jumps to its
 *   section's first page;
 * - navigation is the plain way it worked before the overhaul: brass
 *   arrows + one quiet instruction line under them. The animated
 *   swipe-tutorial chip is gone;
 * - every remaining animation is cancelled under
 *   prefers-reduced-motion — the reduced-motion block must sit AFTER
 *   the animation rules it overrides at equal specificity, or it
 *   silently loses.
 *
 * Structural protections (unchanged on purpose): the edition ID stays
 * 'living-grimoire-333' (the entitlement key on existing records) and
 * the unlock scope keeps the wording shipped 2026-11-09.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GRIMOIRE_EDITION_ID,
  GRIMOIRE_EDITION_NAME,
  GRIMOIRE_UNLOCK_SCOPE,
} from '../lib/grimoire/edition';
import {
  FREE_PREVIEW_LAST_PAGE,
  buildGrimoirePages,
  displayPagesFor,
  frontContentsEntries,
  tocEntryStartPage,
} from '../components/grimoire/grimoireContent';
import { getEditionManifest } from '../lib/grimoire/manifest';
import { getBookContent } from '../lib/grimoire/book-content';

const ROOT = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const BOOK = read('components/grimoire/GrimoireBook.tsx');
const CSS = read('components/grimoire/grimoire.module.css');
const CONTENT = read('components/grimoire/grimoireContent.ts');
const PAGE = read('app/grimoire/page.tsx');
const SUBSCRIBE = read('app/grimoire/subscribe/page.tsx');

const NEW_TITLE =
  'The Living Grimoire — The Collective Works of Light Magic & Lost Knowledge';

describe('grimoire cover overhaul — title surfaces', () => {
  it('the edition name carries the new title', () => {
    expect(GRIMOIRE_EDITION_NAME).toBe(NEW_TITLE);
  });

  it('the /grimoire metadata carries the new title and keeps the count', () => {
    expect(PAGE).toContain(NEW_TITLE);
    expect(PAGE).toContain('1,051 pages in all');
  });

  it('the accessible h1 carries the new title (visually hidden by design)', () => {
    expect(PAGE).toContain('<h1 className="visually-hidden">');
    expect(PAGE).toContain(
      'The Collective Works of Light Magic &amp; Lost',
    );
  });

  it('the subscribe h1 carries the new title', () => {
    expect(SUBSCRIBE).toContain(
      'The Collective Works of Light Magic &amp; Lost',
    );
  });
});

describe('grimoire cover overhaul — pure-image cover, no repetition', () => {
  it('the cover renders the new artwork file', () => {
    expect(BOOK).toContain('/images/living-grimoire-cover.webp');
    expect(BOOK).not.toContain('living-grimoire-cover.jpg');
  });

  it('no overlaid cover text markup remains', () => {
    for (const cls of [
      'coverInner',
      'coverBrand',
      'coverTitle',
      'coverRule',
      'coverSub',
    ]) {
      expect(BOOK, cls).not.toContain(cls);
      expect(CSS, cls).not.toContain(`.${cls}`);
    }
  });

  it('the old open-button texts are gone; the entry prompt remains', () => {
    expect(BOOK).not.toContain('Open the Living Grimoire of Light');
    expect(BOOK).not.toContain('Open the Living Grimoire ✦');
    expect(BOOK).toContain('✦ Click to enter ✦');
  });

  it('the tagline survives exactly once, below the book', () => {
    const occurrences = BOOK.split('written in a living hand').length - 1;
    expect(occurrences).toBe(1);
    expect(BOOK).toContain(
      'a handmade book of botanical wisdom, written in a living hand',
    );
    expect(BOOK).toContain('coverTagline');
  });

  it('tapping the book itself opens it', () => {
    expect(BOOK).toContain('onClick={openBook}');
  });
});

describe('grimoire reader fix — direct entry, no scene, no zoom', () => {
  it('the cover state is simply closed | open — the entry states are gone', () => {
    expect(BOOK).toContain("useState<'closed' | 'open'>");
    expect(BOOK).not.toContain("'zooming'");
    expect(BOOK).not.toContain('ENTRY_SCENE_MS');
    expect(BOOK).not.toContain('ENTRY_ZOOM_MS');
  });

  it('openBook opens the book directly — no timers stage the entry', () => {
    const openIdx = BOOK.indexOf('const openBook');
    const openEnd = BOOK.indexOf('}, [coverState]);', openIdx);
    const openBlock = BOOK.slice(openIdx, openEnd);
    expect(openBlock).toContain("setCoverState('open')");
    expect(openBlock).not.toContain('setTimeout');
    expect(openBlock).not.toContain('scene');
  });

  it('neither component nor CSS references the table scene or the zoom', () => {
    expect(BOOK).not.toContain('living-grimoire-table-scene');
    expect(CSS).not.toContain('.scene');
    expect(CSS).not.toContain('@keyframes sceneZoom');
    expect(CSS).not.toContain('scale(2.4)');
    /* The entry prompt's gentle pulse is not part of the sequence. */
    expect(CSS).toContain('@keyframes enterPulse');
  });

  it('the table-scene image file stays in the repo, simply unreferenced', () => {
    expect(
      existsSync(join(ROOT, 'public/images/living-grimoire-table-scene.webp')),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, 'public/images/living-grimoire-cover.webp')),
    ).toBe(true);
  });
});

describe('grimoire reader fix — front pages: Introduction → Contents → page 1', () => {
  it('the front pages are reader-level state, ordered intro → contents → book', () => {
    expect(BOOK).toContain("useState<'intro' | 'contents' | null>");
    expect(BOOK).toContain('function IntroPageView');
    expect(BOOK).toContain('function ContentsPageView');
    /* Advancing walks the order; nothing skips the Contents page. */
    expect(BOOK).toContain("frontPage === 'intro'");
    expect(BOOK).toContain("setFrontPage('contents')");
    expect(BOOK).toContain("frontPage === 'contents'");
    expect(BOOK).toContain('setFrontPage(null)');
  });

  it('turning back walks the same order in reverse', () => {
    /* Contents → Introduction, and composed page 1 → Contents. */
    expect(BOOK).toContain("setFrontPage('intro')");
    const prevIdx = BOOK.indexOf('const prev');
    const prevBlock = BOOK.slice(prevIdx, prevIdx + 1400);
    expect(prevBlock).toContain("frontPage === 'contents'");
    expect(prevBlock).toContain("setFrontPage('intro')");
    expect(prevBlock).toContain('page <= 0');
    expect(prevBlock).toContain("setFrontPage('contents')");
  });

  it('the introduction page carries the owner text verbatim', () => {
    expect(BOOK).toContain('This book was not written by one hand');
    expect(BOOK).toContain('orphans of it');
    expect(BOOK).toContain('begin a grimoire of your own');
    expect(BOOK).toContain('The door is open. Turn the page, and begin.');
    expect(BOOK).toContain('Turn the page to begin ✦');
  });

  it('the contents page invites a tap and jumps through the derived entries', () => {
    expect(BOOK).toContain('Tap a section to jump to it.');
    expect(BOOK).toContain('frontContentsEntries');
    expect(BOOK).toContain('jumpFromContents');
    expect(CSS).toContain('.contentsList');
    expect(CSS).toContain('.contentsBtn');
  });

  it('the front pages never enter the composed pagination or the gate', () => {
    /* No front-page kinds exist in the composed page model. */
    expect(CONTENT).not.toContain("kind: 'intro'");
    expect(CONTENT).not.toContain("kind: 'contents'");
    const composed = buildGrimoirePages(
      getEditionManifest(),
      getBookContent(),
    );
    expect(composed).toHaveLength(1051);
    expect(composed.map((p) => p.pageNumber)).toEqual(
      Array.from({ length: 1051 }, (_, i) => i + 1),
    );
    /* The gate is untouched: 17 full pages, everything after locked. */
    expect(FREE_PREVIEW_LAST_PAGE).toBe(17);
    const display = displayPagesFor(composed, false);
    expect(display.slice(0, 17).every((p) => p.kind !== 'locked')).toBe(true);
    expect(display.filter((p) => p.kind === 'locked')).toHaveLength(
      1051 - 17,
    );
  });
});

describe('grimoire reader fix — contents entries derive from the book’s own TOC', () => {
  const composed = buildGrimoirePages(getEditionManifest(), getBookContent());
  const toc = composed.find((p) => p.kind === 'toc');
  const entries = frontContentsEntries(displayPagesFor(composed, false));

  it('the start page is parsed from the TOC detail the composition wrote', () => {
    expect(tocEntryStartPage('page 1')).toBe(1);
    expect(tocEntryStartPage('pages 2–3')).toBe(2);
    expect(tocEntryStartPage('in full — pages 351–1050')).toBe(351);
    expect(tocEntryStartPage('page 350')).toBe(350);
    expect(tocEntryStartPage('rights pending — not yet available')).toBeNull();
  });

  it('the front contents mirrors the composed TOC exactly — labels and order', () => {
    if (!toc || toc.kind !== 'toc') throw new Error('composed TOC missing');
    expect(entries.map((e) => e.label)).toEqual(
      toc.entries.map((e) => e.label),
    );
    expect(entries.map((e) => e.detail)).toEqual(
      toc.entries.map((e) => e.detail),
    );
  });

  it('every jump target lands on the composed page the TOC names', () => {
    expect(entries[0].label).toBe('Cover & Title');
    expect(entries[0].startPage).toBe(1);
    expect(composed[0].kind).toBe('title');
    const tocEntry = entries.find((e) => e.label === 'Table of Contents');
    expect(tocEntry?.startPage).toBe(6);
    expect(composed[5].kind).toBe('toc');
    for (const e of entries) {
      if (e.startPage === null) continue;
      expect(e.startPage).toBeGreaterThanOrEqual(1);
      expect(e.startPage).toBeLessThanOrEqual(1051);
      expect(composed[e.startPage - 1].pageNumber).toBe(e.startPage);
    }
  });

  it('part entries land on that part’s first edition page', () => {
    for (const e of entries) {
      const m = e.label.match(/^Part ([IVX]+) — /);
      if (!m || e.startPage === null) continue;
      const target = composed[e.startPage - 1];
      expect(target.kind).toBe('edition-page');
      if (target.kind === 'edition-page') expect(target.part).toBe(m[1]);
    }
  });

  it('rights-pending works are listed with no jump target', () => {
    const held = entries.find((e) => e.label.includes('Elverum'));
    expect(held).toBeDefined();
    expect(held?.startPage).toBeNull();
    expect(held?.detail).toContain('rights pending');
  });
});

describe('grimoire reader fix — arrows and one simple instruction line', () => {
  it('the swipe-tutorial chip is gone from component and CSS', () => {
    expect(BOOK).not.toContain('swipeHint');
    expect(BOOK).not.toContain("useState<'waiting' | 'shown' | 'done'>");
    expect(BOOK).not.toContain('INTRO_TURN_MS');
    expect(BOOK).not.toContain('introLeaving');
    expect(CSS).not.toContain('.swipeHint');
    expect(CSS).not.toContain('@keyframes swipeSweep');
    expect(CSS).not.toContain('.introLeaving');
  });

  it('one quiet instruction line sits under the arrows while the book is open', () => {
    expect(BOOK).toContain('Use the arrows or swipe to turn the pages.');
    expect(BOOK).toContain('styles.navHint');
    expect(CSS).toContain('.navHint');
    /* The arrows themselves are untouched. */
    expect(BOOK).toContain('aria-label="Turn to the previous page"');
    expect(BOOK).toContain('aria-label="Turn to the next page"');
    expect(CSS).toContain('.navBtn');
  });

  it('reduced motion still wins: its block follows the turn animations and stills what remains', () => {
    const reduceIdx = CSS.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(reduceIdx).toBeGreaterThan(-1);
    expect(reduceIdx).toBeGreaterThan(CSS.indexOf('@keyframes turnFwd'));
    const block = CSS.slice(reduceIdx, reduceIdx + 900);
    expect(block).toContain('.sheetFwd');
    expect(block).toContain('animation-duration: 0.01s');
    expect(block).toContain('.enterBtn');
    expect(block).toContain('.introPage');
    expect(block).toContain('animation: none');
    /* Nothing from the removed sequence or tutorial remains to still. */
    expect(block).not.toContain('.sceneZoom');
    expect(block).not.toContain('.swipeGlyph');
  });

  it('mobile stage padding leaves room to scroll clear of the GAIA pill', () => {
    const mobileIdx = CSS.indexOf('@media (max-width: 899px)');
    expect(mobileIdx).toBeGreaterThan(-1);
    const block = CSS.slice(mobileIdx);
    expect(block).toContain('padding-bottom: 132px');
  });
});

describe('grimoire cover overhaul — structural protections', () => {
  it('the edition ID is unchanged (entitlement key on existing records)', () => {
    expect(GRIMOIRE_EDITION_ID).toBe('living-grimoire-333');
  });

  it('the unlock scope keeps the wording shipped 2026-11-09', () => {
    expect(GRIMOIRE_UNLOCK_SCOPE).toContain(
      'The Grimoire of Ancient Teachings complete, together',
    );
    expect(GRIMOIRE_UNLOCK_SCOPE).toContain('(1,051 pages)');
  });
});
