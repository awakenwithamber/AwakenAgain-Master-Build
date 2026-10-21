/**
 * Owner order payment confirmation — POST /api/admin/orders/payment.
 *
 * The missing half of the order lifecycle (audit 2026-10-15 GAP-1):
 * subscriptions had an owner confirm loop, orders never left
 * 'pending_payment'. This route records the owner's confirmation that an
 * order's payment ARRIVED — as an APPEND-ONLY event in the payment
 * ledger (lib/orders/payments.ts). The order record itself is never
 * mutated; the customer order-status view and the admin orders table
 * join the latest payment event at read time and show the order as paid.
 *
 * BRIDGE AUTH — the shared owner-secret check (lib/admin/owner-auth.ts),
 * identical contract to POST /api/admin/orders/tracking and
 * POST /api/admin/subscriptions/confirm:
 * - `OWNER_ADMIN_SECRET` unset/empty → 404, nothing changes.
 * - Wrong/absent secret → 401, nothing changes.
 * - The secret and the header value are NEVER logged.
 * Rate-limited first, on the STRICT 'admin' group (failed-auth guessing
 * is throttled before any auth work happens).
 *
 * Semantics: an unknown order id creates NOTHING (404). `method` is
 * optional — it defaults to the method recorded on the order; an explicit
 * value records how the payment actually arrived. `reference` (Cash App
 * or Venmo reference) and `note` are optional.
 * Re-recording the SAME method + reference + note is a 200 no-op
 * (idempotent); different details append a superseding event (201) and
 * the latest one is what read paths show.
 *
 * Manual payments have no API or webhooks — this manual confirmation
 * IS the integration point. (The legacy 'bookipi_card_invoice' value
 * from the card-invoice path removed 2026-10-21 stays acceptable here
 * ONLY as the recorded method of a pre-removal order, so those orders
 * can still be confirmed; it is offered nowhere to customers.)
 *
 * SERVER-ONLY: reads a server env secret and the filesystem ledgers.
 * Never import from a client component.
 */
import { NextResponse } from 'next/server';
import { isRecord, sanitizePlainText } from '../../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../../lib/security/rate-limit';
import { ownerAuthorized } from '../../../../../lib/admin/owner-auth';
import { defaultOrderStore } from '../../../../../lib/stores/order-store';
import type { StoredPaymentMethod } from '../../../../../lib/checkout/order';
import {
  appendPaymentEvent,
  buildPaymentEvent,
  findLatestPaymentAsync,
  sanitizeOptionalText,
  sanitizePaymentMethod,
  toPaymentView,
  type OrderPaymentEvent,
} from '../../../../../lib/orders/payments';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** Append-only ledger write — driver-aware, as the tracking route. */
async function persistPaymentEvent(event: OrderPaymentEvent): Promise<void> {
  await appendPaymentEvent(event);
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
  // Method is optional — a present-but-unknown value is rejected rather
  // than guessed; absent means "the method recorded on the order".
  let methodOverride: StoredPaymentMethod | null = null;
  if (body.method !== undefined && body.method !== null) {
    methodOverride = sanitizePaymentMethod(body.method);
    if (!methodOverride) {
      return fail([
        'Payment method must be one of: cash_app_or_venmo, stripe_card_embedded, bookipi_card_invoice (legacy orders only).',
      ]);
    }
  }
  const reference = sanitizeOptionalText(body.reference, 120);
  const note = sanitizeOptionalText(body.note, 500);

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

  const method = methodOverride ?? order.payment_method;

  const existing = await findLatestPaymentAsync(order.order_id);
  if (
    existing &&
    existing.method === method &&
    existing.reference === reference &&
    existing.note === note
  ) {
    // Idempotent: this exact confirmation is already the latest event.
    return NextResponse.json({
      ok: true,
      order_id: order.order_id,
      status: 'paid',
      already_recorded: true,
      payment: toPaymentView(existing),
    });
  }

  const event = buildPaymentEvent({
    order_id: order.order_id,
    method,
    reference,
    note,
  });
  try {
    await persistPaymentEvent(event);
  } catch (err) {
    return fail(
      [
        `Payment confirmation could not be recorded: ${
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
      status: 'paid',
      already_recorded: false,
      payment: toPaymentView(event),
    },
    { status: 201 },
  );
}
