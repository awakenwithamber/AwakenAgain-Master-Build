/**
 * Interest accrual island (owner spec 2026-10-14): mount on a section
 * page to record that the visitor engaged with that interest. Renders
 * nothing. The accrual itself is consent-gated inside
 * lib/personalization/interests.ts — without acceptance this is a no-op.
 * Fires once per mount, keyed in sessionStorage so re-renders and
 * StrictMode can't double-count a single page view.
 */
'use client';

import { useEffect } from 'react';
import { recordInterestNow } from '../../lib/personalization/client';
import type { InterestCategory } from '../../lib/personalization/interests';

export function InterestTracker({
  category,
  points = 1,
  signalKey,
}: {
  category: InterestCategory;
  points?: number;
  /** Stable per-page key so one page view counts once per session. */
  signalKey: string;
}) {
  useEffect(() => {
    const key = `aa_interest_signal_${signalKey}`;
    try {
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* fall through — a rare double count beats a crash */
    }
    recordInterestNow(category, points);
  }, [category, points, signalKey]);
  return null;
}
