/**
 * Subscriptions Route Handler — SERVER AUTHORITY (G1).
 *
 * Cash App / Venmo Living Grimoire signup ($7.77/mo). CLIENT = PREVIEW,
 * SERVER = AUTHORITY: the record is validated and priced here from the
 * canonical price table (lib/subscriptions → lib/pricing); any
 * client-supplied price is ignored, never trusted.
 *
 * POST → validates input, builds a `pending_payment` SubscriptionRecord,
 * appends it to the subscription ledger (JSONL locally; the append-only
 * Postgres event store when DATABASE_URL is set — Phase 3 Step 1), emits
 * the server-owned
 * `subscription_created` analytics fact, and returns Cash App + Venmo
 * payment instructions for the first month.
 *
 * The record becomes `active` ONLY through owner confirmation of the first
 * payment — there is no client path to confirmation. This is the MANUAL
 * fallback rail (Stage 3): card subscribers subscribe through Stripe
 * Checkout instead (/api/subscriptions/stripe-checkout) and are billed
 * automatically by Stripe; manual members renew by sending each month's
 * payment, which Amber confirms the same way as the first.
 *
 * NOTE: only HTTP handlers and route config may be exported from a route
 * module — validateAndBuildSubscription lives in
 * lib/subscriptions/subscriptions.ts (imported here and by tests).
 */
import { NextResponse } from 'next/server';
import { CASH_APP_HANDLE, VENMO_HANDLE } from '../../../lib/checkout/order';
import { enforceRateLimit } from '../../../lib/security/rate-limit';
import { appendSubscriptionRecord } from '../../../lib/subscriptions/entitlement';
import {
  captureGrimoireServerEvent,
  GRIMOIRE_ANALYTICS_EVENT_NAMES,
  resolveGrimoireServerDistinctId,
} from '../../../lib/analytics/grimoire-events';
import {
  GRIMOIRE_PLAN,
  grimoirePlanPriceLabel,
  validateAndBuildSubscription,
  type SubscriptionRecord,
} from '../../../lib/subscriptions/subscriptions';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/**
 * Append-only ledger write — driver-aware (Phase 3 Step 1): the
 * subscription ledger (JSONL today, the Postgres event store when
 * DATABASE_URL is set), via lib/subscriptions/entitlement.
 */
async function persistSubscription(record: SubscriptionRecord): Promise<void> {
  await appendSubscriptionRecord(record);
}

function paymentInstructions() {
  return {
    cash_app: CASH_APP_HANDLE,
    venmo: VENMO_HANDLE,
    amount: grimoirePlanPriceLabel(),
    note:
      'Send your first month with Cash App or Venmo — whichever you prefer. ' +
      'Amber confirms every manual subscription personally. For manual ' +
      'memberships, send $7.77 each month to stay active; if you would ' +
      'rather renew automatically by card, use the card subscription ' +
      'option on the subscribe page instead.',
  };
}

/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'subscriptions');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }

  let record: SubscriptionRecord;
  try {
    record = validateAndBuildSubscription(body);
  } catch (err) {
    return fail([err instanceof Error ? err.message : 'Invalid subscription.']);
  }

  try {
    await persistSubscription(record);
  } catch (err) {
    return fail(
      [
        `Subscription validated but could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }. Please contact Amber directly.`,
      ],
      500,
    );
  }

  // Authoritative subscription event (server-owned, exactly once per
  // created record). Observational only — the persisted ledger above is the
  // truth. Fire-and-forget: signup acceptance never waits on analytics.
  // Fully inert until NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set (WIRED,
  // BLOCKED on the owner's phc_ key). Payload: subscription_id/status/
  // plan_id/price_cents only — no PII, no payment details.
  captureGrimoireServerEvent(
    GRIMOIRE_ANALYTICS_EVENT_NAMES.subscriptionCreated,
    {
      subscription_id: record.subscription_id,
      // This route only creates records; a new record is always pending_payment.
      status: 'pending_payment',
      plan_id: record.plan_id,
      price_cents: record.price_cents,
    },
    resolveGrimoireServerDistinctId(
      request.headers.get('cookie'),
      `subscription:${record.subscription_id}`,
    ),
  );

  return NextResponse.json({
    ok: true,
    subscription_id: record.subscription_id,
    plan: {
      id: GRIMOIRE_PLAN.id,
      name: GRIMOIRE_PLAN.name,
      price_cents: GRIMOIRE_PLAN.priceCents,
    },
    status: record.status,
    payment: paymentInstructions(),
  });
}
