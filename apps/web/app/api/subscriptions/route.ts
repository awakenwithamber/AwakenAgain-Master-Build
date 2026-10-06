/**
 * Subscriptions Route Handler — SERVER AUTHORITY (G1).
 *
 * Cash App / Venmo Living Grimoire signup ($7.77/mo). CLIENT = PREVIEW,
 * SERVER = AUTHORITY: the record is validated and priced here from the
 * canonical price table (lib/subscriptions → lib/pricing); any
 * client-supplied price is ignored, never trusted.
 *
 * POST → validates input, builds a `pending_payment` SubscriptionRecord,
 * appends it to the local JSONL ledger (reversible; production persistence
 * is the database — UNDECIDED, NEEDS VERIFICATION), emits the server-owned
 * `subscription_created` analytics fact, and returns Cash App + Venmo
 * payment instructions for the first month.
 *
 * The record becomes `active` ONLY through owner confirmation of the first
 * payment — there is no client path to confirmation. Recurring-billing
 * mechanics on Cash App/Venmo are NEEDS VERIFICATION (owner decision);
 * nothing here invents a billing process.
 *
 * NOTE: only HTTP handlers and route config may be exported from a route
 * module — validateAndBuildSubscription lives in
 * lib/subscriptions/subscriptions.ts (imported here and by tests).
 */
import { NextResponse } from 'next/server';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CASH_APP_HANDLE, VENMO_HANDLE } from '../../../lib/checkout/order';
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

function ledgerPath(): string {
  return (
    process.env.SUBSCRIPTIONS_LEDGER_PATH ??
    join(process.cwd(), '.subscriptions-ledger.jsonl')
  );
}

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function persistSubscription(record: SubscriptionRecord): void {
  const path = ledgerPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
}

function paymentInstructions() {
  return {
    cash_app: CASH_APP_HANDLE,
    venmo: VENMO_HANDLE,
    amount: grimoirePlanPriceLabel(),
    note:
      'Send your first month with Cash App or Venmo — whichever you prefer. ' +
      'Amber confirms every subscription personally. ' +
      'Monthly renewal mechanics are being finalized — ' +
      'Amber will contact you directly before any renewal is due.',
  };
}

/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
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
    persistSubscription(record);
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
