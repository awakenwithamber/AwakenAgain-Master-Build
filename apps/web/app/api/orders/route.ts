/**
 * Order-intake Route Handler (G3) — the durable order-intake contract.
 *
 * POST /api/orders:
 *   explicit POST → validate → persist → fulfillment review-queue shape.
 *
 * This is the Next.js replacement for the legacy Netlify Forms
 * `submission-created` event flow (CONVERSION_MAP §§82, 93): the legacy
 * platform fired an implicit event when a form landed; here the intake is
 * an explicit, typed, server-authoritative pipeline (lib/orders/intake.ts).
 *
 * Relationship to POST /api/checkout: checkout is the
 * payment-instruction flow (validates + persists + returns the Cash App /
 * Venmo instructions the customer acts on). /api/orders is the durable
 * intake contract that any order source — checkout, the future admin
 * flow, manual entry — can use; both share lib/orders/intake.ts and the
 * provider-neutral store, so there is exactly one validator and one
 * persistence contract. This handler does NOT return payment instructions
 * (that is checkout's job).
 *
 * SERVER=AUTHORITY: totals are recomputed from canonical data in integer
 * cents; any client-supplied total or unit price that mismatches is
 * REJECTED with 422. Persistence failures → 500.
 *
 * Analytics (server-owned, fire-and-forget, inert without the phc_ key):
 * order_submitted (attempt received) / order_accepted (validated +
 * persisted) / order_rejected (validation or persistence failed).
 * PostHog is observational — the store is the authority.
 */
import { NextResponse } from 'next/server';
import { intakeOrder, type IntakeOutcome } from '../../../lib/orders/intake';
import { createOrderStore } from '../../../lib/orders/store';
import {
  captureServerEventSoon,
  resolveServerDistinctId,
} from '../../../lib/analytics/posthog-server';
import { ANALYTICS_EVENT_NAMES } from '../../../lib/analytics/events';

function generateAttemptId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `att_${Date.now().toString(36)}_${rand}`;
}

function distinctIdFor(request: Request, scope: string): string {
  return resolveServerDistinctId(
    request.headers.get('cookie'),
    `orders:${scope}`,
  );
}

export async function POST(request: Request) {
  const attemptId = generateAttemptId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.orderRejected,
      { attempt_id: attemptId, stage: 'validation', error_count: 1 },
      distinctIdFor(request, attemptId),
    );
    return NextResponse.json(
      { ok: false, errors: ['Request body must be valid JSON.'] },
      { status: 400 },
    );
  }

  captureServerEventSoon(
    ANALYTICS_EVENT_NAMES.orderSubmitted,
    {
      attempt_id: attemptId,
      item_count_claimed: Array.isArray(
        (body as { items?: unknown }).items,
      )
        ? (body as { items: unknown[] }).items.length
        : 0,
    },
    distinctIdFor(request, attemptId),
  );

  const outcome: IntakeOutcome = await intakeOrder(body, createOrderStore());

  if (!outcome.ok) {
    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.orderRejected,
      {
        attempt_id: attemptId,
        stage: outcome.stage,
        error_count: outcome.errors.length,
      },
      distinctIdFor(request, attemptId),
    );
    return NextResponse.json(
      { ok: false, errors: outcome.errors },
      { status: outcome.stage === 'validation' ? 422 : 500 },
    );
  }

  captureServerEventSoon(
    ANALYTICS_EVENT_NAMES.orderAccepted,
    {
      order_id: outcome.record.order_id,
      total_cents: outcome.record.total_cents,
      item_count:
        outcome.record.items.reduce((n, line) => n + line.quantity, 0) +
        (outcome.record.bundle ? 5 : 0),
    },
    distinctIdFor(request, outcome.record.order_id),
  );

  return NextResponse.json(
    {
      ok: true,
      order_id: outcome.record.order_id,
      created_at: outcome.record.created_at,
      receipt: outcome.receipt,
      review_entry: outcome.reviewEntry,
      fulfillment: {
        status: outcome.reviewEntry.review_status,
        note: 'Your order is recorded and awaiting Amber\u2019s personal confirmation.',
      },
    },
    { status: 200 },
  );
}
