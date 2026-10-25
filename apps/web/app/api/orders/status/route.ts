/**
 * Customer order status lookup — POST /api/orders/status.
 *
 * The customer side of order tracking (Phase 2). Until now the site had
 * NO order-status view: checkout ends at a static confirmation page.
 * This lookup is deliberately narrow — it answers only when the caller
 * presents BOTH the order ID and the exact email the order was placed
 * with, and every failure (unknown ID, mismatched email) returns the
 * same generic 404, so the endpoint cannot be used to enumerate orders
 * or probe which emails ordered what.
 *
 * Response is a minimal summary (status, totals, item count) plus — once
 * the owner has recorded them — the payment confirmation and the
 * shipment's carrier tracking number and public carrier link from the
 * append-only tracking ledger (lib/orders/tracking.ts). Payment state
 * itself resolves through the ONE shared resolver
 * (lib/orders/paid-state.ts — audit G-5): BOTH the owner-confirmed
 * manual payment ledger (lib/orders/payments.ts) and the
 * webhook-written Stripe payment ledger (lib/payments/stripe.ts) are
 * checked for every order, and a recorded Stripe refund/dispute
 * transition supersedes 'paid'. No address, phone, or notes ever leave
 * the order record through this route.
 *
 * Rate-limited on the 'orders' group (moderate): a human checking a
 * parcel uses this a handful of times; scripted probing is throttled.
 */
import { NextResponse } from 'next/server';
import {
  isRecord,
  sanitizeEmail,
  sanitizePlainText,
} from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { defaultOrderStore } from '../../../../lib/stores/order-store';
import {
  findLatestTrackingAsync,
  toTrackingView,
} from '../../../../lib/orders/tracking';
import { resolveOrderPaidState } from '../../../../lib/orders/paid-state';
import { normalizeSubscriptionEmail } from '../../../../lib/subscriptions/entitlement';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** One message for every miss — unknown ID and wrong email look identical. */
const NOT_FOUND = 'No order matches that order ID and email.';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'orders');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }
  if (!isRecord(body)) {
    return fail(['Request body must be a JSON object.']);
  }

  const orderId = sanitizePlainText(body.order_id, 64);
  if (!orderId) {
    return fail(['Your order ID is required.']);
  }
  const email = sanitizeEmail(body.email);
  if (!email) {
    return fail(['A valid email address is required.']);
  }

  const orders = await defaultOrderStore().listOrders({ limit: 1000 });
  const order = orders.find(
    (o) => o.order_id.toLowerCase() === orderId.toLowerCase(),
  );
  if (
    !order ||
    normalizeSubscriptionEmail(order.customer.email) !== email
  ) {
    return fail([NOT_FOUND], 404);
  }

  const tracking = await findLatestTrackingAsync(order.order_id);
  // ONE shared paid-state resolver (lib/orders/paid-state.ts): both
  // paid ledgers are checked for every order regardless of its
  // recorded payment method, and a Stripe refund/dispute transition
  // supersedes 'paid'.
  const paidState = await resolveOrderPaidState(order);

  return NextResponse.json({
    ok: true,
    order: {
      order_id: order.order_id,
      created_at: order.created_at,
      customer_name: order.customer.name,
      /**
       * Order lifecycle — 'pending_payment' until payment is confirmed:
       * by the owner's append-only confirmation event (any method) or
       * by the verified Stripe webhook; a verified refund/dispute
       * event moves a paid order to 'refunded' / 'disputed'. The
       * state is joined at read time, never an edit to the order
       * record (audit 2026-10-15 GAP-1, Stage 1 G-4/G-5).
       */
      status: paidState.status,
      payment_confirmed_at: paidState.payment_confirmed_at,
      shipping_status: order.shipping_status,
      payment_method: order.payment_method,
      item_count:
        order.items.reduce((n, line) => n + line.quantity, 0) +
        (order.bundle ? 5 : 0),
      subtotal_cents: order.subtotal_cents,
      subscriber_discount_cents: order.subscriber_discount_cents,
      coupon_code: order.coupon_code ?? null,
      coupon_discount_cents: order.coupon_discount_cents ?? 0,
      total_cents: order.total_cents,
    },
    tracking: tracking ? toTrackingView(tracking) : null,
  });
}
