/**
 * Page-turn gesture classification — PROJECT 1 FIX (2026-10-20, owner-approved).
 *
 * Pure helper extracted from GrimoireBook so the rule can be unit-tested
 * (this repo's vitest setup cannot import JSX components).
 *
 * The defect this replaces: the old handler recorded only the touch's X
 * coordinate and turned the page whenever |dx| exceeded 48px. A normal
 * vertical read-scroll drifts sideways by more than that before lift-off,
 * so readers lost their page mid-scroll — and because pages had
 * `overflow: hidden` (no internal scroll at all), touch-dragging was the
 * only thing a reader could do to try to reach clipped text.
 *
 * The rule now (Master Directive, Project 1): vertical scrolling inside a
 * page must NEVER turn a page. A touch turns a page only when it is an
 * unmistakable horizontal swipe:
 *   - at least SWIPE_MIN_PX of horizontal travel,
 *   - horizontal travel at least SWIPE_DOMINANCE_RATIO × the vertical
 *     travel (a diagonal or vertical-dominant gesture is a scroll),
 *   - completed within SWIPE_MAX_DURATION_MS (a slow drag is a scroll or
 *     a selection, not a swipe),
 *   - and the page content under the touch did not actually scroll during
 *     the gesture (contentScrolled — measured by the component from the
 *     scroll region's scrollTop before/after).
 * Anything else returns null: no turn. Arrows, the designated page corner,
 * and keyboard navigation remain the always-available intentional paths.
 */

/** Minimum horizontal travel (px) for a touch to count as a swipe. */
export const SWIPE_MIN_PX = 72;

/** Horizontal travel must be at least this multiple of vertical travel. */
export const SWIPE_DOMINANCE_RATIO = 2;

/** A swipe is a flick, not a drag: maximum gesture duration (ms). */
export const SWIPE_MAX_DURATION_MS = 600;

export interface PageTurnGestureInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Milliseconds between touchstart and touchend. */
  durationMs: number;
  /**
   * True when the scrollable page content the touch started in changed its
   * scrollTop during the gesture — i.e. the reader was scrolling, whatever
   * the finger's path looked like.
   */
  contentScrolled: boolean;
}

export type PageTurnIntent = 'next' | 'prev' | null;

/**
 * Classify a completed touch gesture. Returns 'next' for a leftward
 * swipe, 'prev' for a rightward swipe, and null for everything else —
 * every scroll, drag, tap, and ambiguous gesture included.
 */
export function classifyPageTurnGesture(
  input: PageTurnGestureInput,
): PageTurnIntent {
  if (input.contentScrolled) return null;

  const { startX, startY, endX, endY, durationMs } = input;
  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY) ||
    !Number.isFinite(durationMs)
  ) {
    return null;
  }
  if (durationMs < 0 || durationMs > SWIPE_MAX_DURATION_MS) return null;

  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < SWIPE_MIN_PX) return null;
  if (Math.abs(dx) < SWIPE_DOMINANCE_RATIO * Math.abs(dy)) return null;

  return dx < 0 ? 'next' : 'prev';
}
