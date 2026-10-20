/**
 * Grimoire pagination math — pure helpers extracted from GrimoireBook so
 * the navigation rules can be unit-tested (this repo's vitest setup cannot
 * import JSX components; see components/layout/Header.test.ts header).
 *
 * The rule that fixes the "last page" defect: on desktop the book shows a
 * two-page spread, so every navigation TARGET is a spread base (an even
 * page index) — never the odd right-hand page itself. Targeting the final
 * page index directly (old behaviour for Next-at-the-end and the End key)
 * made the turn sheet compute backIdx = target + 1 = pages.length, i.e.
 * pages[pages.length] === undefined, and PageView threw on page.kind.
 */

export type TurnDir = 'fwd' | 'back';

/** Index of the left page of the spread that displays `pageIndex`. */
export function spreadBaseFor(pageIndex: number, isDesktop: boolean): number {
  if (!isDesktop) return pageIndex;
  return Math.floor(pageIndex / 2) * 2;
}

/** Spread base of the final spread — the largest valid navigation target. */
export function lastSpreadBase(pageCount: number, isDesktop: boolean): number {
  return spreadBaseFor(pageCount - 1, isDesktop);
}

/**
 * Normalize a requested page target into a valid navigation target:
 * clamped to the book, and on desktop snapped down to its spread base so
 * the target spread displays the requested page (as its right page when
 * the request was for an odd index).
 */
export function clampNavigationTarget(
  target: number,
  pageCount: number,
  isDesktop: boolean,
): number {
  const clamped = Math.max(0, Math.min(pageCount - 1, Math.round(target)));
  return spreadBaseFor(clamped, isDesktop);
}

/**
 * Page indices shown on the turning sheet's two faces. Formulas preserve
 * GrimoireBook's original geometry; the clamp is a defensive guarantee
 * that a face index can never leave the book, whatever the caller passes.
 */
export function sheetPageIndices(
  dir: TurnDir,
  from: number,
  to: number,
  isDesktop: boolean,
  pageCount: number,
): { frontIdx: number; backIdx: number } {
  const clampIdx = (i: number) => Math.max(0, Math.min(pageCount - 1, i));
  const frontIdx = dir === 'fwd' ? (isDesktop ? from + 1 : from) : from;
  const backIdx = dir === 'fwd' ? (isDesktop ? to + 1 : to) : to;
  return { frontIdx: clampIdx(frontIdx), backIdx: clampIdx(backIdx) };
}
