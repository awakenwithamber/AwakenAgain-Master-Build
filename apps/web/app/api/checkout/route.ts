/**
 * Checkout Route Handler — SERVER AUTHORITY.
 *
 * CLIENT = PREVIEW, SERVER = AUTHORITY: every total is recomputed server-side
 * (lib/checkout/order, from canonical data in lib/pricing + lib/cart).
 * Any client-supplied total or unit price that mismatches the server
 * computation is REJECTED.
 *
 * Subscriber benefits (free shipping with no minimum + the 10% storewide
 * discount) are NEVER granted on the client's is_subscriber boolean alone:
 * the claim is verified here against the subscription ledger
 * (lib/subscriptions/entitlement) before pricing. An unverified claim is
 * priced standard and does not block the order.
 *
 * On success: an order record is created with a generated order ID and
 * appended to the local JSONL ledger (reversible; production persistence is
 * Supabase — UNDECIDED, NEEDS VERIFICATION). Payment follows the owner's
 * decisions (2026-10-13 + 2026-10-19): Cash App + Venmo handles; card via
 * the embedded Stripe checkout (primary card path — the order is recorded
 * UNPAID here, a session is bound by POST /api/stripe/checkout-session,
 * and only the signature-verified webhook marks it paid); or — as the
 * backup card path — an emailed Bookipi invoice (Bookipi has no public
 * API; the owner sends the invoice from her own account and the order
 * waits under the same owner-confirmation gate). The response
 * instructions always match the method recorded on the order. On success
 * a purchase_confirmation email job is also queued for the customer
 * (lib/jobs/order-confirmation — Resend when RESEND_API_KEY is set,
 * logging provider otherwise).
 *
 * NOTE: only HTTP handlers and route config may be exported from a route
 * module — validateAndBuildOrder lives in lib/checkout/order.ts (imported
 * here and by the regression tests).
 */
import { NextResponse } from 'next/server';
import {
  CASH_APP_HANDLE,
  VENMO_HANDLE,
  validateAndBuildOrder,
  type OrderRecord,
} from '../../../lib/checkout/order';
import { createOrderStore } from '../../../lib/orders/store';
import { queueOrderConfirmation } from '../../../lib/jobs/order-confirmation';
import { enforceRateLimit } from '../../../lib/security/rate-limit';
import { isEntitledSubscriber } from '../../../lib/subscriptions/entitlement';
import {
  captureServerEventSoon,
  resolveServerDistinctId,
} from '../../../lib/analytics/posthog-server';
import { ANALYTICS_EVENT_NAMES } from '../../../lib/analytics/events';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Subscriber entitlement for this order: the client checkbox is only a
 * claim — benefits require a server-held subscription record for the
 * order email with an entitled status (lib/subscriptions/entitlement).
 * Read from the raw body because validateAndBuildOrder owns sanitization;
 * the lookup normalizes (trim + lowercase) the same way.
 */
function verifySubscriberClaim(body: unknown): boolean {
  if (!isRecord(body) || body.is_subscriber !== true) return false;
  const customer = isRecord(body.customer) ? body.customer : undefined;
  return isEntitledSubscriber(customer?.email);
}

/**
 * Durable persistence through the provider-neutral store interface
 * (lib/orders/store.ts) — the same contract the order-intake pipeline
 * (POST /api/orders) uses. Local JSONL today; a future implementation
 * satisfies the same interface without touching this handler.
 */
function persistOrder(record: OrderRecord) {
  return createOrderStore().append(record);
}

/**
 * Payment instructions for the method recorded on the order. The
 * Cash App / Venmo shape is unchanged from the original flow. The card
 * shape carries NO handles: the customer will be emailed a secure
 * Bookipi invoice referencing this order, at the email they ordered
 * with, and the order is prepared once that invoice is paid.
 */
function paymentInstructions(record: OrderRecord) {
  if (record.payment_method === 'stripe_card_embedded') {
    return {
      method: record.payment_method,
      order_id: record.order_id,
      note:
        'You chose to pay by card. Your order is placed and in review — ' +
        'complete your card payment in the secure embedded checkout on ' +
        'this page. Your order is prepared once payment is confirmed.',
    };
  }
  if (record.payment_method === 'bookipi_card_invoice') {
    return {
      method: record.payment_method,
      order_id: record.order_id,
      invoice_email: record.customer.email,
      note:
        'You chose to pay by card. We will email you a secure Bookipi ' +
        'invoice for this order — just follow the link in that email to ' +
        'pay by credit or debit card. Your order is prepared once the ' +
        'invoice is paid, and Amber confirms every order personally ' +
        'before fulfillment.',
    };
  }
  return {
    method: record.payment_method,
    cash_app: CASH_APP_HANDLE,
    venmo: VENMO_HANDLE,
    note:
      'Send your payment with Cash App or Venmo — whichever you prefer. ' +
      'Amber confirms every order personally before fulfillment.',
  };
}

/* ------------------------------------------------------------------ */
/* Route handler                                                        */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }

  let record: OrderRecord;
  try {
    record = validateAndBuildOrder(body, {
      isSubscriberVerified: verifySubscriberClaim(body),
    });
  } catch (err) {
    return fail([err instanceof Error ? err.message : 'Invalid order.']);
  }

  try {
    await persistOrder(record);
  } catch (err) {
    return fail(
      [
        `Order validated but could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }. Please contact Amber directly.`,
      ],
      500,
    );
  }

  // Order-confirmation email job — queued exactly once per accepted
  // order, after persistence (trigger wired 2026-10-19; before this, the
  // purchase_confirmation contract existed but no route ever queued one).
  // Fire-and-forget with a catch: email can never fail or delay an
  // accepted order. Delivery is real when RESEND_API_KEY is set
  // (Resend provider), and a recorded no-send otherwise.
  void queueOrderConfirmation(record).catch(() => {
    // Intentionally swallowed — the ledger is the order system of record.
  });

  // Authoritative order event (server-owned, exactly once per accepted
  // order). Observational only — the persisted ledger above is the truth.
  // Fire-and-forget: order acceptance never waits on analytics. Fully
  // inert until NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set (WIRED, BLOCKED
  // on the owner's phc_ key). Payload: order_id/total_cents/item_count only.
  captureServerEventSoon(
    ANALYTICS_EVENT_NAMES.orderCreated,
    {
      order_id: record.order_id,
      total_cents: record.total_cents,
      item_count:
        record.items.reduce((n, line) => n + line.quantity, 0) +
        (record.bundle ? 5 : 0),
    },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `order:${record.order_id}`,
    ),
  );

  return NextResponse.json({
    ok: true,
    order_id: record.order_id,
    subtotal_cents: record.subtotal_cents,
    subscriber_discount_cents: record.subscriber_discount_cents,
    is_subscriber_verified: record.is_subscriber_verified,
    shipping_status: record.shipping_status,
    total_cents: record.total_cents,
    payment_method: record.payment_method,
    payment: paymentInstructions(record),
  });
}
