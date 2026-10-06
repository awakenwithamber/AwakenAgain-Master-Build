/**
 * Client-side admin view tracking (G12).
 * Mount once per admin page; fires the admin_viewed platform event exactly
 * once per page load. Internal/operations analytics only.
 */
'use client';

import { useEffect, useRef } from 'react';
import { trackPlatformEvent } from '../../lib/analytics/platform-events';

export type AdminSection = 'overview' | 'orders' | 'leads' | 'reviews' | 'broadcast';

export function AdminViewTracker({ section }: { section: AdminSection }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackPlatformEvent('admin_viewed', { section });
  }, [section]);
  return null;
}
