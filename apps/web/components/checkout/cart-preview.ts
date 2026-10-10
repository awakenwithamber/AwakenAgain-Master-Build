/**
 * Client-side PREVIEW totals for Amber's Alchemy Apothecary.
 * Display-only: the server recomputes everything authoritatively at
 * checkout (CLIENT=PREVIEW, SERVER=AUTHORITY). These functions mirror the
 * server rule deterministically in integer cents.
 *
 * Shipping rule (owner-confirmed 2026-10-10): free at $45+ general,
 * always free for Living Grimoire subscribers. Below threshold there is no
 * flat rate established in source — shipping is confirmed with the
 * customer before fulfillment and NOT added to the order total.
 * Status vocabulary: FREE / TO_BE_CONFIRMED.
 */
import { BUNDLE_PRICE_CENTS } from '../../lib/pricing/pricing';
import type { CartItem } from '../../types';
import type { StoredBundle } from './cart-store';

export const FREE_SHIPPING_GENERAL_CENTS = 10000;
export const FREE_SHIPPING_SUBSCRIBER_CENTS = 7500;

export type ShippingStatus = 'FREE' | 'TO_BE_CONFIRMED';

export interface CartPreview {
  itemsTotalCents: number;
  bundleTotalCents: number;
  subtotalCents: number;
  shippingCents: number;
  shippingStatus: ShippingStatus;
  freeShippingThresholdCents: number;
  totalCents: number;
}

export function previewCartTotals(
  items: CartItem[],
  bundle: StoredBundle | null,
  isSubscriber: boolean,
): CartPreview {
  const itemsTotalCents = items.reduce(
    (sum, item) => sum + item.unit_price_cents * item.quantity,
    0,
  );
  const bundleTotalCents = bundle ? BUNDLE_PRICE_CENTS : 0;
  const subtotalCents = itemsTotalCents + bundleTotalCents;
  const freeShippingThresholdCents = isSubscriber
    ? FREE_SHIPPING_SUBSCRIBER_CENTS
    : FREE_SHIPPING_GENERAL_CENTS;
  const shippingStatus: ShippingStatus =
    subtotalCents >= freeShippingThresholdCents ? 'FREE' : 'TO_BE_CONFIRMED';
  return {
    itemsTotalCents,
    bundleTotalCents,
    subtotalCents,
    shippingCents: 0,
    shippingStatus,
    freeShippingThresholdCents,
    totalCents: subtotalCents,
  };
}
