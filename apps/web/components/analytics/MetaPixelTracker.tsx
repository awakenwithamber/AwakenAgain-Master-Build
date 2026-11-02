/**
 * MetaPixelTracker — client island mounted once in the root layout.
 *
 * Fires the Meta pixel PageView on route changes (App Router). Renders
 * nothing and is fully inert unless NEXT_PUBLIC_META_PIXEL_ID is set
 * AND the visitor has accepted analytics consent — both gates live in
 * lib/analytics/meta-pixel.ts; this component only translates router
 * and consent-change signals into track calls.
 *
 * One PageView per pathname: a ref guard keeps StrictMode double
 * effects, re-renders, and back-navigation to the same path from
 * double-firing within the page session. When consent is granted
 * mid-session, the consent-changed event re-runs the evaluation so the
 * landing page's PageView is not lost.
 */
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackMetaPageView } from '../../lib/analytics/meta-pixel';
import { CONSENT_CHANGED_EVENT } from '../../lib/personalization/client';

export function MetaPixelTracker() {
  const pathname = usePathname();
  const lastFiredPath = useRef<string | null>(null);

  useEffect(() => {
    const evaluate = () => {
      if (!pathname || lastFiredPath.current === pathname) return;
      // trackMetaPageView returns false (and fires nothing) while the
      // pixel is unconfigured or consent is not accepted — only a real
      // dispatch marks the path as fired.
      if (trackMetaPageView()) lastFiredPath.current = pathname;
    };
    evaluate();
    window.addEventListener(CONSENT_CHANGED_EVENT, evaluate);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, evaluate);
  }, [pathname]);

  return null;
}
