/**
 * Owner order tracking entry — POST /api/admin/orders/tracking.
 *
 * Records the carrier tracking number for a shipped order as an
 * APPEND-ONLY event in the tracking ledger (lib/orders/tracking.ts). The
 * order record itself is never mutated — checkout's ledger stays exactly
 * as the checkout server wrote it; the customer order-status view joins
 * the two at read time and shows the latest tracking event.
 *
 * BRIDGE AUTH — the shared owner-secret check (lib/admin/owner-auth.ts),
 * identical contract to POST /api/admin/subscriptions/confirm:
 * - `OWNER_ADMIN_SECRET` unset/empty → 404, nothing changes.
 * - Wrong/absent secret → 401, nothing changes.
 * - The secret and the header value are NEVER logged.
 * Rate-limited first, on the STRICT 'admin' group (failed-auth guessing
 * is throttled before any auth work happens).
 *
 * Semantics: an unknown order id creates NOTHING (404). Re-recording the
 * SAME carrier + number for an order is a 200 no-op (idempotent); a
 * different number appends a superseding event (201) and the latest one
 * is what customers see.
 *
 * SERVER-ONLY: reads a server env secret and the filesystem ledgers.
 * Never import from a client component.
 */
import { NextResponse } from 'next/server';
import { isRecord, sanitizePlainText } from '../../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../../lib/security/rate-limit';
import { ownerAuthorized } from '../../../../../lib/admin/owner-auth';
import { defaultOrderStore } from '../../../../../lib/stores/order-store';
import {
  appendTrackingEvent,
  buildTrackingEvent,
  findLatestTrackingAsync,
  sanitizeCarrier,
  sanitizeTrackingNumber,
  toTrackingView,
  DEFAULT_TRACKING_CARRIER,
  type OrderTrackingEvent,
} from '../../../../../lib/orders/tracking';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** Append-only ledger write — driver-aware, as the subscription routes. */
async function persistTrackingEvent(event: OrderTrackingEvent): Promise<void> {
  await appendTrackingEvent(event);
}

/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  // Strict per-IP budget (lib/security/rate-limit): caps failed-auth
  // guessing against the owner secret before any auth work happens.
  const limited = enforceRateLimit(request, 'admin');
  if (limited) return limited;

  const auth = ownerAuthorized(request);
  if (auth === 'unconfigured') {
    // Fail closed: with no secret configured this route does not exist.
    return fail(['Not found.'], 404);
  }
  if (auth === 'denied') {
    return fail(['Unauthorized.'], 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.']);
  }
  if (!isRecord(body)) {
    return fail(['Request body must be a JSON object.']);
  }

  const orderIdInput = sanitizePlainText(body.order_id, 64);
  if (!orderIdInput) {
    return fail(['An order ID is required.']);
  }
  const trackingNumber = sanitizeTrackingNumber(body.tracking_number);
  if (!trackingNumber) {
    return fail([
      'A valid tracking number is required (6–64 letters, digits, or dashes).',
    ]);
  }
  // Carrier is optional — USPS by default. A present-but-unknown carrier
  // is rejected rather than guessed.
  const carrier =
    body.carrier === undefined
      ? DEFAULT_TRACKING_CARRIER
      : sanitizeCarrier(body.carrier);
  if (!carrier) {
    return fail(['Carrier must be one of: usps, ups, fedex, dhl.']);
  }

  // The order must exist in the order ledger. IDs are matched
  // case-insensitively for typing convenience; the event records the
  // ledger's canonical id so read-side joins are exact.
  const orders = await defaultOrderStore().listOrders({ limit: 1000 });
  const order = orders.find(
    (o) => o.order_id.toLowerCase() === orderIdInput.toLowerCase(),
  );
  if (!order) {
    return fail([`No order found with ID ${orderIdInput}.`], 404);
  }

  const existing = await findLatestTrackingAsync(order.order_id);
  if (
    existing &&
    existing.carrier === carrier &&
    existing.tracking_number === trackingNumber
  ) {
    // Idempotent: this exact tracking is already the latest event.
    return NextResponse.json({
      ok: true,
      order_id: order.order_id,
      already_recorded: true,
      tracking: toTrackingView(existing),
    });
  }

  const event = buildTrackingEvent({
    order_id: order.order_id,
    carrier,
    tracking_number: trackingNumber,
  });
  try {
    await persistTrackingEvent(event);
  } catch (err) {
    return fail(
      [
        `Tracking could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }.`,
      ],
      500,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      order_id: order.order_id,
      already_recorded: false,
      tracking: toTrackingView(event),
    },
    { status: 201 },
  );
}
