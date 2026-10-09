/**
 * Stripe Checkout Session API — SERVER AUTHORITY.
 *
 * Creates a Stripe Checkout Session for card payments (includes Stripe Link,
 * Apple Pay, Google Pay automatically). Follows the same server-authority
 * pattern as the Cash App/Venmo checkout: every total is recomputed
 * server-side from canonical data; client-supplied totals are rejected.
 *
 * Requires env vars (set in Vercel, never in code):
 *   STRIPE_SECRET_KEY — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET — webhook signing secret for /api/webhooks/stripe
 *
 * Flow:
 *   1. Client POSTs cart + customer details (same shape as /api/checkout)
 *   2. Server validates and recomputes totals via validateAndBuildOrder
 *   3. Server creates Stripe Checkout Session with line items
 *   4. Client redirects to session.url (Stripe-hosted checkout)
 *   5. Stripe redirects to /checkout/success or /checkout/cancel
 *   6. Webhook at /api/webhooks/stripe confirms payment and finalizes order
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  validateAndBuildOrder,
  type OrderRecord,
} from '../../../../lib/checkout/order';
import { createOrderStore } from '../../../../lib/orders/store';
import { siteUrl } from '../../../../lib/seo/config';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return fail(
      ['Card checkout is not configured yet. Please use Cash App or Venmo.'],
      503
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(['Invalid request body.'], 400);
  }

  // Server-authority validation — same as Cash App/Venmo checkout.
  // validateAndBuildOrder recomputes all totals and rejects mismatches.
  const b = body as {
    items?: unknown[];
    bundle?: unknown;
    customer?: { name?: string; email?: string; phone?: string; notes?: string };
    is_subscriber?: boolean;
    client_total_cents?: number;
  };

  let order: OrderRecord;
  try {
    order = validateAndBuildOrder({
      items: (b.items ?? []) as never,
      bundle: b.bundle as never,
      customer: {
        name: b.customer?.name ?? '',
        email: b.customer?.email ?? '',
        phone: b.customer?.phone ?? '',
        notes: b.customer?.notes ?? '',
      },
      is_subscriber: b.is_subscriber ?? false,
      client_total_cents: b.client_total_cents ?? -1,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Order validation failed.';
    return fail([message]);
  }

  // Persist as pending-Stripe-payment (finalized on webhook confirmation).
  order.payment_method = 'stripe';
  order.status = 'pending_payment';
  try {
    await createOrderStore().append(order);
  } catch {
    // Non-fatal: Stripe session is the source of truth; order reconciles via webhook.
  }

  // Build Stripe line items from the validated order.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    order.items.map((item: { title: string; product_handle: string; unit_price_cents: number; quantity: number; variant_name?: string }) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title || item.product_handle,
          description: item.variant_name || undefined,
        },
        unit_amount: item.unit_price_cents,
      },
      quantity: item.quantity,
    }));

  // Add shipping as a line item if applicable.
  if (order.shipping_cents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping' },
        unit_amount: order.shipping_cents,
      },
      quantity: 1,
    });
  }

  const base = (typeof siteUrl === 'function' ? siteUrl() : siteUrl).replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: order.customer.email || undefined,
      client_reference_id: order.order_id,
      metadata: {
        order_id: order.order_id,
        customer_name: order.customer.name || '',
      },
      // Stripe Link, Apple Pay, Google Pay are enabled by default in Checkout.
      success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/checkout/cancel?order_id=${order.order_id}`,
      // Collect shipping address for fulfillment.
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
    });

    return NextResponse.json({
      ok: true,
      order_id: order.order_id,
      checkout_url: session.url,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create checkout session.';
    return fail([message], 500);
  }
}
