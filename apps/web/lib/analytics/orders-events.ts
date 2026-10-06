/**
 * Typed PostHog event definitions for the order-intake pipeline (G3).
 *
 * PATTERN NOTE: this file mirrors the typed contract pattern in
 * lib/analytics/events.ts but lives SEPARATE from it — the coordinator
 * merges all event definitions into events.ts centrally, so that file is
 * not edited here. After the merge these definitions should be deleted and
 * call sites switched to ANALYTICS_EVENT_NAMES.
 *
 * Ownership: all three events are SERVER-owned. The Route Handler
 * (app/api/orders/route.ts) emits them — the server is the only party that
 * can attest an intake attempt, an acceptance, or a rejection. No client
 * event with any of these names may exist (dedupe contract).
 *
 * PostHog = behavioral observation, never authority. These events RECORD
 * intake facts (an attempt arrived, an order was accepted, an attempt was
 * rejected); the order ledger / database is the source of truth.
 *
 * Payloads carry NO PII, payment details, or secrets: order_id /
 * attempt_id / integer cents / counts only.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Nothing here is marked IMPLEMENTED — PostHog receipt is
 * verified in Live Events only, per the ownership lifecycle.
 *
 * TRACEABILITY (owner Phase 2 directive 2026-10-05 ~17:45 MDT —
 * name → reason → legacy equivalent → owner → purpose):
 * - order_submitted → reason: observe intake attempts before validation
 *   (funnel entry for the durable intake contract) → legacy equivalent:
 *   none directly (legacy fired Netlify's implicit submission-created
 *   event; the new intake is an explicit POST) → owner: server →
 *   purpose: attempt volume + validation-failure analysis, PII-free.
 * - order_accepted → reason: canonical observed count for the durable
 *   intake pipeline (POST /api/orders validate+ Persist) → legacy
 *   equivalent: Netlify submission-created (implicit order event) →
 *   owner: server → purpose: recorded-fact of intake acceptance.
 *   NOT a duplicate of checkout's order_created: that event belongs to
 *   the payment-instruction flow (POST /api/checkout); an order accepted
 *   here emits order_accepted, an order placed through checkout emits
 *   order_created — same underlying order, different actions, no double
 *   counting within either funnel.
 * - order_rejected → reason: distinguish validation failures (422) from
 *   persistence failures (500) → legacy equivalent: none (legacy had no
 *   typed rejection signal) → owner: server → purpose: triage signal for
 *   intake health without echoing client input.
 */
import type { OwnershipStage } from './events';
import { ANALYTICS_EVENT_NAMES } from './events';

/** Canonical names. Add new events here — never inline a string elsewhere. */
export const ORDER_ANALYTICS_EVENT_NAMES = {
  /** Server received an order-intake POST (attempt observation). */
  orderSubmitted: 'order_submitted',
  /** Server validated + persisted the order (canonical observed intake). */
  orderAccepted: 'order_accepted',
  /** Server rejected the intake (validation or persistence failure). */
  orderRejected: 'order_rejected',
} as const;

export type OrderAnalyticsEventName =
  (typeof ORDER_ANALYTICS_EVENT_NAMES)[keyof typeof ORDER_ANALYTICS_EVENT_NAMES];

/** Compile-time-checked properties per event. No PII anywhere. */
export interface OrderAnalyticsEventProperties {
  /**
   * Emitted when POST /api/orders receives a body — before validation.
   * attempt_id is a server-generated, PII-free attempt token (never the
   * customer email or any request field).
   */
  order_submitted: { attempt_id: string; item_count_claimed: number };
  /**
   * Emitted exactly once per accepted order, after validate + persist.
   * This is the canonical observed order count for the intake pipeline
   * (distinct from checkout's order_created, which covers the
   * payment-instruction flow — same order, different action, no dedupe).
   */
  order_accepted: { order_id: string; total_cents: number; item_count: number };
  /**
   * Emitted when intake fails. stage drives triage; error text is never
   * included (it may echo client input).
   */
  order_rejected: {
    attempt_id: string;
    stage: 'validation' | 'persistence';
    error_count: number;
  };
}

/** Compile-time-checked properties for an event name. */
export type OrderEventProps<E extends OrderAnalyticsEventName> =
  OrderAnalyticsEventProperties[E];

/** Dedupe contract: every event here is server-owned, never client. */
export const ORDER_EVENT_OWNERSHIP = {
  order_submitted: 'server',
  order_accepted: 'server',
  order_rejected: 'server',
} as const satisfies Record<OrderAnalyticsEventName, 'server'>;

/**
 * Ownership lifecycle stage per event (2026-10-05 current truth).
 * Emission is WIRED in app/api/orders/route.ts; receipt is BLOCKED on the
 * owner's phc_ key. Stages advance only through the 7-stage lifecycle —
 * ownership transfers only after VERIFIED, never on conversion alone.
 */
export const ORDER_EVENT_STAGES: Record<
  OrderAnalyticsEventName,
  OwnershipStage
> = {
  order_submitted: 'feature_tested',
  order_accepted: 'feature_tested',
  order_rejected: 'feature_tested',
};

/** Merge check: every order-intake event must now exist in the central taxonomy
 * with matching server ownership (Phase 2 consolidation complete). */
const _mergeCheck: readonly string[] = (
  Object.values(ORDER_ANALYTICS_EVENT_NAMES) as string[]
).filter((n) => !(Object.values(ANALYTICS_EVENT_NAMES) as string[]).includes(n));
if (_mergeCheck.length > 0) {
  throw new Error(
    `Order analytics missing from central taxonomy: ${_mergeCheck.join(', ')}`,
  );
}

/** The order-intake taxonomy count is a contract — bump deliberately. */
const ORDER_EVENT_COUNT = 3;
const _countCheck: Record<OrderAnalyticsEventName, true> = {
  order_submitted: true,
  order_accepted: true,
  order_rejected: true,
};
if (Object.keys(_countCheck).length !== ORDER_EVENT_COUNT) {
  throw new Error('Order analytics taxonomy drift: expected 3 events');
}
