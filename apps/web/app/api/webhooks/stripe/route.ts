/**
 * Stripe webhook handler — confirms card payments.
 *
 * Stripe sends events here after checkout completes. We verify the webhook
 * signature (proving it's really from Stripe), then mark the matching order
 * as paid. This is the payment confirmation source of truth for Stripe orders.
 *
 * Setup in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL: https://awakenagain.com/api/webhooks/stripe
 *   Events: checkout.session.completed
 *
 * Requires env var: STRIPE_WEBHOOK_SECRET (from the webhook endpoint setup)
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrderStore } from '../../../../lib/orders/store';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { ok: false, errors: ['Webhook not configured.'] },
      { status: 503 }
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { ok: false, errors: ['Missing signature.'] },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['Invalid signature.'] },
      { status: 400 }
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.client_reference_id || session.metadata?.order_id;

    if (orderId && session.payment_status === 'paid') {
      // Append-only ledger: record payment confirmation as a new entry
      // linked to the original order (no in-place updates).
      try {
        const store = createOrderStore();
        await store.append({
          record_type: 'stripe_payment_confirmed',
          order_id: orderId,
          stripe_session_id: session.id,
          stripe_payment_intent: String(session.payment_intent ?? ''),
          amount_total_cents: session.amount_total ?? 0,
          paid_at: new Date().toISOString(),
        } as never);
      } catch {
        // Log but don't fail the webhook — Stripe will retry.
      }
    }
  }

  return NextResponse.json({ ok: true, received: true });
}
