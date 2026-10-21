/**
 * Grimoire subscription Stripe Checkout — POST
 * /api/subscriptions/stripe-checkout (Stage 3, §13(3)).
 *
 * Creates a hosted Stripe Checkout Session in mode 'subscription'
 * for the $7.77/month Living Grimoire plan (price from env
 * STRIPE_GRIMOIRE_PRICE_ID). This route grants NOTHING: entitlement
 * is written only by the signature-verified webhook lifecycle when
 * Stripe reports the subscription paid. GET reports availability so
 * the UI degrades truthfully to the manual Cash App/Venmo path when
 * the env is unset — no dead checkout button is ever offered.
 */
import { NextResponse } from 'next/server';
import { createStripeClient } from '../../../../lib/payments/stripe';
import {
  createSubscriptionCheckoutSession,
  grimoireSubscriptionCheckoutAvailable,
} from '../../../../lib/subscriptions/subscription-checkout';
import { GRIMOIRE_PLAN } from '../../../../lib/subscriptions/subscriptions';
import { isRecord, sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    available: grimoireSubscriptionCheckoutAvailable(),
    price_cents: GRIMOIRE_PLAN.priceCents,
    plan_id: GRIMOIRE_PLAN.id,
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  if (!grimoireSubscriptionCheckoutAvailable()) {
    return fail(
      [
        'Card subscription is not available yet — you can join today ' +
          'with Cash App or Venmo below, and Amber will confirm your ' +
          'membership personally.',
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
  if (!isRecord(body)) return fail(['Request body must be a JSON object.']);
  const email = sanitizeEmail(body.email);
  if (!email) return fail(['A valid email address is required.']);

  const client = createStripeClient();
  if (!client) return fail(['Card checkout is not available right now.'], 503);

  try {
    const session = await createSubscriptionCheckoutSession(
      { email, origin: new URL(request.url).origin },
      client,
    );
    return NextResponse.json({
      ok: true,
      session_id: session.id,
      url: session.url,
    });
  } catch (err) {
    return fail(
      [
        `Could not start the subscription checkout: ${
          err instanceof Error ? err.message : 'unknown error'
        }.`,
      ],
      502,
    );
  }
}
