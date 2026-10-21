/**
 * Stripe Customer Portal session — POST /api/subscriptions/portal
 * (Stage 3). "Manage / cancel subscription" for members whose
 * membership is a Stripe subscription.
 *
 * Auth: the caller's signed-in account session (the same requirement
 * as every /api/account/* route). The Stripe customer is resolved
 * from the SERVER-HELD subscription record for that session email —
 * never from a client-supplied id. Degrades truthfully: no Stripe
 * subscription → 404 with the manual-membership explanation; Stripe
 * unconfigured → 503; portal creation failure → 502.
 */
import { NextResponse } from 'next/server';
import { accountFail, requireAccountSession } from '../../../../lib/accounts/http';
import { createStripeClient } from '../../../../lib/payments/stripe';
import { findLatestSubscriptionRecordAsync } from '../../../../lib/subscriptions/entitlement';
import { hasStripeSubscription } from '../../../../lib/subscriptions/subscriptions';
import {
  billingPortalAvailable,
  createBillingPortalSession,
} from '../../../../lib/subscriptions/subscription-checkout';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;

  if (!billingPortalAvailable()) {
    return accountFail(
      ['Subscription management by card is not available right now.'],
      503,
    );
  }

  const record = await findLatestSubscriptionRecordAsync(session.identity.email);
  if (!record || !hasStripeSubscription(record) || !record.stripe_customer_id) {
    return accountFail(
      [
        'This membership is not a card subscription — it is managed ' +
          'personally by Amber. Contact her to change or cancel it.',
      ],
      404,
    );
  }

  const client = createStripeClient();
  if (!client) {
    return accountFail(['Card checkout is not available right now.'], 503);
  }

  try {
    const portal = await createBillingPortalSession(
      {
        stripeCustomerId: record.stripe_customer_id,
        origin: new URL(request.url).origin,
      },
      client,
    );
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    return accountFail(
      [
        `Could not open subscription management: ${
          err instanceof Error ? err.message : 'unknown error'
        }.`,
      ],
      502,
    );
  }
}
