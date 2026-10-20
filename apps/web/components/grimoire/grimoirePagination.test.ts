/**
 * Grimoire pagination regression suite (benchmark task C3).
 *
 * The punch-list defect, translated to the current book: the book no
 * longer has 8 pages — buildGrimoirePages() builds 16 (title, about,
 * index, 12 herbs, colophon). On MOBILE every page was reachable. On
 * DESKTOP the final page was trapped: at the last spread (base 14) the
 * Next control stayed enabled (atEnd compared page >= maxPage, 14 >= 15
 * is false) and the End key targeted page 15 directly; both produced a
 * turn whose sheet back face index was 15 + 1 = 16 — pages[16] is
 * undefined and PageView throws reading page.kind. These tests pin the
 * fixed rules in grimoirePagination.ts.
 */
import { describe, expect, it } from 'vitest';
import { buildGrimoirePages } from './grimoireContent';
import {
  clampNavigationTarget,
  lastSpreadBase,
  sheetPageIndices,
  spreadBaseFor,
} from './grimoirePagination';

const pages = buildGrimoirePages();
const N = pages.length;

describe('the book under test', () => {
  it('has 16 pages (not the punch list’s 8 — the book was rebuilt)', () => {
    expect(N).toBe(16);
    expect(pages[N - 1].kind).toBe('colophon');
  });
});

describe('desktop navigation (two-page spreads)', () => {
  it('every page is viewable in some reachable spread', () => {
    const viewable = new Set<number>();
    // Walk forward with Next (step 2) exactly as a visitor would.
    let page = 0;
    for (let guard = 0; guard < 40; guard++) {
      const base = spreadBaseFor(page, true);
      viewable.add(base);
      if (base + 1 < N) viewable.add(base + 1);
      const nextTarget = clampNavigationTarget(page + 2, N, true);
      if (nextTarget === page) break;
      page = nextTarget;
    }
    expect([...viewable].sort((a, b) => a - b)).toEqual(
      Array.from({ length: N }, (_, i) => i),
    );
    // …and the walk ends ON the final spread, which shows the last page.
    expect(page).toBe(lastSpreadBase(N, true));
    expect(spreadBaseFor(page, true) + 1).toBe(N - 1);
  });

  it('the final spread is the end: Next there is a no-op target', () => {
    const last = lastSpreadBase(N, true); // 14 for a 16-page book
    expect(last).toBe(14);
    expect(clampNavigationTarget(last + 2, N, true)).toBe(last);
    // The End key asks for the last page; it must land on its spread base.
    expect(clampNavigationTarget(N - 1, N, true)).toBe(last);
  });

  it('an index jump to an odd herb page lands on the spread showing it', () => {
    for (let idx = 0; idx < N; idx++) {
      const target = clampNavigationTarget(idx, N, true);
      const base = spreadBaseFor(target, true);
      expect([base, base + 1]).toContain(idx);
    }
  });

  it('turn-sheet face indices never leave the book (the crash case)', () => {
    // The exact pre-fix crash: forward turn into page 15 on desktop.
    const crash = sheetPageIndices('fwd', 14, 15, true, N);
    expect(crash.backIdx).toBeLessThan(N);
    // Exhaustively: every from/to/dir/mode combination stays in range.
    for (const desktop of [true, false]) {
      for (const dir of ['fwd', 'back'] as const) {
        for (let from = 0; from < N; from++) {
          for (let to = 0; to < N; to++) {
            const { frontIdx, backIdx } = sheetPageIndices(dir, from, to, desktop, N);
            expect(frontIdx).toBeGreaterThanOrEqual(0);
            expect(frontIdx).toBeLessThan(N);
            expect(backIdx).toBeGreaterThanOrEqual(0);
            expect(backIdx).toBeLessThan(N);
            expect(pages[frontIdx]).toBeDefined();
            expect(pages[backIdx]).toBeDefined();
          }
        }
      }
    }
  });
});

describe('mobile navigation (single page)', () => {
  it('targets are unchanged: every page reachable one step at a time', () => {
    for (let idx = 0; idx < N; idx++) {
      expect(clampNavigationTarget(idx, N, false)).toBe(idx);
    }
    expect(lastSpreadBase(N, false)).toBe(N - 1);
  });
});
