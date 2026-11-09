/**
 * Grimoire cover + reader overhaul (owner directive 2026-11-09).
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
 *   the pulsing "✦ Click to enter ✦" prompt, both BELOW the book;
 * - entry is a short sequence: standing cover → the book on its velvet
 *   table scene (~1s) → a zoom into the book → a reader-level
 *   INTRODUCTION page (owner's words, verbatim) that is NOT part of
 *   the composed pagination;
 * - a one-time-per-session swipe tutorial hint shows on the
 *   introduction page;
 * - every entry animation is cancelled under prefers-reduced-motion —
 *   the reduced-motion block must sit AFTER the animation rules it
 *   overrides at equal specificity, or it silently loses.
 *
 * Structural protections (unchanged on purpose): the edition ID stays
 * 'living-grimoire-333' (the entitlement key on existing records) and
 * the unlock scope keeps the wording shipped 2026-11-09.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GRIMOIRE_EDITION_ID,
  GRIMOIRE_EDITION_NAME,
  GRIMOIRE_UNLOCK_SCOPE,
} from '../lib/grimoire/edition';

const ROOT = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const BOOK = read('components/grimoire/GrimoireBook.tsx');
const CSS = read('components/grimoire/grimoire.module.css');
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

describe('grimoire cover overhaul — entry sequence + swipe tutorial', () => {
  it('the table scene beat and the zoom exist', () => {
    expect(BOOK).toContain('/images/living-grimoire-table-scene.webp');
    expect(BOOK).toContain("'closed' | 'scene' | 'zooming' | 'open'");
    expect(CSS).toContain('.scene');
    expect(CSS).toContain('@keyframes sceneZoom');
    expect(CSS).toContain('scale(2.4)');
    expect(CSS).toContain('@keyframes enterPulse');
  });

  it('the introduction page carries the owner text verbatim and stays out of the pagination', () => {
    expect(BOOK).toContain('This book was not written by one hand');
    expect(BOOK).toContain('orphans of it');
    expect(BOOK).toContain('begin a grimoire of your own');
    expect(BOOK).toContain('The door is open. Turn the page, and begin.');
    expect(BOOK).toContain('Turn the page to begin ✦');
    /* Reader-level state only — the composed `page` index is untouched. */
    expect(BOOK).toContain('atIntro');
  });

  it('the swipe hint markup and lifecycle exist', () => {
    expect(BOOK).toContain('Swipe to turn the page — or use the arrows');
    expect(BOOK).toContain("useState<'waiting' | 'shown' | 'done'>");
    expect(CSS).toContain('.swipeHint');
    expect(CSS).toContain('@keyframes swipeSweep');
    /* The hint can never block a swipe or a tap. */
    expect(CSS).toMatch(/\.swipeHint\s*{[^}]*pointer-events: none/);
  });

  it('reduced motion wins: its block follows the animation rules and stills the sequence + hint', () => {
    const reduceIdx = CSS.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(reduceIdx).toBeGreaterThan(-1);
    expect(reduceIdx).toBeGreaterThan(CSS.indexOf('@keyframes sceneZoom'));
    expect(reduceIdx).toBeGreaterThan(CSS.indexOf('@keyframes swipeSweep'));
    const block = CSS.slice(reduceIdx, reduceIdx + 900);
    expect(block).toContain('.sceneZoom');
    expect(block).toContain('animation-duration: 0.01s');
    expect(block).toContain('.swipeGlyph');
    expect(block).toContain('.enterBtn');
    expect(block).toContain('animation: none');
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
