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
 * Stage 1 (audit G-7/G-4):
 * - EVENT-ID IDEMPOTENCY: every successfully processed event is
 *   recorded in the webhook event ledger by its Stripe event id
 *   (lib/payments/stripe.ts). A redelivery of an already-recorded
 *   event id is a no-op (200, duplicate_event: true) — idempotency
 *   is by event id, not only by order id. Events whose processing
 *   FAILS (400) are not recorded, so a redelivery fails loudly again
 *   instead of being swallowed as a duplicate.
 * - REFUNDS / DISPUTES: 'charge.refunded' transitions the affected
 *   order to 'refunded' and 'charge.dispute.created' transitions it
 *   to 'disputed' (append-only status ledger, joined at read time by
 *   lib/orders/paid-state.ts). The order is resolved through the
 *   charge / payment_intent linkage recorded on the Stripe payment
 *   record at payment time. When no linkage exists, the event is
 *   logged and acknowledged (200) without touching any order state.
 * - Every other verified event type is acknowledged (200) with no
 *   state change, exactly as before.
 *
 * Stage 3 (audit G-1/G-2/G-3/G-10/G-11; owner decisions 2026-10-21
 * §13(3)/(4)):
 * - SUBSCRIPTION LIFECYCLE: invoice.paid → ACTIVE, invoice
 *   .payment_failed → PAST_DUE (3-day grace), customer.subscription
 *   .updated → sync (incl. cancel_at_period_end), customer
 *   .subscription.deleted → ends at paid-through, and subscription
 *   checkout completions are handled by lib/subscriptions/
 *   stripe-lifecycle.ts — append-only, monotonic by event `created`.
 *   PERMANENT_UNLOCK (Stage 2) is a separate ledger and is never
 *   touched by subscription lapse/cancellation.
 * - LIVEMODE (G-9, log-only): the event's livemode is recorded on
 *   its event-ledger entry; a mismatch with the configured key's
 *   mode is logged, never rejected.
 *
 * Stage 5 (monitoring basics): all logging goes through the
 * structured, redacting logger (lib/observability/logger.ts, scope
 * 'stripe-webhook'). EVERY failure — unconfigured endpoint, missing
 * or invalid signature, amount mismatch, and any handler or
 * lifecycle-handler error — emits a structured error log carrying
 * the event id + type (where an event exists). Processed events are
 * also visible read-only in /admin/orders (Stage 1 event ledger).
 *
 * Endpoint registration (owner step): point a Stripe webhook endpoint
 * at https://awakenagain.com/api/stripe/webhook for
 * checkout.session.completed + payment_intent.succeeded +
 * charge.refunded + charge.dispute.created + invoice.paid +
 * invoice.payment_failed + customer.subscription.updated +
 * customer.subscription.deleted and put its signing secret in
 * STRIPE_WEBHOOK_SECRET.
 */
import { NextResponse } from 'next/server';
import {
  createStripeClient,
  findStripePayment,
  findStripePaymentByChargeId,
  findStripePaymentByPaymentIntent,
  getStripeConfig,
  hasProcessedStripeEvent,
  recordStripeOrderStatus,
  recordStripePayment,
  recordStripeWebhookEvent,
  type StripeEventLike,
  type StripePaymentRecord,
} from '../../../../lib/payments/stripe';
import { createOrderStore } from '../../../../lib/orders/store';
import {
  findUnlockByTransactionRef,
  grantUnlock,
  revokeUnlockByTransactionRef,
} from '../../../../lib/grimoire/unlock';
import {
  EXPECTED_UNLOCK_AMOUNT_CENTS,
  isUnlockSessionMetadata,
} from '../../../../lib/grimoire/unlock-checkout';
import { createLogger } from '../../../../lib/observability/logger';
import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applySubscriptionCheckoutCompleted,
  applySubscriptionDeleted,
  applySubscriptionUpdated,
  type StripeLifecycleOutcome,
} from '../../../../lib/subscriptions/stripe-lifecycle';

const log = createLogger('stripe-webhook');

function fail(errors: string[], status = 400) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface AppliedEvent {
  orderId: string | null;
  /** True when this delivery marked an order paid. */
  markedPaid: boolean;
  /** True when the order was already paid before this delivery. */
  alreadyPaid: boolean;
  /** Refund/dispute transition applied by this delivery, when any. */
  statusTransition: 'refunded' | 'disputed' | null;
  /** Ledger outcome label for the event-id record. */
  outcome: string;
  /** Grimoire unlock granted by this delivery (Stage 2), when any. */
  unlockGranted?: boolean;
  /** Grimoire unlock revoked by this delivery (Stage 2), when any. */
  unlockRevoked?: boolean;
  /** Email the unlock was granted to, when any. */
  unlockEmail?: string | null;
  /** Member email a subscription lifecycle event resolved, when any. */
  subscriptionEmail?: string | null;
  /** Subscription status after a lifecycle transition, when any. */
  subscriptionStatus?: string | null;
}

function lifecycleApplied(outcome: StripeLifecycleOutcome): AppliedEvent {
  return {
    orderId: null,
    markedPaid: false,
    alreadyPaid: false,
    statusTransition: null,
    outcome: outcome.outcome,
    subscriptionEmail: outcome.email,
    subscriptionStatus: outcome.status,
  };
}

/**
 * The checkout.session.completed path — the STRICT paid gate,
 * unchanged: signature verification (route) + payment_status paid +
 * usable tax breakdown + persisted order + amount == order total +
 * tax. Throws on amount mismatch / missing tax breakdown — a loud
 * failure, never a silent mark.
 */
async function applyCompletedSession(
  event: StripeEventLike,
): Promise<AppliedEvent | null> {
  const object = event.data.object;
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const orderId =
    asString(metadata.order_id) ?? asString(object.client_reference_id);
  const amount = asNumber(object.amount_total);
  const sessionId = asString(object.id) ?? '';
  const paymentIntentId = asString(object.payment_intent);
  const chargeId =
    asString(object.latest_charge) ?? asString(object.charge);
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
    charge_id: chargeId,
    stripe_event_id: event.id,
    amount_total_cents: amount,
    tax_cents: taxCents,
    currency,
    paid_at: new Date().toISOString(),
    source: 'stripe_webhook',
  });
  return {
    orderId,
    markedPaid: true,
    alreadyPaid,
    statusTransition: null,
    outcome: alreadyPaid ? 'already_paid' : 'marked_paid',
  };
}

/**
 * The Grimoire unlock path (Stage 2) — a checkout.session.completed
 * carrying unlock metadata is NOT a product order: it never touches
 * the order store or the order paid ledger (Stage 1's strict order
 * rule is untouched). It grants the PERMANENT_UNLOCK entitlement
 * (lib/grimoire/unlock.ts) — and ONLY here, from a signature-verified
 * event whose amount equals the $8.88 unlock price and whose payment
 * is actually paid. Grant is idempotent by transaction.
 */
async function applyUnlockCompletedSession(
  event: StripeEventLike,
): Promise<AppliedEvent | null> {
  const object = event.data.object;
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  if (!isUnlockSessionMetadata(metadata)) return null;

  const paymentStatus = asString(object.payment_status);
  if (paymentStatus && paymentStatus !== 'paid') {
    return {
      orderId: null,
      markedPaid: false,
      alreadyPaid: false,
      statusTransition: null,
      outcome: 'acknowledged',
    };
  }
  const amount = asNumber(object.amount_total);
  if (amount !== EXPECTED_UNLOCK_AMOUNT_CENTS) {
    throw new Error(
      `Stripe unlock session ${asString(object.id) ?? ''} amount ${amount} ` +
        `does not match the $8.88 unlock price (${EXPECTED_UNLOCK_AMOUNT_CENTS}).`,
    );
  }
  const email =
    asString(metadata.email) ??
    asString(object.customer_email) ??
    asString(
      (object.customer_details as Record<string, unknown> | null)?.email,
    );
  if (!email) {
    throw new Error(
      'Stripe unlock session carries no buyer email — cannot grant the unlock.',
    );
  }
  const before = await findUnlockByTransactionRef(
    asString(object.payment_intent) ?? asString(object.id),
  );
  const alreadyGranted = before !== null && before.state === 'active';
  await grantUnlock({
    email,
    stripe_session_id: asString(object.id),
    payment_intent_id: asString(object.payment_intent),
    charge_id: asString(object.latest_charge) ?? asString(object.charge),
  });
  return {
    orderId: null,
    markedPaid: false,
    alreadyPaid: false,
    statusTransition: null,
    outcome: alreadyGranted ? 'unlock_already_granted' : 'unlock_granted',
    unlockGranted: true,
    unlockEmail: email,
  };
}

/**
 * Resolve the order a charge / dispute event belongs to, through the
 * linkage recorded at payment time: the event's payment_intent (or
 * the dispute's charge's payment intent) first, then any recorded
 * charge id. Returns null when nothing links — the caller logs and
 * acknowledges without corrupting state.
 */
async function resolveLinkedPayment(
  object: Record<string, unknown>,
): Promise<{
  payment: StripePaymentRecord;
  chargeId: string | null;
  paymentIntentId: string | null;
} | null> {
  const paymentIntentId = asString(object.payment_intent);
  // A dispute object carries `charge` (a charge id); a charge object
  // IS the charge, so its own id is the charge id.
  const chargeId = asString(object.charge) ?? asString(object.id);
  if (paymentIntentId) {
    const payment = await findStripePaymentByPaymentIntent(paymentIntentId);
    if (payment) return { payment, chargeId, paymentIntentId };
  }
  if (chargeId) {
    const payment = await findStripePaymentByChargeId(chargeId);
    if (payment) {
      return {
        payment,
        chargeId,
        paymentIntentId: paymentIntentId ?? payment.payment_intent_id,
      };
    }
  }
  return null;
}

/**
 * charge.refunded → 'refunded'; charge.dispute.created → 'disputed'.
 * These handlers NEVER mark anything paid and never create state for
 * an order they cannot link to a recorded Stripe payment.
 */
async function applyChargeStatusEvent(
  event: StripeEventLike,
  status: 'refunded' | 'disputed',
): Promise<AppliedEvent> {
  const object = event.data.object;
  // Grimoire unlock revocation (Stage 2): a charge linked to an
  // unlock transaction revokes the unlock — refund → 'refund',
  // dispute (chargeback) → 'chargeback' — IN ADDITION TO any order
  // transition below. Unlock sessions are not product orders, so the
  // two linkages are independent and both are checked.
  const unlockPaymentIntent = asString(object.payment_intent);
  const unlockChargeId = asString(object.charge) ?? asString(object.id);
  let unlockRevoked = false;
  for (const ref of [unlockPaymentIntent, unlockChargeId]) {
    if (!ref) continue;
    const revoked = await revokeUnlockByTransactionRef(
      ref,
      status === 'refunded' ? 'refund' : 'chargeback',
    );
    if (revoked && revoked.state === 'revoked') {
      unlockRevoked = true;
      break;
    }
  }

  const linked = await resolveLinkedPayment(object);
  if (!linked) {
    if (unlockRevoked) {
      return {
        orderId: null,
        markedPaid: false,
        alreadyPaid: false,
        statusTransition: null,
        outcome:
          status === 'refunded' ? 'unlock_revoked_refund' : 'unlock_revoked_chargeback',
        unlockRevoked: true,
      };
    }
    log.warn(
      'no recorded payment matches the charge/payment_intent linkage — acknowledged without changing any order',
      { event_id: event.id ?? null, event_type: event.type },
    );
    return {
      orderId: null,
      markedPaid: false,
      alreadyPaid: false,
      statusTransition: null,
      outcome: 'acknowledged',
    };
  }
  await recordStripeOrderStatus({
    order_id: linked.payment.order_id,
    status,
    stripe_event_id: event.id,
    charge_id: linked.chargeId,
    payment_intent_id: linked.paymentIntentId,
    recorded_at: new Date().toISOString(),
    source: 'stripe_webhook',
  });
  return {
    orderId: linked.payment.order_id,
    markedPaid: false,
    alreadyPaid: false,
    statusTransition: status,
    outcome: status === 'refunded' ? 'status_refunded' : 'status_disputed',
    unlockRevoked,
  };
}

/**
 * Verify + apply one event. Returns the application outcome, or an
 * acknowledged-no-op outcome for event types that change no state.
 * Throws only from the strict paid gate (amount / tax verification).
 */
async function applyEvent(event: StripeEventLike): Promise<AppliedEvent> {
  if (event.type === 'checkout.session.completed') {
    // Unlock sessions route by metadata into the unlock grant path —
    // they are not product orders (Stage 2).
    const unlockApplied = await applyUnlockCompletedSession(event);
    if (unlockApplied) return unlockApplied;
    // Subscription sessions route into the subscription lifecycle —
    // they are not product orders either (Stage 3).
    const subscriptionApplied =
      await applySubscriptionCheckoutCompleted(event);
    if (subscriptionApplied) return lifecycleApplied(subscriptionApplied);
    const applied = await applyCompletedSession(event);
    if (applied) return applied;
    return {
      orderId: null,
      markedPaid: false,
      alreadyPaid: false,
      statusTransition: null,
      outcome: 'acknowledged',
    };
  }
  if (event.type === 'invoice.paid') {
    return lifecycleApplied(await applyInvoicePaid(event));
  }
  if (event.type === 'invoice.payment_failed') {
    return lifecycleApplied(await applyInvoicePaymentFailed(event));
  }
  if (event.type === 'customer.subscription.updated') {
    return lifecycleApplied(await applySubscriptionUpdated(event));
  }
  if (event.type === 'customer.subscription.deleted') {
    return lifecycleApplied(await applySubscriptionDeleted(event));
  }
  if (event.type === 'charge.refunded') {
    return applyChargeStatusEvent(event, 'refunded');
  }
  if (event.type === 'charge.dispute.created') {
    return applyChargeStatusEvent(event, 'disputed');
  }
  // payment_intent.succeeded carries no tax breakdown (no
  // total_details), so its amount can never be verified against the
  // pre-tax order total + tax. Fail safe: acknowledge, mark nothing —
  // checkout.session.completed is the verifying event. Every other
  // verified type is likewise acknowledged with no state change.
  return {
    orderId: null,
    markedPaid: false,
    alreadyPaid: false,
    statusTransition: null,
    outcome: 'acknowledged',
  };
}

export async function POST(request: Request) {
  const config = getStripeConfig();
  const client = createStripeClient();
  if (!client || !config.webhookConfigured || !config.webhookSecret) {
    // Owner-visibility floor (Stage 5): a delivery hitting an
    // unconfigured endpoint is a structured log line, not silence.
    log.error('stripe webhook delivery received but webhook is not configured', {
      failure: 'not_configured',
    });
    return fail(['Stripe webhook is not configured.'], 503);
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    log.error('stripe webhook signature failure', {
      failure: 'missing_signature',
      event_id: null,
      event_type: null,
    });
    return fail(['Missing Stripe signature.'], 400);
  }

  const rawBody = await request.text();
  let event: StripeEventLike;
  try {
    event = client.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret,
    );
  } catch (err) {
    log.error('stripe webhook signature failure', {
      failure: 'invalid_signature',
      event_id: null,
      event_type: null,
      error: err,
    });
    return fail(['Invalid Stripe signature.'], 400);
  }

  // Livemode / config mismatch (audit G-9): LOG ONLY, never reject.
  // A test event reaching a live-configured endpoint (or vice versa)
  // is recorded with its livemode so the mismatch is observable.
  if (typeof event.livemode === 'boolean' && config.secretKey) {
    const configuredLive = config.secretKey.startsWith('sk_live_');
    const configuredTest = config.secretKey.startsWith('sk_test_');
    if ((configuredLive && !event.livemode) || (configuredTest && event.livemode)) {
      log.warn(
        'livemode does not match the configured key mode — processing continues (log-only)',
        {
          event_id: event.id ?? null,
          event_type: event.type,
          livemode: event.livemode,
        },
      );
    }
  }

  try {
    // Event-id idempotency (G-7): a redelivery of an event that was
    // already successfully processed is a no-op. The response still
    // reports the order's paid standing for session events so
    // existing consumers see the same shape as the order-id dedupe
    // gave them before.
    if (event.id && (await hasProcessedStripeEvent(event.id))) {
      let orderId: string | null = null;
      let markedPaid = false;
      if (event.type === 'checkout.session.completed') {
        const object = event.data.object;
        const metadata = (object.metadata ?? {}) as Record<string, unknown>;
        orderId =
          asString(metadata.order_id) ??
          asString(object.client_reference_id);
        markedPaid = orderId
          ? Boolean(await findStripePayment(orderId))
          : false;
      }
      return NextResponse.json({
        received: true,
        duplicate_event: true,
        event_id: event.id,
        marked_paid: markedPaid,
        already_paid: markedPaid,
        order_id: orderId,
        status_transition: null,
      });
    }

    const applied = await applyEvent(event);

    // Record the event id ONLY after successful processing — a
    // failed (400) delivery stays unrecorded so Stripe's redelivery
    // is processed, and fails loudly, again.
    if (event.id) {
      await recordStripeWebhookEvent({
        stripe_event_id: event.id,
        event_type: event.type,
        order_id: applied.orderId,
        outcome: applied.outcome,
        recorded_at: new Date().toISOString(),
        livemode: typeof event.livemode === 'boolean' ? event.livemode : null,
      });
    }

    return NextResponse.json({
      received: true,
      duplicate_event: false,
      event_id: event.id ?? null,
      marked_paid: applied.markedPaid,
      already_paid: applied.alreadyPaid,
      order_id: applied.orderId,
      status_transition: applied.statusTransition,
      unlock_granted: applied.unlockGranted ?? false,
      unlock_revoked: applied.unlockRevoked ?? false,
      unlock_email: applied.unlockEmail ?? null,
      subscription_email: applied.subscriptionEmail ?? null,
      subscription_status: applied.subscriptionStatus ?? null,
    });
  } catch (err) {
    // Owner-visibility floor (Stage 5): EVERY processing failure —
    // amount mismatch, missing tax breakdown, unlock amount mismatch,
    // lifecycle-handler failure, or any other handler error — emits
    // one structured error log carrying the event id + type. (Failed
    // deliveries are still NOT event-ledger recorded, per Stage 1, so
    // Stripe's redelivery fails loudly again.)
    log.error('stripe webhook processing failed', {
      failure: 'processing_failed',
      event_id: event.id ?? null,
      event_type: event.type ?? null,
      error: err,
    });
    return fail(
      [err instanceof Error ? err.message : 'Webhook processing failed.'],
      400,
    );
  }
}
