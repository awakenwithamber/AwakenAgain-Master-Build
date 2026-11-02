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
 * Sales tax (owner directive 2026-11-01): previewed HERE with the
 * SAME engine the server uses — calculateSalesTax from lib/tax is
 * imported below, never re-implemented — so a preview shown for a
 * given delivery state and claimed discounts is exactly the figure
 * the server computes for that claim. The engine only reads the
 * delivery STATE for its determination (Utah → the seller's Salt
 * Lake City combined rate; any other state → 0 under the named
 * no-nexus assumption in lib/tax); the full address is collected
 * and validated at checkout. Callers that have no delivery state
 * yet (the cart view) get taxCents 0 and a pre-tax preview total,
 * exactly as before.
 */
import { BUNDLE_PRICE_CENTS } from '../../lib/pricing/pricing';
import { calculateSalesTax } from '../../lib/tax/tax';
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
  /**
   * Sales tax previewed with the shared lib/tax engine for the
   * delivery state passed in (see the header note). 0 when no
   * delivery state was supplied or the state collects no tax.
   */
  taxCents: number;
  /** The engine's rate for the preview ('8.45%' in Utah, '0%' out of state); null when no state was supplied. */
  taxRatePercent: string | null;
  /** Normalized delivery state the tax preview was computed for, or null. */
  taxDeliveryState: string | null;
  totalCents: number;
}

/** The delivery-address slice the tax preview needs: just the state. */
export interface PreviewDeliveryAddress {
  state?: string | null;
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
  deliveryAddress?: PreviewDeliveryAddress | null,
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
  // Sales tax preview — the SHARED engine (lib/tax), the exact call
  // the server makes for the same claim: merchandise lines at the
  // general rate, the claimed discount as a negative line, shipping
  // passed separately (never in the base). Only the entered delivery
  // state is meaningful pre-submission; the address fields the
  // engine echoes back are placeholders here and are discarded.
  const deliveryState =
    typeof deliveryAddress?.state === 'string'
      ? deliveryAddress.state.trim().toUpperCase()
      : '';
  const claimedDiscountCents = subscriberDiscountCents + couponDiscountCents;
  const tax =
    deliveryState.length === 2
      ? calculateSalesTax({
          destination: {
            line1: '',
            city: '',
            state: deliveryState,
            postalCode: '',
            country: 'US',
          },
          lines: [
            ...items.map((item) => ({
              description: item.product_handle,
              amountCents: item.unit_price_cents * item.quantity,
              taxable: true,
              category: 'merchandise',
            })),
            ...(bundle
              ? [
                  {
                    description: 'bundle',
                    amountCents: bundleTotalCents,
                    taxable: true,
                    category: 'merchandise',
                  },
                ]
              : []),
            ...(claimedDiscountCents > 0
              ? [
                  {
                    description: 'Discounts (subscriber / coupon)',
                    amountCents: -claimedDiscountCents,
                    taxable: true,
                    category: 'discount',
                  },
                ]
              : []),
          ],
          shippingCents,
        })
      : null;
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
    taxCents: tax?.taxCents ?? 0,
    taxRatePercent: tax?.ratePercent ?? null,
    taxDeliveryState: tax ? deliveryState : null,
    totalCents:
      subtotalCents -
      subscriberDiscountCents -
      couponDiscountCents +
      shippingCents +
      (tax?.taxCents ?? 0),
  };
}
