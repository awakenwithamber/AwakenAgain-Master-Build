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
 * the owner has recorded one — the shipment's carrier tracking number
 * and public carrier link from the append-only tracking ledger
 * (lib/orders/tracking.ts). No address, phone, or notes ever leave the
 * order record through this route.
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
  findLatestTracking,
  toTrackingView,
} from '../../../../lib/orders/tracking';
import {
  findStripePayment,
  resolveOrderStatus,
} from '../../../../lib/payments/stripe';
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

  const tracking = findLatestTracking(order.order_id);
  // Card orders resolve 'paid' from the webhook-written Stripe payment
  // ledger — the only writer of paid state for the embedded checkout.
  const stripePayment =
    order.payment_method === 'stripe_card_embedded'
      ? await findStripePayment(order.order_id)
      : null;

  return NextResponse.json({
    ok: true,
    order: {
      order_id: order.order_id,
      created_at: order.created_at,
      customer_name: order.customer.name,
      /** Order lifecycle — 'pending_payment' until payment is confirmed. */
      status: resolveOrderStatus(order, stripePayment),
      shipping_status: order.shipping_status,
      payment_method: order.payment_method,
      item_count:
        order.items.reduce((n, line) => n + line.quantity, 0) +
        (order.bundle ? 5 : 0),
      total_cents: order.total_cents,
    },
    tracking: tracking ? toTrackingView(tracking) : null,
  });
}
