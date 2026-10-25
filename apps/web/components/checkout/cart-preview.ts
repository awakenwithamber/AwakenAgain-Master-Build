/**
 * Client-side PREVIEW totals for Amber's Alchemy Apothecary.
 * Display-only: the server recomputes everything authoritatively at
 * checkout (CLIENT=PREVIEW, SERVER=AUTHORITY). These functions mirror the
 * server rule deterministically in integer cents.
 *
 * Shipping rule (owner decision 2026-10-20, superseding 2026-10-10):
 * free at $45+ general, always free for Living Grimoire subscribers;
 * below the threshold a FLAT $5.95 shipping is charged and added to the
 * total. Status vocabulary: FREE / FLAT. This preview mirrors
 * lib/checkout/order.ts (FLAT_SHIPPING_CENTS there is the authority).
 * Sales tax is never previewed here: for card orders Stripe Tax
 * calculates it from the customer's address at payment time.
 */
import { BUNDLE_PRICE_CENTS } from '../../lib/pricing/pricing';
import type { CartItem } from '../../types';
import type { StoredBundle } from './cart-store';

export const FREE_SHIPPING_GENERAL_CENTS = 4500;
export const FREE_SHIPPING_SUBSCRIBER_CENTS = 0;
export const FLAT_SHIPPING_CENTS = 595;

export type ShippingStatus = 'FREE' | 'FLAT';

export interface CartPreview {
  itemsTotalCents: number;
  bundleTotalCents: number;
  subtotalCents: number;
  /** 10% subscriber discount as CLAIMED by the checkbox (server verifies). */
  subscriberDiscountCents: number;
  /**
   * 10% FIRST10 coupon discount as CLAIMED by the Apply button
   * (server validates code + first-time eligibility). Never shown
   * stacked with the subscriber discount — same no-stack rule as the
   * server: when the subscriber box is checked, the coupon preview
   * discount is 0 (the subscriber claim is the discount shown).
   */
  couponDiscountCents: number;
  /** Normalized coupon code the preview applied, or null. */
  couponCode: string | null;
  shippingCents: number;
  shippingStatus: ShippingStatus;
  freeShippingThresholdCents: number;
  totalCents: number;
}

/** The one coupon code the preview recognizes (server is the authority). */
export const COUPON_CODE_FIRST10 = 'FIRST10';

export function normalizeCouponCodePreview(raw: string): string | null {
  const normalized = raw.trim().toUpperCase();
  return normalized ? normalized : null;
}

/**
 * Mirror of the server rule (lib/checkout/order.ts): the membership fee
 * itself is exempt from the 10% subscriber discount.
 */
const SUBSCRIBER_DISCOUNT_EXEMPT_HANDLES: readonly string[] = [
  'grimoire-subscription',
];

export function previewCartTotals(
  items: CartItem[],
  bundle: StoredBundle | null,
  isSubscriber: boolean,
  appliedCouponCode?: string | null,
): CartPreview {
  const itemsTotalCents = items.reduce(
    (sum, item) => sum + item.unit_price_cents * item.quantity,
    0,
  );
  const bundleTotalCents = bundle ? BUNDLE_PRICE_CENTS : 0;
  const subtotalCents = itemsTotalCents + bundleTotalCents;
  // When the subscriber box is checked, the PREVIEW applies the 10%
  // discount as a claim (rounded per the codebase convention,
  // Math.round(cents * 0.9)). The server verifies the claim against the
  // subscription ledger at checkout and recomputes authoritatively — an
  // unverified claim is priced standard there, never blocked.
  const discountableCents =
    items.reduce(
      (sum, item) =>
        sum +
        (SUBSCRIBER_DISCOUNT_EXEMPT_HANDLES.includes(item.product_handle)
          ? 0
          : item.unit_price_cents * item.quantity),
      0,
    ) + bundleTotalCents;
  const subscriberDiscountCents = isSubscriber
    ? discountableCents - Math.round(discountableCents * 0.9)
    : 0;
  // Coupon preview: FIRST10 only, same base + rounding as the server,
  // and NEVER stacked on a subscriber claim (the server applies the
  // larger single discount and explains; both are 10% today).
  const normalizedCoupon = appliedCouponCode
    ? normalizeCouponCodePreview(appliedCouponCode)
    : null;
  const couponCode =
    normalizedCoupon === COUPON_CODE_FIRST10 ? normalizedCoupon : null;
  const couponDiscountCents =
    couponCode !== null && !isSubscriber
      ? discountableCents - Math.round(discountableCents * 0.9)
      : 0;
  const freeShippingThresholdCents = isSubscriber
    ? FREE_SHIPPING_SUBSCRIBER_CENTS
    : FREE_SHIPPING_GENERAL_CENTS;
  const shippingCents =
    subtotalCents >= freeShippingThresholdCents ? 0 : FLAT_SHIPPING_CENTS;
  const shippingStatus: ShippingStatus = shippingCents === 0 ? 'FREE' : 'FLAT';
  return {
    itemsTotalCents,
    bundleTotalCents,
    subtotalCents,
    subscriberDiscountCents,
    couponDiscountCents,
    couponCode,
    shippingCents,
    shippingStatus,
    freeShippingThresholdCents,
    totalCents:
      subtotalCents - subscriberDiscountCents - couponDiscountCents + shippingCents,
  };
}
