/**
 * Stripe subscription lifecycle — SERVER (Stage 3).
 *
 * The state machine the verified webhook drives (owner decisions
 * 2026-10-21 §13(3) Stripe is the processor, §13(4) grace = 3 days):
 *
 *   (checkout completed / invoice.paid) ──► ACTIVE
 *        ▲                                   │ invoice.payment_failed
 *        │ invoice.paid (seamless restore)   ▼
 *        └────────────────────────────── PAST_DUE ── grace expires ──►
 *                                       (access pauses; a later
 *                                        invoice.paid reactivates)
 *   ACTIVE + cancel_at_period_end ──► entitled until period end, then lapses
 *   customer.subscription.deleted ──► CANCELLED with paid_through kept;
 *                                       entitled until paid_through, then lapses
 *
 * Laws:
 * - APPEND-ONLY: every applied transition appends a new ledger record
 *   (the lifecycle copy of the member's latest record); history is
 *   never edited. Manual records are never touched unless the event
 *   resolves to them by Stripe id / subscription metadata email.
 * - MONOTONIC: each record stores last_stripe_event_at (the Stripe
 *   event `created` time). An event older than that is a no-op — it
 *   must never regress a newer state. Duplicate deliveries are
 *   already no-ops at the route's event-id ledger; this guard covers
 *   distinct-but-out-of-order events.
 * - PERMANENT_UNLOCK is a separate ledger (Stage 2) and is never
 *   read or written here — subscription lapse cannot affect it.
 *
 * SERVER-ONLY.
 */
import {
  GRIMOIRE_PLAN,
  RECURRING_BILLING_MECHANIC_STATUS,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './subscriptions';
import {
  appendSubscriptionRecord,
  findLatestSubscriptionByStripeIdAsync,
  findLatestSubscriptionRecordAsync,
  normalizeSubscriptionEmail,
} from './entitlement';
import { hasSubscriptionMetadata } from './subscription-checkout';

export interface StripeLifecycleOutcome {
  /** Email the event resolved to, when it resolved a member. */
  email: string | null;
  stripeSubscriptionId: string | null;
  /** Ledger outcome label for the webhook event record. */
  outcome: string;
  /** Status after the transition, when a record was written/read. */
  status: SubscriptionStatus | null;
  /** True when a new ledger record was appended. */
  applied: boolean;
}

/* ------------------------------------------------------------------ */
/* Payload parsing (structural — Stripe shapes vary by event)          */
/* ------------------------------------------------------------------ */

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function unixToIso(value: unknown): string | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  // Values already in milliseconds are > ~year-33658 in seconds; the
  // Stripe API always sends seconds.
  return new Date(n * 1000).toISOString();
}

function isoOr(value: unknown): string | null {
  const s = asString(value);
  if (s && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  return unixToIso(value);
}

/** Event `created` (unix seconds) → ISO; falls back to now. */
export function stripeEventTimeIso(event: {
  created?: number;
}): string {
  return unixToIso(event.created) ?? new Date().toISOString();
}

interface ParsedStripeSubscriptionData {
  email: string | null;
  customerName: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
}

function emailFromObject(obj: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    obj.customer_email,
    asRecord(obj.customer_details)?.email,
    asRecord(obj.metadata)?.email,
    asRecord(asRecord(obj.subscription_details)?.metadata)?.email,
    asRecord(obj.subscription_metadata)?.email,
  ];
  for (const c of candidates) {
    const email = normalizeSubscriptionEmail(asString(c));
    if (email) return email;
  }
  return null;
}

function periodEndFromObject(obj: Record<string, unknown>): string | null {
  const direct =
    isoOr(obj.current_period_end) ?? isoOr(obj.period_end) ?? isoOr(obj.paid_through);
  if (direct) return direct;
  const lines = asRecord(obj.lines);
  const data = lines?.data;
  if (Array.isArray(data)) {
    for (const line of data) {
      const lineRec = asRecord(line);
      const period = asRecord(lineRec?.period);
      const end = isoOr(period?.end) ?? isoOr(lineRec?.period_end);
      if (end) return end;
    }
  }
  const subscription = asRecord(obj.subscription);
  if (subscription) return periodEndFromObject(subscription);
  return null;
}

function parseStripeData(obj: Record<string, unknown>): ParsedStripeSubscriptionData {
  const subscriptionObj = asRecord(obj.subscription);
  const subscriptionId =
    asString(obj.subscription) ??
    (subscriptionObj ? asString(subscriptionObj.id) : null) ??
    // A customer.subscription.* event's object IS the subscription.
    (asString(obj.object) === 'subscription' || asString(obj.id)?.startsWith('sub_')
      ? asString(obj.id)
      : null);
  const customerId =
    asString(obj.customer) ??
    (subscriptionObj ? asString(subscriptionObj.customer) : null);
  const periodCarrier = subscriptionObj ?? obj;
  return {
    email: emailFromObject(obj),
    customerName:
      asString(obj.customer_name) ??
      asString(asRecord(obj.customer_details)?.name),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeStatus: asString(periodCarrier.status) ?? asString(obj.status),
    currentPeriodEnd: periodEndFromObject(obj),
    cancelAtPeriodEnd:
      typeof periodCarrier.cancel_at_period_end === 'boolean'
        ? periodCarrier.cancel_at_period_end
        : typeof obj.cancel_at_period_end === 'boolean'
          ? obj.cancel_at_period_end
          : null,
  };
}

/* ------------------------------------------------------------------ */
/* Record construction                                                 */
/* ------------------------------------------------------------------ */

function generateSubscriptionId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB-${date}-${rand}`;
}

function baseRecord(
  email: string,
  name: string | null,
  eventTime: string,
): SubscriptionRecord {
  return {
    subscription_id: generateSubscriptionId(),
    created_at: eventTime,
    computed_by: 'server',
    plan_id: GRIMOIRE_PLAN.id,
    plan_name: GRIMOIRE_PLAN.name,
    price_cents: GRIMOIRE_PLAN.priceCents,
    interval: GRIMOIRE_PLAN.interval,
    status: 'pending_payment',
    customer: { name: name || 'Living Grimoire member', email },
    confirmed_at: null,
    confirmed_by: null,
    recurring_mechanic: RECURRING_BILLING_MECHANIC_STATUS,
    ledger_version: 1,
    billing_source: 'stripe',
  };
}

interface Transition {
  status: SubscriptionStatus;
  past_due_since?: string | null;
  failed_at?: string | null;
  stripe_last_paid_at?: string | null;
  stripe_deleted_at?: string | null;
  clearPastDue?: boolean;
}

/**
 * Resolve the existing record for an event (by email first, then by
 * Stripe ids) and append the transition — unless the event is older
 * than the newest event already applied (monotonic guard).
 */
async function applyTransition(
  parsed: ParsedStripeSubscriptionData,
  eventTime: string,
  eventType: string,
  transition: Transition,
  outcome: string,
): Promise<StripeLifecycleOutcome> {
  let existing: SubscriptionRecord | undefined;
  if (parsed.email) {
    existing = await findLatestSubscriptionRecordAsync(parsed.email);
    // An email match that belongs to a DIFFERENT Stripe subscription
    // must not be hijacked by ids: only follow it when it is manual,
    // id-less, or carries the same subscription id.
    if (
      existing &&
      parsed.stripeSubscriptionId &&
      existing.stripe_subscription_id &&
      existing.stripe_subscription_id !== parsed.stripeSubscriptionId
    ) {
      existing = await findLatestSubscriptionByStripeIdAsync(
        parsed.stripeSubscriptionId,
        parsed.stripeCustomerId,
      );
    }
  }
  if (!existing) {
    existing = await findLatestSubscriptionByStripeIdAsync(
      parsed.stripeSubscriptionId,
      parsed.stripeCustomerId,
    );
  }

  const email =
    parsed.email ??
    (existing ? normalizeSubscriptionEmail(existing.customer?.email) : null);
  if (!email) {
    // No member can be resolved — acknowledge without writing state.
    return {
      email: null,
      stripeSubscriptionId: parsed.stripeSubscriptionId,
      outcome: 'acknowledged',
      status: null,
      applied: false,
    };
  }

  // Monotonic guard: an older event never regresses a newer state.
  if (existing?.last_stripe_event_at) {
    const lastMs = Date.parse(existing.last_stripe_event_at);
    const eventMs = Date.parse(eventTime);
    if (!Number.isNaN(lastMs) && !Number.isNaN(eventMs) && eventMs < lastMs) {
      return {
        email,
        stripeSubscriptionId:
          parsed.stripeSubscriptionId ?? existing.stripe_subscription_id ?? null,
        outcome: 'stale_event_ignored',
        status: existing.status,
        applied: false,
      };
    }
  }

  const base = existing ?? baseRecord(email, parsed.customerName, eventTime);
  const paidThrough =
    parsed.currentPeriodEnd ?? base.paid_through ?? base.current_period_end ?? null;
  const next: SubscriptionRecord = {
    ...base,
    // Preserve the member's original signup identity; never let a
    // later event rename them, and keep manual confirmations intact.
    customer: base.customer,
    status: transition.status,
    recurring_mechanic: RECURRING_BILLING_MECHANIC_STATUS,
    billing_source: 'stripe',
    stripe_customer_id:
      parsed.stripeCustomerId ?? base.stripe_customer_id ?? null,
    stripe_subscription_id:
      parsed.stripeSubscriptionId ?? base.stripe_subscription_id ?? null,
    stripe_status: parsed.stripeStatus ?? base.stripe_status ?? null,
    current_period_end: parsed.currentPeriodEnd ?? base.current_period_end ?? null,
    paid_through: paidThrough,
    cancel_at_period_end:
      parsed.cancelAtPeriodEnd ?? base.cancel_at_period_end ?? false,
    past_due_since: transition.clearPastDue
      ? null
      : (transition.past_due_since ?? base.past_due_since ?? null),
    failed_at: transition.clearPastDue
      ? null
      : (transition.failed_at ?? base.failed_at ?? null),
    stripe_last_paid_at:
      transition.stripe_last_paid_at ?? base.stripe_last_paid_at ?? null,
    stripe_deleted_at:
      transition.stripe_deleted_at ?? base.stripe_deleted_at ?? null,
    last_stripe_event_at: eventTime,
    last_stripe_event_type: eventType,
  };
  await appendSubscriptionRecord(next);
  return {
    email,
    stripeSubscriptionId: next.stripe_subscription_id ?? null,
    outcome,
    status: next.status,
    applied: true,
  };
}

/* ------------------------------------------------------------------ */
/* Event handlers (called ONLY by the verified webhook route)          */
/* ------------------------------------------------------------------ */

function eventParts(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}) {
  return {
    parsed: parseStripeData(event.data.object),
    eventTime: stripeEventTimeIso(event),
  };
}

/** checkout.session.completed in subscription mode → link + activate when paid. */
export async function applySubscriptionCheckoutCompleted(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}): Promise<StripeLifecycleOutcome | null> {
  const obj = event.data.object;
  const metadata = asRecord(obj.metadata);
  const isSubscriptionMode = asString(obj.mode) === 'subscription';
  if (!isSubscriptionMode && !hasSubscriptionMetadata(metadata)) return null;
  const paymentStatus = asString(obj.payment_status);
  const { parsed, eventTime } = eventParts(event);
  // Session object: id is the checkout session, subscription/customer
  // are their own fields.
  parsed.stripeSubscriptionId =
    asString(obj.subscription) ?? parsed.stripeSubscriptionId;
  parsed.stripeCustomerId = asString(obj.customer) ?? parsed.stripeCustomerId;
  if (paymentStatus && paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
    // Checkout finished without a paid first invoice — record the
    // linkage as pending, never active.
    return applyTransition(parsed, eventTime, event.type, { status: 'pending_payment' }, 'subscription_pending');
  }
  return applyTransition(
    parsed,
    eventTime,
    event.type,
    {
      status: 'active',
      clearPastDue: true,
      stripe_last_paid_at: eventTime,
    },
    'subscription_active',
  );
}

/** invoice.paid → ACTIVE (or extends paid_through); clears past_due. */
export async function applyInvoicePaid(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}): Promise<StripeLifecycleOutcome> {
  const { parsed, eventTime } = eventParts(event);
  return applyTransition(
    parsed,
    eventTime,
    event.type,
    { status: 'active', clearPastDue: true, stripe_last_paid_at: eventTime },
    'subscription_active',
  );
}

/** invoice.payment_failed → PAST_DUE from the failure time (§13(4)). */
export async function applyInvoicePaymentFailed(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}): Promise<StripeLifecycleOutcome> {
  const { parsed, eventTime } = eventParts(event);
  return applyTransition(
    parsed,
    eventTime,
    event.type,
    {
      status: 'past_due',
      past_due_since: eventTime,
      failed_at: eventTime,
    },
    'subscription_past_due',
  );
}

function mapStripeSubscriptionStatus(
  stripeStatus: string | null,
): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    default:
      return 'pending_payment';
  }
}

/** customer.subscription.updated → sync status incl. cancel_at_period_end. */
export async function applySubscriptionUpdated(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}): Promise<StripeLifecycleOutcome> {
  const { parsed, eventTime } = eventParts(event);
  const status = mapStripeSubscriptionStatus(parsed.stripeStatus);
  const transition: Transition = { status };
  if (status === 'active') transition.clearPastDue = true;
  if (status === 'past_due') {
    transition.past_due_since = eventTime;
    transition.failed_at = eventTime;
  }
  return applyTransition(
    parsed,
    eventTime,
    event.type,
    transition,
    'subscription_synced',
  );
}

/**
 * customer.subscription.deleted → membership ends at the already
 * paid-through period end, then lapses: status cancelled, the
 * paid_through window kept, entitlement evaluates the window.
 */
export async function applySubscriptionDeleted(event: {
  created?: number;
  data: { object: Record<string, unknown> };
  type: string;
}): Promise<StripeLifecycleOutcome> {
  const { parsed, eventTime } = eventParts(event);
  parsed.cancelAtPeriodEnd = false;
  return applyTransition(
    parsed,
    eventTime,
    event.type,
    { status: 'cancelled', stripe_deleted_at: eventTime, clearPastDue: true },
    'subscription_deleted',
  );
}
