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
 * Payments: Cash App $AmberPatten347 + Venmo @AwakenwithAmber ONLY.
 * No other payment provider appears in code, imports, or copy anywhere.
 *
 * Lifecycle: a new signup creates a record in `pending_payment` status.
 * It becomes `active` only when the owner confirms the first payment
 * (Amber confirms every order/subscription personally — see checkout).
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ NEEDS VERIFICATION — recurring-billing mechanics (owner call):    │
 * │ Cash App / Venmo have no native recurring-billing rail. HOW      │
 * │ month-2+ is collected — manual monthly payment by the subscriber, │
 * │ owner-issued payment request, or another mechanic — is GENUINELY │
 * │ UNDECIDED and must come from Amber. This module records the      │
 * │ signup and the first-payment confirmation only; it does NOT      │
 * │ invent a billing process, and MUST NOT grow one without her      │
 * │ explicit approval. See RECURRING_BILLING_MECHANIC below.          │
 * └──────────────────────────────────────────────────────────────────┘
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
/* NEEDS VERIFICATION marker — recurring-billing mechanics              */
/* ------------------------------------------------------------------ */

/**
 * NEEDS VERIFICATION (owner decision required).
 *
 * The mechanics of recurring collection on Cash App/Venmo are genuinely
 * undecided: manual monthly send vs. owner-issued request vs. something
 * else. Until Amber rules, the code paths that would act on "billing is
 * due" do not exist. This constant is the grep-able marker; a stage-gate
 * test asserts it stays 'NEEDS_VERIFICATION' until she decides.
 */
export const RECURRING_BILLING_MECHANIC_STATUS =
  'NEEDS_VERIFICATION' as const;

/* ------------------------------------------------------------------ */
/* Subscription record                                                  */
/* ------------------------------------------------------------------ */

export type SubscriptionStatus = 'pending_payment' | 'active' | 'cancelled';

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
   * Set when the owner confirms the first payment. The record is NEVER
   * auto-activated — confirmation is always Amber's explicit action.
   */
  confirmed_at: string | null;
  confirmed_by: 'owner' | null;
  /**
   * NEEDS VERIFICATION: how months 2+ are collected. Absent by design —
   * do not invent a billing process. Present so the absence is explicit.
   */
  recurring_mechanic: typeof RECURRING_BILLING_MECHANIC_STATUS;
  ledger_version: 1;
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
