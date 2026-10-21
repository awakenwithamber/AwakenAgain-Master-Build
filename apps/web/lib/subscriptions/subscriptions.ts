/**
 * Living Grimoire subscription records — SERVER AUTHORITY (G1).
 *
 * The legacy subscription purchase flow (nml-checkout.js iframe flow) is
 * BROKEN (endpoints missing) AND SUPERSEDED (legacy payment rails). There is
 * no working way to buy a $7.77/mo subscription today; this module rebuilds
 * the server-side record for a Cash App / Venmo subscription signup.
 *
 * CLIENT = PREVIEW, SERVER = AUTHORITY: the client may show the plan price
 * from CANONICAL_PRICES.grimoireMonthlyCents, but the record is built and
 * priced here only. Price lives in lib/pricing/pricing.ts — never hard-coded.
 *
 * Payments: Stripe Checkout subscription (card, auto-renews monthly)
 * is the recurring processor — owner decision 2026-10-21 §13(3) — with
 * Cash App $AmberPatten347 + Venmo @AwakenwithAmber retained as the
 * manual fallback (signup + owner confirmation, unchanged).
 *
 * Lifecycle: a manual signup creates a record in `pending_payment`
 * status; it becomes `active` only when the owner confirms the first
 * payment. A Stripe subscription is created by Checkout
 * (lib/subscriptions/subscription-checkout.ts) and its lifecycle is
 * driven ONLY by signature-verified webhook events
 * (lib/subscriptions/stripe-lifecycle.ts): invoice.paid → active,
 * invoice.payment_failed → past_due (3-day grace, owner decision
 * 2026-10-21 §13(4)), customer.subscription.updated/deleted → sync /
 * end-at-paid-through. Manual `active` records remain entitled until
 * owner-cancelled, exactly as before Stage 3.
 */
import { CANONICAL_PRICES, formatPrice } from '../pricing/pricing';
import {
  isRecord,
  sanitizeEmail,
  sanitizePhone,
  sanitizePlainText,
} from '../security/validation';

/* ------------------------------------------------------------------ */
/* Plan                                                                 */
/* ------------------------------------------------------------------ */

/**
 * The single Grimoire plan. Price = canonical grimoireMonthlyCents (777),
 * read from lib/pricing/pricing.ts — never hard-coded here or on the client.
 */
export const GRIMOIRE_PLAN = {
  id: 'living-grimoire-monthly',
  name: 'Living Grimoire',
  priceCents: CANONICAL_PRICES.grimoireMonthlyCents,
  interval: 'month' as const,
  /** Owner-confirmed membership benefits (membership $7.77/month, CURRENT). */
  benefits: [
    '10% discount on every order, storewide — applied at checkout',
    'Monthly articles & rituals, exclusive to members',
    'Exclusive recipes from the Grimoire archive',
    'Early access to new botanical products',
    'Personalized product recommendations',
    'Subscriber gifts',
    'Safety information is never paywalled',
  ],
} as const;

export function grimoirePlanPriceLabel(): string {
  return `${formatPrice(GRIMOIRE_PLAN.priceCents)}/month`;
}

/* ------------------------------------------------------------------ */
/* Recurring-billing mechanic — owner decisions 2026-10-21             */
/* ------------------------------------------------------------------ */

/**
 * Owner decisions applied 2026-10-21 (§13(3) + §13(4), Stage 3):
 * - §13(3) ANSWERED: Stripe is the subscription processor. Recurring
 *   billing runs through Stripe Checkout in subscription mode
 *   (price from env STRIPE_GRIMOIRE_PRICE_ID) + the Stripe webhook
 *   lifecycle. The manual Cash App/Venmo + owner-confirmation flow
 *   remains as the fallback for members who do not pay by card.
 * - §13(4) ANSWERED 2026-10-21: failed-payment grace = 3 days.
 *   PAST_DUE keeps access for 3 days from the failed payment
 *   (env GRIMOIRE_GRACE_DAYS, default 3); success inside the window
 *   restores ACTIVE seamlessly; after 3 days unpaid access pauses
 *   until a successful payment reactivates.
 * This constant is the grep-able marker stamped on NEW records.
 * Records written before Stage 3 carry 'NEEDS_VERIFICATION'; they
 * stay readable and valid — the value is provenance, not a gate.
 */
export const RECURRING_BILLING_MECHANIC_STATUS =
  'STRIPE_SUBSCRIPTION_WITH_MANUAL_FALLBACK' as const;

/** Failed-payment grace window in days (env GRIMOIRE_GRACE_DAYS, default 3). */
export function grimoireGraceDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.GRIMOIRE_GRACE_DAYS?.trim();
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 3;
  return Math.floor(parsed);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO deadline through which a past-due member keeps access, or null. */
export function graceDeadlineIso(
  record: Pick<SubscriptionRecord, 'past_due_since' | 'failed_at'>,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const since = record.past_due_since ?? record.failed_at ?? null;
  if (!since) return null;
  const start = Date.parse(since);
  if (Number.isNaN(start)) return null;
  return new Date(start + grimoireGraceDays(env) * DAY_MS).toISOString();
}

/* ------------------------------------------------------------------ */
/* Subscription record                                                  */
/* ------------------------------------------------------------------ */

export type SubscriptionStatus =
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'cancelled';

export interface SubscriptionRecord {
  subscription_id: string;
  created_at: string;
  computed_by: 'server';
  plan_id: typeof GRIMOIRE_PLAN.id;
  plan_name: typeof GRIMOIRE_PLAN.name;
  price_cents: number;
  interval: 'month';
  status: SubscriptionStatus;
  customer: { name: string; email: string; phone?: string };
  /**
   * Set when the owner confirms the first (manual) payment. Manual
   * records are activated only by Amber's explicit action; Stripe
   * records are activated by the verified webhook instead and leave
   * this null (their paid state lives in the Stripe fields below).
   */
  confirmed_at: string | null;
  confirmed_by: 'owner' | null;
  /**
   * How recurring billing runs for NEW records (Stage 3, owner
   * decisions 2026-10-21 §13(3)/(4)). Older records carry
   * 'NEEDS_VERIFICATION' here and remain valid — see the constant.
   */
  recurring_mechanic: string;
  ledger_version: 1;
  /* -- Stripe linkage + lifecycle (Stage 3; optional so every ---- */
  /* -- pre-Stage-3 manual record stays readable and valid) ------- */
  /** Billing source: absent on legacy records means 'manual'. */
  billing_source?: 'manual' | 'stripe';
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  /** Raw Stripe subscription status last synced, when known. */
  stripe_status?: string | null;
  /** When the current paid period ends (ISO), from Stripe. */
  current_period_end?: string | null;
  /** Access is paid through this ISO instant (period end). */
  paid_through?: string | null;
  /** Stripe will cancel at period end; access continues until then. */
  cancel_at_period_end?: boolean;
  /** When the latest invoice payment failed (ISO). */
  past_due_since?: string | null;
  /** Alias kept alongside past_due_since for the failure instant. */
  failed_at?: string | null;
  /** When Stripe deleted the subscription (ISO), when it did. */
  stripe_deleted_at?: string | null;
  /** When an invoice was last paid (ISO), from the webhook. */
  stripe_last_paid_at?: string | null;
  /**
   * Monotonic guard: ISO time (from the Stripe event `created`) of
   * the newest Stripe event applied to this record. An older event
   * must never regress a newer state.
   */
  last_stripe_event_at?: string | null;
  last_stripe_event_type?: string | null;
}

export interface SubscriptionSignupInput {
  name: string;
  email: string;
  phone?: string;
}

function generateSubscriptionId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB-${date}-${rand}`;
}

const EMAIL_REQUIRED_MSG = 'A valid email address is required.';
const NAME_REQUIRED_MSG = 'Your name is required (letters, numbers, spaces).';

function parseSignupInput(body: unknown): SubscriptionSignupInput {
  if (!isRecord(body)) throw new Error('Request body must be a JSON object.');
  const name = sanitizePlainText(body.name, 120);
  if (name.length < 2) throw new Error(NAME_REQUIRED_MSG);
  const email = sanitizeEmail(body.email);
  if (!email) throw new Error(EMAIL_REQUIRED_MSG);
  const input: SubscriptionSignupInput = { name, email };
  if (body.phone !== undefined && body.phone !== '') {
    const phone = sanitizePhone(body.phone);
    if (!phone) throw new Error('Phone number is not valid.');
    input.phone = phone;
  }
  return input;
}

/**
 * Validate signup input + build a pending_payment subscription record.
 * Throws a human-readable Error on invalid input (422 → message).
 * The price always comes from CANONICAL_PRICES — a client-supplied price
 * field, if present, is ignored (never trusted).
 */
export function validateAndBuildSubscription(
  body: unknown,
): SubscriptionRecord {
  const input = parseSignupInput(body);
  return {
    subscription_id: generateSubscriptionId(),
    created_at: new Date().toISOString(),
    computed_by: 'server',
    plan_id: GRIMOIRE_PLAN.id,
    plan_name: GRIMOIRE_PLAN.name,
    price_cents: GRIMOIRE_PLAN.priceCents,
    interval: GRIMOIRE_PLAN.interval,
    status: 'pending_payment',
    customer: input.phone
      ? { name: input.name, email: input.email, phone: input.phone }
      : { name: input.name, email: input.email },
    confirmed_at: null,
    confirmed_by: null,
    recurring_mechanic: RECURRING_BILLING_MECHANIC_STATUS,
    ledger_version: 1,
  };
}

/**
 * Owner confirmation of the first payment: pending_payment → active.
 * Owner-only by design — there is no client path to this function.
 * (The route that calls it is an admin action; the mechanics of how the
 * owner records confirmation — dashboard, email — are UNDECIDED.)
 */
export function confirmSubscription(
  record: SubscriptionRecord,
): SubscriptionRecord {
  if (record.status !== 'pending_payment') {
    throw new Error(
      `Only a pending_payment subscription can be confirmed (status: ${record.status}).`,
    );
  }
  return {
    ...record,
    status: 'active',
    confirmed_at: new Date().toISOString(),
    confirmed_by: 'owner',
  };
}

/** Cancellation — owner-initiated or subscriber-requested (handled by owner). */
export function cancelSubscription(
  record: SubscriptionRecord,
): SubscriptionRecord {
  if (record.status === 'cancelled') return record;
  return { ...record, status: 'cancelled' };
}

/* ------------------------------------------------------------------ */
/* Entitlement evaluation (Stage 3)                                    */
/*                                                                     */
/* Pure + clock-injectable: `now` decides every time-based branch, so  */
/* tests walk the lifecycle by moving the clock, never by waiting.   */
/* Fail-closed: missing/unparseable timestamps deny the time-based   */
/* branches they guard.                                              */
/* ------------------------------------------------------------------ */

/** True when the record carries Stripe subscription linkage. */
export function hasStripeSubscription(
  record: Pick<
    SubscriptionRecord,
    'stripe_subscription_id' | 'stripe_customer_id' | 'billing_source'
  > | null | undefined,
): boolean {
  if (!record) return false;
  return Boolean(
    record.stripe_subscription_id ||
      record.stripe_customer_id ||
      record.billing_source === 'stripe',
  );
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Is this (latest) record entitled at `now`?
 * - manual active → entitled forever, until owner-cancelled (the
 *   cancelled line then becomes latest and this returns false).
 * - stripe active → entitled; with cancel_at_period_end, only until
 *   the period end (paid_through ?? current_period_end).
 * - past_due → entitled only inside the grace window
 *   (past_due_since + GRIMOIRE_GRACE_DAYS, default 3 — §13(4)).
 * - cancelled via Stripe deletion → entitled until paid_through.
 * - everything else (pending, manual cancelled, unreadable) → false.
 */
export function isSubscriptionRecordEntitled(
  record: SubscriptionRecord | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!record || typeof record.status !== 'string') return false;
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return false;
  switch (record.status) {
    case 'active': {
      if (record.cancel_at_period_end) {
        const end = parseTime(record.paid_through ?? record.current_period_end);
        if (end === null) return false; // fail closed on unreadable period
        return nowMs < end;
      }
      return true;
    }
    case 'past_due': {
      const deadline = graceDeadlineIso(record, env);
      const deadlineMs = parseTime(deadline);
      if (deadlineMs === null) return false;
      return nowMs < deadlineMs;
    }
    case 'cancelled': {
      // Only a Stripe deletion keeps paid-through access; a manual /
      // owner cancellation is immediate, as it has always been.
      if (!record.stripe_deleted_at) return false;
      const end = parseTime(record.paid_through ?? record.current_period_end);
      if (end === null) return false;
      return nowMs < end;
    }
    default:
      return false;
  }
}

export type SubscriptionDisplayStatus =
  | 'none'
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'past_due_lapsed'
  | 'cancel_at_period_end'
  | 'ending_paid_through'
  | 'lapsed'
  | 'cancelled';

export interface SubscriptionStateView {
  display_status: SubscriptionDisplayStatus;
  entitled: boolean;
  /** True when there is a Stripe subscription to manage in the Portal. */
  has_stripe_subscription: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  paid_through: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  grace_deadline: string | null;
  record_status: SubscriptionStatus | null;
}

/** Member-facing state derived from the latest record at `now`. */
export function describeSubscriptionState(
  record: SubscriptionRecord | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): SubscriptionStateView {
  const base: SubscriptionStateView = {
    display_status: 'none',
    entitled: false,
    has_stripe_subscription: hasStripeSubscription(record),
    stripe_customer_id: record?.stripe_customer_id ?? null,
    stripe_subscription_id: record?.stripe_subscription_id ?? null,
    current_period_end: record?.current_period_end ?? null,
    paid_through: record?.paid_through ?? record?.current_period_end ?? null,
    cancel_at_period_end: Boolean(record?.cancel_at_period_end),
    past_due_since: record?.past_due_since ?? record?.failed_at ?? null,
    grace_deadline: record ? graceDeadlineIso(record, env) : null,
    record_status: record?.status ?? null,
  };
  if (!record) return base;
  const entitled = isSubscriptionRecordEntitled(record, now, env);
  let display: SubscriptionDisplayStatus;
  if (record.status === 'past_due') {
    display = entitled ? 'past_due' : 'past_due_lapsed';
  } else if (record.status === 'active' && record.cancel_at_period_end) {
    display = entitled ? 'cancel_at_period_end' : 'lapsed';
  } else if (record.status === 'cancelled' && record.stripe_deleted_at) {
    display = entitled ? 'ending_paid_through' : 'lapsed';
  } else if (record.status === 'cancelled') {
    display = hasStripeSubscription(record) ? 'lapsed' : 'cancelled';
    // A Stripe record cancelled by the owner with no paid-through
    // window reads as lapsed to the member; manual stays 'cancelled'.
    if (!hasStripeSubscription(record)) display = 'cancelled';
  } else {
    display = record.status;
  }
  return { ...base, display_status: display, entitled };
}
