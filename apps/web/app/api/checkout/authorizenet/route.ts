/**
 * Authorize.net hosted card checkout — POST /api/checkout/authorizenet
 * (card checkout build 2026-11-09, SHOP ORDERS ONLY — ported from the
 * Oct 29 unified build's route, with its Grimoire unlock branch
 * deliberately NOT ported — the $8.88 unlock was abolished by owner
 * decision 2026-11-09, so no unlock branch exists to port).
 *
 * Binds an Accept Hosted payment token to an existing shop order
 * (created UNPAID by POST /api/checkout with payment_method
 * 'authorizenet_card_hosted'), identified by the order ID + ordering
 * email pair. The amount comes from the SERVER-computed order record
 * (total_cents, tax-inclusive on current main) — never the client:
 * this route accepts no amount field at all, and any amount a client
 * sends is ignored by construction.
 *
 * Idempotency: the hosted transaction's invoice number IS the order
 * id (buildOrderHostedPaymentInput), so re-submitting this route for
 * the same order can only mint another token for the SAME single
 * order and amount — there is no second order to charge — and the
 * signature-verified webhook's notification claim guarantees the
 * order is marked paid at most once. An already-paid order is
 * refused here (409).
 *
 * The browser then POSTs the token to Authorize.net's hosted page —
 * card details never touch this site. The return page is
 * display-only; only the verified webhook marks anything paid.
 *
 * FAIL CLOSED: without CARD_PAYMENTS_ENABLED='true' AND the API
 * credentials this route answers 503 and GET reports the method
 * unavailable, so the checkout UI never offers a card path that
 * cannot collect.
 */
import { NextResponse } from 'next/server';
import {
  buildOrderHostedPaymentInput,
  createAuthorizeNetClient,
  findAuthorizeNetPayment,
  getAuthorizeNetConfig,
} from '../../../../lib/payments/authorizenet';
import { createOrderStore } from '../../../../lib/orders/store';
import {
  isRecord,
  sanitizeEmail,
  sanitizePlainText,
} from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { normalizeSubscriptionEmail } from '../../../../lib/subscriptions/entitlement';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

const NOT_FOUND = 'No order matches that order ID and email.';
const NOT_AVAILABLE =
  'Card payment is not available right now. You can pay with the ' +
  'Bluevine invoice, Cash App, or Venmo instead.';

export async function GET() {
  const config = getAuthorizeNetConfig();
  return NextResponse.json({
    ok: true,
    card_available: config.cardAvailable,
    environment: config.environment,
    form_post_url: config.cardAvailable ? config.hostedPaymentUrl : null,
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  const config = getAuthorizeNetConfig();
  if (!config.cardAvailable) return fail([NOT_AVAILABLE], 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }
  if (!isRecord(body)) {
    return fail(['Request body must be a JSON object.']);
  }
  const email = sanitizeEmail(body.email);
  if (!email) return fail(['A valid email address is required.']);

  const client = createAuthorizeNetClient();
  if (!client) return fail([NOT_AVAILABLE], 503);
  const origin = new URL(request.url).origin;

  try {
    const orderId = sanitizePlainText(body.order_id, 64);
    if (!orderId) return fail(['Your order ID is required.']);
    const order = await createOrderStore().get(orderId);
    if (!order || normalizeSubscriptionEmail(order.customer.email) !== email) {
      return fail([NOT_FOUND], 404);
    }
    if (order.payment_method !== 'authorizenet_card_hosted') {
      return fail(
        ['This order was not placed for card payment.'],
        409,
      );
    }
    if (await findAuthorizeNetPayment(order.order_id)) {
      return fail(['This order has already been paid.'], 409);
    }
    const hosted = await client.getHostedPaymentPage(
      buildOrderHostedPaymentInput(order, origin),
    );
    return NextResponse.json({
      ok: true,
      kind: 'order',
      order_id: order.order_id,
      token: hosted.token,
      form_post_url: config.hostedPaymentUrl,
      // What the hosted page will charge: the stored order total
      // (tax-inclusive on current main), with its tax portion shown
      // separately so the customer sees the full amount first.
      amount_due_cents: order.total_cents,
      tax_cents: order.tax_cents ?? 0,
      tax_rate_percent: order.tax_breakdown?.ratePercent ?? null,
      tax_jurisdiction: order.tax_breakdown?.jurisdiction ?? null,
    });
  } catch (err) {
    return fail(
      [
        `Could not start the card payment: ${
          err instanceof Error ? err.message : 'unknown error'
        }. Your order is saved — you can try again, or pay with the Bluevine invoice, Cash App, or Venmo.`,
      ],
      502,
    );
  }
}
