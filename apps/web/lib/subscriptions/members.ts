/**
 * Subscription member list — admin read model over the subscription ledger.
 *
 * The subscription ledger (see lib/subscriptions/entitlement.ts) is
 * append-only: signups, owner confirmations, and cancellations are lines
 * appended over time, and the LATEST line for an email is its current
 * state. This module is the management view of that same truth — one row
 * per email, resolved from the latest line — for the admin subscriptions
 * page. It adds no state and no second source of truth.
 *
 * Reads are tolerant in the codebase's ledger style: a missing file means
 * "no members yet" and malformed lines are skipped, never thrown.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import {
  normalizeSubscriptionEmail,
  subscriptionsLedgerPath,
} from './entitlement';
import type { SubscriptionRecord, SubscriptionStatus } from './subscriptions';
import {
  EVENT_STREAMS,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

/**
 * A ledger line as stored. Cancellation lines appended by the owner
 * cancel route additionally carry cancelled_at / cancelled_by stamps;
 * the base record shape (lib/subscriptions/subscriptions.ts) does not
 * declare them, so they are read loosely here.
 */
export type StoredSubscriptionRecord = SubscriptionRecord & {
  cancelled_at?: string | null;
  cancelled_by?: 'owner' | null;
};

export interface SubscriptionMember {
  /** Normalized (trimmed, lowercased) member email — the ledger key. */
  email: string;
  name: string;
  status: SubscriptionStatus;
  subscription_id: string;
  /** When the member first signed up (the record's created_at). */
  signed_up_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  price_cents: number;
  plan_name: string;
  /* Stage 3 Stripe lifecycle fields (null for manual members). */
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  past_due_since: string | null;
  current_period_end: string | null;
  paid_through: string | null;
  cancel_at_period_end: boolean;
}

/**
 * Read every well-formed subscription record in append order. A line
 * counts when it carries a customer email and a string status — the same
 * tolerance the entitlement reader applies.
 */
export function readSubscriptionRecords(
  ledgerPath: string = subscriptionsLedgerPath(),
): StoredSubscriptionRecord[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return []; // no ledger yet → no members
  }
  const records: StoredSubscriptionRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as StoredSubscriptionRecord;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof parsed.status === 'string' &&
        normalizeSubscriptionEmail(parsed.customer?.email)
      ) {
        records.push(parsed);
      }
    } catch {
      // skip malformed line — never let ledger noise break the admin view
    }
  }
  return records;
}

const STATUS_ORDER: Record<SubscriptionStatus, number> = {
  pending_payment: 0,
  past_due: 1,
  active: 2,
  cancelled: 3,
};

/** Project latest-per-email records to sorted member rows. */
function projectMembers(
  latestByEmail: Map<string, StoredSubscriptionRecord>,
): SubscriptionMember[] {
  const members: SubscriptionMember[] = [];
  for (const [email, record] of latestByEmail) {
    members.push({
      email,
      name: record.customer.name,
      status: record.status,
      subscription_id: record.subscription_id,
      signed_up_at: record.created_at,
      confirmed_at: record.confirmed_at ?? null,
      cancelled_at: record.cancelled_at ?? null,
      price_cents: record.price_cents,
      plan_name: record.plan_name,
      stripe_customer_id: record.stripe_customer_id ?? null,
      stripe_subscription_id: record.stripe_subscription_id ?? null,
      past_due_since: record.past_due_since ?? record.failed_at ?? null,
      current_period_end: record.current_period_end ?? null,
      paid_through: record.paid_through ?? record.current_period_end ?? null,
      cancel_at_period_end: Boolean(record.cancel_at_period_end),
    });
  }
  members.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return byStatus !== 0 ? byStatus : a.email.localeCompare(b.email);
  });
  return members;
}

/**
 * One row per member email, resolved from the LATEST ledger line
 * (entitlement semantics), sorted for triage: members awaiting payment
 * confirmation first, then active, then cancelled; alphabetical by email
 * within each group.
 */
export function listSubscriptionMembers(
  ledgerPath: string = subscriptionsLedgerPath(),
): SubscriptionMember[] {
  const latestByEmail = new Map<string, StoredSubscriptionRecord>();
  for (const record of readSubscriptionRecords(ledgerPath)) {
    latestByEmail.set(normalizeSubscriptionEmail(record.customer.email), record);
  }
  return projectMembers(latestByEmail);
}

/**
 * listSubscriptionMembers, driver-aware (Phase 3 Step 1). With
 * DATABASE_URL set, folds the 'subscriptions' event stream with the
 * same acceptance rule readSubscriptionRecords applies to JSONL lines;
 * unset, delegates to the JSONL implementation unchanged.
 */
export async function listSubscriptionMembersAsync(): Promise<
  SubscriptionMember[]
> {
  if (!postgresEnabled()) return listSubscriptionMembers();
  const events = await readStreamEvents<StoredSubscriptionRecord>(
    EVENT_STREAMS.subscriptions,
  );
  const latestByEmail = new Map<string, StoredSubscriptionRecord>();
  for (const event of events) {
    const parsed = event.payload;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof parsed.status === 'string' &&
      normalizeSubscriptionEmail(parsed.customer?.email)
    ) {
      latestByEmail.set(
        normalizeSubscriptionEmail(parsed.customer.email),
        parsed,
      );
    }
  }
  return projectMembers(latestByEmail);
}
