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
import { recordInterestNow } from '../../lib/personalization/client';
import { interestForCatalogCategory } from '../../lib/personalization/interests';

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
    // Interest profile (2026-10-14): a product view signals its catalog
    // category's interest. Consent-gated inside recordInterest.
    const interest = interestForCatalogCategory(category);
    if (interest) recordInterestNow(interest, 1);
  }, [productHandle, category]);
  return null;
}
