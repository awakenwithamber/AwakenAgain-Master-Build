/**
 * Embedded card checkout session — POST /api/stripe/checkout-session.
 *
 * The order already exists (created by the server-authoritative
 * POST /api/checkout with payment_method 'stripe_card_embedded' and
 * persisted UNPAID). This route binds a Stripe Checkout Session
 * (ui_mode 'embedded') to that persisted order, building line items
 * from the SERVER-computed order record — the client sends only the
 * order ID + the email it ordered with (the same anti-enumeration pair
 * the order-status lookup uses), never an amount.
 *
 * GET returns card availability so the checkout UI can degrade
 * gracefully when Stripe is not configured: the card option explains
 * itself and steers to the Bookipi invoice / Venmo / Cash App paths,
 * which keep working untouched.
 */
import { NextResponse } from 'next/server';
import {
  createStripeClient,
  createEmbeddedCheckoutSession,
  findStripePayment,
  getStripeConfig,
} from '../../../../lib/payments/stripe';
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

export async function GET() {
  const config = getStripeConfig();
  return NextResponse.json({
    ok: true,
    card_available: config.cardAvailable,
    publishable_key: config.cardAvailable ? config.publishableKey : null,
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  const config = getStripeConfig();
  if (!config.cardAvailable) {
    return fail(
      [
        'Card checkout is not available right now. You can pay by ' +
          'invoice instead (we email you a secure Bookipi invoice), ' +
          'or with Venmo or Cash App.',
      ],
      503,
    );
  }

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
  if (!orderId) return fail(['Your order ID is required.']);
  const email = sanitizeEmail(body.email);
  if (!email) return fail(['A valid email address is required.']);

  const order = await createOrderStore().get(orderId);
  if (!order || normalizeSubscriptionEmail(order.customer.email) !== email) {
    return fail([NOT_FOUND], 404);
  }
  if (order.payment_method !== 'stripe_card_embedded') {
    return fail(
      ['This order was not placed for card payment on this site.'],
      409,
    );
  }
  if (await findStripePayment(order.order_id)) {
    return fail(['This order has already been paid.'], 409);
  }

  const client = createStripeClient();
  if (!client) {
    return fail(['Card checkout is not available right now.'], 503);
  }

  const origin = new URL(request.url).origin;
  const returnUrl =
    `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}` +
    `&order_id=${encodeURIComponent(order.order_id)}`;

  try {
    const session = await createEmbeddedCheckoutSession(
      order,
      client,
      returnUrl,
    );
    return NextResponse.json({
      ok: true,
      order_id: order.order_id,
      session_id: session.id,
      client_secret: session.client_secret,
      publishable_key: config.publishableKey,
    });
  } catch (err) {
    return fail(
      [
        `Could not start card payment: ${
          err instanceof Error ? err.message : 'unknown error'
        }. You can pay by invoice, Venmo, or Cash App instead.`,
      ],
      502,
    );
  }
}
