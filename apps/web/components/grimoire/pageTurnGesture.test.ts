/**
 * Grimoire page-turn gesture regression suite — PROJECT 1 (2026-10-20).
 *
 * The owner-reported defect: "the second page turns before the visitor
 * finishes scrolling through the entry." Root cause in the old handler:
 * it recorded only clientX and turned at |dx| > 48px, so the sideways
 * drift of an ordinary vertical read-scroll turned the page — on pages
 * that had overflow:hidden and could not scroll at all.
 *
 * These tests pin the replacement rule in pageTurnGesture.ts: vertical
 * scrolling NEVER turns a page; only an unmistakable horizontal swipe
 * (≥72px, ≥2× the vertical travel, ≤600ms, content did not scroll) may.
 * A final describe block guards the wiring/CSS the classifier depends on
 * (source-shape assertions, the same pattern as other suites in this repo).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SWIPE_DOMINANCE_RATIO,
  SWIPE_MAX_DURATION_MS,
  SWIPE_MIN_PX,
  classifyPageTurnGesture,
  type PageTurnGestureInput,
} from './pageTurnGesture';

const here = dirname(fileURLToPath(import.meta.url));

function gesture(
  partial: Partial<PageTurnGestureInput>,
): PageTurnGestureInput {
  return {
    startX: 200,
    startY: 400,
    endX: 200,
    endY: 400,
    durationMs: 250,
    contentScrolled: false,
    ...partial,
  };
}

describe('vertical scrolling never turns a page', () => {
  it('a straight vertical scroll does not turn', () => {
    expect(
      classifyPageTurnGesture(gesture({ endX: 205, endY: 180 })),
    ).toBeNull();
  });

  it('a vertical scroll with sideways drift past the OLD 48px threshold does not turn', () => {
    // The exact reported bug: reading scroll, finger drifts 80px sideways.
    expect(
      classifyPageTurnGesture(gesture({ endX: 280, endY: 220 })),
    ).toBeNull();
  });

  it('a diagonal gesture that is not horizontally dominant does not turn', () => {
    expect(
      classifyPageTurnGesture(gesture({ endX: 110, endY: 340 })),
    ).toBeNull();
  });

  it('any gesture during which the page content actually scrolled does not turn', () => {
    expect(
      classifyPageTurnGesture(
        gesture({ endX: 60, endY: 395, contentScrolled: true }),
      ),
    ).toBeNull();
  });

  it('a slow horizontal drag is a drag, not a swipe', () => {
    expect(
      classifyPageTurnGesture(
        gesture({ endX: 40, durationMs: SWIPE_MAX_DURATION_MS + 300 }),
      ),
    ).toBeNull();
  });

  it('a short horizontal nudge below the minimum does not turn', () => {
    expect(
      classifyPageTurnGesture(gesture({ endX: 200 - (SWIPE_MIN_PX - 1) })),
    ).toBeNull();
  });

  it('a tap does not turn', () => {
    expect(classifyPageTurnGesture(gesture({ durationMs: 60 }))).toBeNull();
  });
});

describe('an unmistakable horizontal swipe turns exactly one page', () => {
  it('a fast leftward swipe turns next', () => {
    expect(
      classifyPageTurnGesture(gesture({ endX: 70, endY: 412 })),
    ).toBe('next');
  });

  it('a fast rightward swipe turns prev', () => {
    expect(
      classifyPageTurnGesture(gesture({ endX: 330, endY: 388 })),
    ).toBe('prev');
  });

  it('a swipe at the exact thresholds still counts', () => {
    expect(
      classifyPageTurnGesture(
        gesture({
          endX: 200 - SWIPE_MIN_PX,
          endY: 400 + SWIPE_MIN_PX / SWIPE_DOMINANCE_RATIO,
          durationMs: SWIPE_MAX_DURATION_MS,
        }),
      ),
    ).toBe('next');
  });

  it('one pixel under the dominance ratio does not count', () => {
    const dy = 50;
    expect(
      classifyPageTurnGesture(
        gesture({
          endX: 200 - (SWIPE_DOMINANCE_RATIO * dy - 1),
          endY: 400 + dy,
        }),
      ),
    ).toBeNull();
  });
});

describe('wiring the classifier depends on (source shape)', () => {
  const book = readFileSync(join(here, 'GrimoireBook.tsx'), 'utf8');
  const css = readFileSync(join(here, 'grimoire.module.css'), 'utf8');

  it('GrimoireBook classifies touches through pageTurnGesture, with no legacy threshold left', () => {
    expect(book).toContain('classifyPageTurnGesture');
    expect(book).not.toContain('SWIPE_PX');
    expect(book).toContain('data-grimoire-scroll');
  });

  it('pages scroll internally and cannot chain the scroll to the page', () => {
    expect(css).toContain('.pageScroll');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('touch-action: pan-y');
  });

  it('turn zones are bottom page corners, not full-height edges', () => {
    const zone = css.slice(css.indexOf('.edgeZone {'));
    const block = zone.slice(0, zone.indexOf('}'));
    expect(block).toContain('bottom: 0');
    expect(block).not.toContain('top: 0');
  });

  it('the book tracks reduced motion for its JS lockout, not only in CSS', () => {
    expect(book).toContain('prefers-reduced-motion');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
