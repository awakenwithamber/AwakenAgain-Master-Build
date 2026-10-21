/**
 * Shared paid-state resolver — the ONE read path for "is this order
 * paid, and if not, what is it?" (Stage 1, audit G-5).
 *
 * Before this module each surface joined a different subset of the
 * payment ledgers, so the same order could read differently in
 * different places:
 * - the public order-status route joined the manual (owner-confirmed)
 *   ledger AND the Stripe webhook ledger, but only looked at Stripe
 *   for orders whose recorded method was 'stripe_card_embedded';
 * - the account profile joined ONLY the manual ledger, so a
 *   Stripe-webhook-paid order showed "Awaiting payment" there;
 * - the admin orders page joined ONLY the manual ledger, so a
 *   Stripe-webhook-paid order showed "Awaiting payment" there too;
 * - the checkout return page joined ONLY the Stripe ledger.
 *
 * This resolver checks BOTH paid ledgers for EVERY order, regardless
 * of the payment method recorded on it, plus the Stripe refund /
 * dispute transition ledger (lib/payments/stripe.ts, audit G-4):
 *
 *   1. A refund/dispute transition exists → 'refunded' / 'disputed'
 *      (latest transition wins; a transitioned order is never still
 *      shown as 'paid').
 *   2. Else a Stripe payment record OR an owner-confirmed manual
 *      payment event exists → 'paid'.
 *   3. Else the order record's own stored status, or
 *      'pending_payment' when it carries none (checkout never writes
 *      a status onto the records it persists).
 *
 * Paid state remains a READ-TIME JOIN: no order record is ever
 * mutated. Every customer/admin surface that displays order payment
 * state resolves it through here — the async entry point for single
 * orders, the pure fold for bulk surfaces that already hold the
 * ledger reads.
 *
 * SERVER-ONLY: reads the ledgers (node:fs / Postgres). Never import
 * from a client component.
 */
import type { OrderRecord, OrderStatus } from '../checkout/order';
import { findLatestPaymentAsync, type OrderPaymentEvent } from './payments';
import {
  findLatestStripeOrderStatus,
  findStripePayment,
  type StripeOrderStatusEvent,
  type StripePaymentRecord,
} from '../payments/stripe';

export type { OrderStatus };

export interface OrderPaidState {
  status: OrderStatus;
  /** True only while the order currently stands paid (not refunded/disputed). */
  is_paid: boolean;
  /** Which ledger(s) proved payment; null when unpaid/transitioned without payment proof. */
  paid_via: 'stripe' | 'manual' | 'both' | null;
  /**
   * When payment was confirmed: the manual confirmation time when a
   * manual event exists (the status route's historical preference),
   * otherwise the Stripe paid time; null when never paid.
   */
  payment_confirmed_at: string | null;
  stripe_payment: StripePaymentRecord | null;
  manual_payment: OrderPaymentEvent | null;
  /** Latest refund/dispute transition, when one exists. */
  status_event: StripeOrderStatusEvent | null;
}

/** The ledger evidence for one order, as the pure fold consumes it. */
export interface PaidStateEvidence {
  stripePayment: StripePaymentRecord | null;
  manualPayment: OrderPaymentEvent | null;
  statusEvent: StripeOrderStatusEvent | null;
}

/**
 * Pure fold: order record + ledger evidence → display state.
 * Bulk surfaces (admin orders) read the ledgers once, build per-order
 * evidence, and fold with this; single-order surfaces use
 * resolveOrderPaidState(), which fetches the same evidence.
 */
export function resolvePaidStateFromEvidence(
  order: Pick<OrderRecord, 'status'>,
  evidence: PaidStateEvidence,
): OrderPaidState {
  const { stripePayment, manualPayment, statusEvent } = evidence;
  const paidVia: OrderPaidState['paid_via'] = stripePayment && manualPayment
    ? 'both'
    : stripePayment
      ? 'stripe'
      : manualPayment
        ? 'manual'
        : null;
  const paymentConfirmedAt =
    manualPayment?.recorded_at ?? stripePayment?.paid_at ?? null;

  if (statusEvent) {
    return {
      status: statusEvent.status,
      is_paid: false,
      paid_via: paidVia,
      payment_confirmed_at: paymentConfirmedAt,
      stripe_payment: stripePayment,
      manual_payment: manualPayment,
      status_event: statusEvent,
    };
  }
  if (stripePayment || manualPayment) {
    return {
      status: 'paid',
      is_paid: true,
      paid_via: paidVia,
      payment_confirmed_at: paymentConfirmedAt,
      stripe_payment: stripePayment,
      manual_payment: manualPayment,
      status_event: null,
    };
  }
  return {
    status: order.status ?? 'pending_payment',
    is_paid: order.status === 'paid',
    paid_via: null,
    payment_confirmed_at: null,
    stripe_payment: null,
    manual_payment: null,
    status_event: null,
  };
}

/**
 * Resolve one order's paid state from BOTH paid ledgers plus the
 * refund/dispute transition ledger — regardless of the payment
 * method recorded on the order.
 */
export async function resolveOrderPaidState(
  order: OrderRecord,
): Promise<OrderPaidState> {
  const [stripePayment, manualPayment, statusEvent] = await Promise.all([
    findStripePayment(order.order_id),
    findLatestPaymentAsync(order.order_id),
    findLatestStripeOrderStatus(order.order_id),
  ]);
  return resolvePaidStateFromEvidence(order, {
    stripePayment,
    manualPayment: manualPayment ?? null,
    statusEvent,
  });
}
