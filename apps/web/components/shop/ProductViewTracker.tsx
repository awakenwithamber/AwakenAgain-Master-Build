/**
 * ProductViewTracker — client island for the server-rendered product detail
 * page (app/shop/[slug]).
 *
 * Fires a single `product_viewed` event per page mount (discovery →
 * product view), keyed by product handle via trackOnce so StrictMode and
 * re-renders can't double-fire. Renders nothing.
 */
'use client';

import { useEffect } from 'react';
import { trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';

export function ProductViewTracker({
  productHandle,
  category,
}: {
  productHandle: string;
  category?: string;
}) {
  useEffect(() => {
    trackOnce(
      `product_viewed_${productHandle}`,
      ANALYTICS_EVENT_NAMES.productViewed,
      { product_handle: productHandle, category },
    );
  }, [productHandle, category]);
  return null;
}
