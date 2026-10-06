/**
 * Legacy SPA anchor → Next.js route bridge (G14 SEO work, client-side).
 *
 * Browsers never send '#fragment' to the server, so legacy inbound links
 * like awakenagain.com/#shop or awakenagain.com/#checkout can never be
 * caught by middleware. This component reads the hash on first load and
 * replaces it with the real route from resolveLegacyAnchor().
 *
 * NOT YET MOUNTED: mounting requires an edit to app/layout.tsx, which is
 * coordinator-owned (this workstream may not modify it). The anchor map and
 * resolver are tested in lib/seo/redirects.test.ts; mount this component in
 * the root layout (inside <body>) to activate.
 *
 * Behavior: silent replace (no history entry), only when the hash resolves
 * to a mapped route. Unmapped anchors (content routes not yet built, G7)
 * are left alone — never pointed at a page that does not exist.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveLegacyAnchor } from '../../lib/seo/redirects';

export function LegacyAnchorRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash) return;
    const destination = resolveLegacyAnchor(hash);
    if (destination) {
      router.replace(destination);
    }
  }, [router]);

  return null;
}
