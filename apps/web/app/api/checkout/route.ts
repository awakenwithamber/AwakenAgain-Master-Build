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
 * Supabase — UNDECIDED, NEEDS VERIFICATION). Payment instructions return
 * Cash App + Venmo ONLY, per the owner's payment directive. No other payment
 * provider appears in code, imports, or copy anywhere in this app.
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

function paymentInstructions() {
  return {
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
    payment: paymentInstructions(),
  });
}
