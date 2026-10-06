/**
 * Typed PostHog event definitions for the contact pipeline (G5).
 *
 * PATTERN NOTE: mirrors the typed contract pattern in
 * lib/analytics/events.ts but lives SEPARATE from it — the coordinator
 * merges all event definitions into events.ts centrally, so that file is
 * not edited here. After the merge these definitions should be deleted and
 * call sites switched to ANALYTICS_EVENT_NAMES.
 *
 * Ownership: all three events are SERVER-owned. The Route Handler
 * (app/api/contact/route.ts) emits them — the server is the only party
 * that can attest a contact submission, its acceptance, or its rejection.
 * No client event with any of these names may exist (dedupe contract).
 *
 * PostHog = behavioral observation, never authority. Payloads carry NO
 * PII: message_id / attempt_id / topic only — never name, email, phone, or
 * message text. The contact message store is the source of truth.
 *
 * Status vocabulary: WIRED (code exists) / BLOCKED (waiting on the owner's
 * phc_ key). Nothing here is marked IMPLEMENTED — PostHog receipt is
 * verified in Live Events only, per the ownership lifecycle.
 *
 * TRACEABILITY (owner Phase 2 directive 2026-10-05 ~17:45 MDT —
 * name → reason → legacy equivalent → owner → purpose):
 * - contact_submitted → reason: observe contact attempts before
 *   validation (funnel entry; spam-filtered attempts counted here as
 *   rejections, never as content) → legacy equivalent: none directly
 *   (legacy contact.html POSTed to Netlify form-relay with no typed
 *   client/server event contract) → owner: server → purpose: submission
 *   volume, PII-free.
 * - contact_accepted → reason: canonical observed count of accepted
 *   contact messages (validated + persisted) → legacy equivalent:
 *   form-relay success (untyped, Netlify-side) → owner: server →
 *   purpose: recorded-fact of message acceptance; the message store is
 *   the authority.
 * - contact_rejected → reason: distinguish validation (422), persistence
 *   (500), and spam_filtered stages → legacy equivalent: none (legacy
 *   had no typed rejection signal) → owner: server → purpose: pipeline
 *   health triage; honeypot trips counted without revealing the trap.
 */
import type { OwnershipStage } from './events';
import { ANALYTICS_EVENT_NAMES } from './events';

/** Canonical names. Add new events here — never inline a string elsewhere. */
export const CONTACT_ANALYTICS_EVENT_NAMES = {
  /** Server received a contact POST (attempt observation). */
  contactSubmitted: 'contact_submitted',
  /** Server validated + persisted the message (canonical observed intake). */
  contactAccepted: 'contact_accepted',
  /** Server rejected the submission (validation or persistence failure). */
  contactRejected: 'contact_rejected',
} as const;

export type ContactAnalyticsEventName =
  (typeof CONTACT_ANALYTICS_EVENT_NAMES)[keyof typeof CONTACT_ANALYTICS_EVENT_NAMES];

/** Compile-time-checked properties per event. No PII anywhere. */
export interface ContactAnalyticsEventProperties {
  /**
   * Emitted when POST /api/contact receives a body — before validation.
   * attempt_id is a server-generated, PII-free attempt token.
   */
  contact_submitted: { attempt_id: string };
  /** Emitted exactly once per accepted message, after validate + persist. */
  contact_accepted: { message_id: string; topic: string };
  /**
   * Emitted when the pipeline fails. stage drives triage; error text is
   * never included (it may echo client input). spam_filtered is counted
   * here (honeypot trips) without any detail about the submission.
   */
  contact_rejected: {
    attempt_id: string;
    stage: 'validation' | 'persistence' | 'spam_filtered';
    error_count: number;
  };
}

/** Compile-time-checked properties for an event name. */
export type ContactEventProps<E extends ContactAnalyticsEventName> =
  ContactAnalyticsEventProperties[E];

/** Dedupe contract: every event here is server-owned, never client. */
export const CONTACT_EVENT_OWNERSHIP = {
  contact_submitted: 'server',
  contact_accepted: 'server',
  contact_rejected: 'server',
} as const satisfies Record<ContactAnalyticsEventName, 'server'>;

/**
 * Ownership lifecycle stage per event (2026-10-05 current truth).
 * Emission is WIRED in app/api/contact/route.ts; receipt is BLOCKED on
 * the owner's phc_ key. Stages advance only through the 7-stage
 * lifecycle — ownership transfers only after VERIFIED, never on
 * conversion alone.
 */
export const CONTACT_EVENT_STAGES: Record<
  ContactAnalyticsEventName,
  OwnershipStage
> = {
  contact_submitted: 'feature_tested',
  contact_accepted: 'feature_tested',
  contact_rejected: 'feature_tested',
};

/** Merge check: every contact event must now exist in the central taxonomy
 * with matching server ownership (Phase 2 consolidation complete). */
const _mergeCheck: readonly string[] = (
  Object.values(CONTACT_ANALYTICS_EVENT_NAMES) as string[]
).filter((n) => !(Object.values(ANALYTICS_EVENT_NAMES) as string[]).includes(n));
if (_mergeCheck.length > 0) {
  throw new Error(
    `Contact analytics missing from central taxonomy: ${_mergeCheck.join(', ')}`,
  );
}

/** The contact taxonomy count is a contract — bump deliberately. */
const CONTACT_EVENT_COUNT = 3;
const _countCheck: Record<ContactAnalyticsEventName, true> = {
  contact_submitted: true,
  contact_accepted: true,
  contact_rejected: true,
};
if (Object.keys(_countCheck).length !== CONTACT_EVENT_COUNT) {
  throw new Error('Contact analytics taxonomy drift: expected 3 events');
}
