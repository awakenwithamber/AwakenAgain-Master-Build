/**
 * Stripe webhook — POST /api/stripe/webhook.
 *
 * The ONLY path that marks an order paid for card orders (owner
 * directive 2026-10-19). The raw body is verified against
 * STRIPE_WEBHOOK_SECRET with the Stripe signature; anything that fails
 * verification is rejected (400) and marks nothing. A verified
 * 'checkout.session.completed' event marks the bound order paid ONLY
 * when its amount equals the persisted server-computed order total
 * PLUS the Stripe Tax amount Stripe reports on the session
 * (total_details.amount_tax) — order totals are pre-tax since
 * 2026-10-20. The tax amount is stored on the payment record.
 *
 * FAIL-SAFE (2026-10-20): if a session event carries no usable
 * total_details.amount_tax, the amount cannot be verified, so NOTHING
 * is marked paid (400). 'payment_intent.succeeded' events carry no
 * tax breakdown at all, so they are acknowledged but NEVER mark an
 * order paid — the session event is the verifying event. The
 * client-side return page displays status — it can never set it.
 *
 * Endpoint registration (owner step): point a Stripe webhook endpoint
 * at https://awakenagain.com/api/stripe/webhook for
 * checkout.session.completed + payment_intent.succeeded and put its
 * signing secret in STRIPE_WEBHOOK_SECRET.
 */
import { NextResponse } from 'next/server';
import {
  createStripeClient,
  findStripePayment,
  getStripeConfig,
  recordStripePayment,
  type StripeEventLike,
} from '../../../../lib/payments/stripe';
import { createOrderStore } from '../../../../lib/orders/store';

function fail(errors: string[], status = 400) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Verify + apply one event. Returns the bound order_id and whether it
 * was already paid before this event, or null when the event binds no
 * payable order. Throws on amount mismatch — a loud failure, never a
 * silent mark.
 */
async function applyEvent(
  event: StripeEventLike,
): Promise<{ orderId: string; alreadyPaid: boolean } | null> {
  const object = event.data.object;

  // payment_intent.succeeded carries no tax breakdown (no
  // total_details), so its amount can never be verified against the
  // pre-tax order total + tax. Fail safe: acknowledge, mark nothing —
  // checkout.session.completed is the verifying event.
  if (event.type !== 'checkout.session.completed') return null;

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const orderId =
    asString(metadata.order_id) ?? asString(object.client_reference_id);
  const amount = asNumber(object.amount_total);
  const sessionId = asString(object.id) ?? '';
  const paymentIntentId = asString(object.payment_intent);
  const currency = asString(object.currency) ?? 'usd';
  const paymentStatus = asString(object.payment_status);
  // Embedded sessions can complete with an async payment still
  // pending — only a paid session marks the order paid.
  if (paymentStatus && paymentStatus !== 'paid') return null;

  if (!orderId || amount === null) return null;

  // Stripe Tax breakdown: without a usable amount_tax the charged
  // amount cannot be verified — fail safe, mark nothing.
  const totalDetails = (object.total_details ?? null) as Record<
    string,
    unknown
  > | null;
  const taxCents = totalDetails ? asNumber(totalDetails.amount_tax) : null;
  if (taxCents === null) {
    throw new Error(
      `Stripe session ${sessionId} carries no tax breakdown (total_details.amount_tax) — amount cannot be verified for order ${orderId}; not marking paid.`,
    );
  }

  const order = await createOrderStore().get(orderId);
  if (!order) return null;
  const expected = order.total_cents + taxCents;
  if (amount !== expected) {
    throw new Error(
      `Stripe amount ${amount} does not match order ${orderId} total ${order.total_cents} + tax ${taxCents} (= ${expected}).`,
    );
  }

  const alreadyPaid = Boolean(await findStripePayment(orderId));
  await recordStripePayment({
    order_id: orderId,
    stripe_session_id: sessionId,
    payment_intent_id: paymentIntentId,
    amount_total_cents: amount,
    tax_cents: taxCents,
    currency,
    paid_at: new Date().toISOString(),
    source: 'stripe_webhook',
  });
  return { orderId, alreadyPaid };
}

export async function POST(request: Request) {
  const config = getStripeConfig();
  const client = createStripeClient();
  if (!client || !config.webhookConfigured || !config.webhookSecret) {
    return fail(['Stripe webhook is not configured.'], 503);
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return fail(['Missing Stripe signature.'], 400);

  const rawBody = await request.text();
  let event: StripeEventLike;
  try {
    event = client.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret,
    );
  } catch {
    return fail(['Invalid Stripe signature.'], 400);
  }

  try {
    const applied = await applyEvent(event);
    return NextResponse.json({
      received: true,
      marked_paid: applied !== null,
      already_paid: applied?.alreadyPaid ?? false,
      order_id: applied?.orderId ?? null,
    });
  } catch (err) {
    return fail(
      [err instanceof Error ? err.message : 'Webhook processing failed.'],
      400,
    );
  }
}
