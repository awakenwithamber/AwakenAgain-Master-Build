/**
 * Subscriber entitlement lookup — SERVER AUTHORITY.
 *
 * A customer-facing claim ("I'm a Living Grimoire subscriber") is never
 * proof. Benefits (free shipping with no minimum + the advertised 10%
 * storewide discount) require a subscription record the SERVER holds for
 * the order's email whose status means entitled.
 *
 * Entitled status set — evidence from this codebase:
 * `SubscriptionStatus` (lib/subscriptions/subscriptions.ts) is exactly
 * 'pending_payment' | 'active' | 'cancelled', and a record becomes
 * 'active' ONLY through `confirmSubscription()` — owner confirmation of
 * the first payment. There is no client path to 'active' and no 'paid' /
 * 'comped' status anywhere in the subscription code. Therefore:
 *
 *   ENTITLED = { 'active' }   — and nothing else.
 *
 * 'pending_payment' (signed up, payment not yet confirmed by Amber) is
 * NOT entitled; 'cancelled' is NOT entitled.
 *
 * Source of truth today: the append-only JSONL subscription ledger — the
 * same file POST /api/subscriptions appends to
 * (SUBSCRIPTIONS_LEDGER_PATH ?? <cwd>/.subscriptions-ledger.jsonl).
 * The ledger is append-only, so the LATEST line for an email is its
 * current state (a later cancellation supersedes an earlier activation).
 *
 * Phase 3 Step 1 (store binding): the driver-aware async accessors at
 * the bottom of this module read/write the append-only Postgres event
 * store instead when DATABASE_URL is set — same append-only law, same
 * latest-wins fold, same fail-closed absence. Routes/pages use those;
 * the synchronous functions above remain the JSONL implementation.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 * Fails CLOSED: a missing/unreadable ledger or malformed line means
 * "not entitled", never an exception into checkout.
 */
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  SubscriptionRecord,
  SubscriptionStatus,
} from './subscriptions';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

/** The only subscription statuses that grant checkout benefits. */
export const SUBSCRIBER_ENTITLED_STATUSES: readonly SubscriptionStatus[] = [
  'active',
];

/** Ledger path — the single source of truth, shared with the subscribe route. */
export function subscriptionsLedgerPath(): string {
  return (
    process.env.SUBSCRIPTIONS_LEDGER_PATH ??
    join(process.cwd(), '.subscriptions-ledger.jsonl')
  );
}

/**
 * Email matching is case-insensitive and trimmed (the same normalization
 * sanitizeEmail applies on write: trim + lowercase).
 */
export function normalizeSubscriptionEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export interface SubscriptionLedgerEntry {
  /** Normalized (trimmed, lowercased) customer email. */
  email: string;
  status: string;
}

/**
 * The ledger acceptance rule, shared by the JSONL reader and the
 * Postgres reader: a stored object counts when it carries a customer
 * email that normalizes non-empty and a string status. Anything else is
 * ledger noise and is skipped — never thrown, never entitled.
 */
export function subscriptionEntryFromParsed(
  parsed: unknown,
): SubscriptionLedgerEntry | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const candidate = parsed as {
    customer?: { email?: unknown };
    status?: unknown;
  };
  const email = normalizeSubscriptionEmail(candidate.customer?.email);
  if (email && typeof candidate.status === 'string') {
    return { email, status: candidate.status };
  }
  return null;
}

/**
 * Read the subscription ledger, tolerating a missing file and skipping
 * malformed lines. Returns entries in append order.
 */
export function readSubscriptionLedger(
  ledgerPath: string = subscriptionsLedgerPath(),
): SubscriptionLedgerEntry[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return []; // no ledger yet → nobody is entitled
  }
  const entries: SubscriptionLedgerEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = subscriptionEntryFromParsed(JSON.parse(trimmed));
      if (entry) entries.push(entry);
    } catch {
      // skip malformed line — never let ledger noise break checkout
    }
  }
  return entries;
}

/**
 * The latest FULL subscription record the server holds for this email, or
 * undefined when the ledger holds none. Same tolerant read as
 * readSubscriptionLedger (missing file / malformed lines never throw).
 * Used by the owner confirmation route, which needs the whole record to
 * hand to `confirmSubscription()`; entitlement checks above only need
 * {email, status} and keep using the lighter reader.
 */
export function findLatestSubscriptionRecord(
  email: unknown,
  ledgerPath: string = subscriptionsLedgerPath(),
): SubscriptionRecord | undefined {
  const target = normalizeSubscriptionEmail(email);
  if (!target) return undefined;
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return undefined; // no ledger yet → no record for anyone
  }
  let latest: SubscriptionRecord | undefined;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as SubscriptionRecord;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof parsed.status === 'string' &&
        normalizeSubscriptionEmail(parsed.customer?.email) === target
      ) {
        latest = parsed;
      }
    } catch {
      // skip malformed line — same tolerance as readSubscriptionLedger
    }
  }
  return latest;
}

/**
 * True only when the server holds a subscription record for this email
 * whose LATEST status is entitled (see the status-set evidence above).
 */
export function isEntitledSubscriber(
  email: unknown,
  ledgerPath?: string,
): boolean {
  const target = normalizeSubscriptionEmail(email);
  if (!target) return false;
  let latest: SubscriptionLedgerEntry | undefined;
  for (const entry of readSubscriptionLedger(ledgerPath)) {
    if (entry.email === target) latest = entry;
  }
  return (
    latest !== undefined &&
    (SUBSCRIBER_ENTITLED_STATUSES as readonly string[]).includes(latest.status)
  );
}

/* ------------------------------------------------------------------ */
/* Driver-aware async accessors (Phase 3 Step 1: store binding)        */
/*                                                                     */
/* The functions above are the JSONL implementation and stay exactly   */
/* as they were. The async variants below are what routes and pages    */
/* call: with DATABASE_URL unset they delegate to the JSONL functions  */
/* (byte-identical behavior); with it set they read/write the          */
/* append-only Postgres event store, folding events with the SAME      */
/* acceptance rules and the SAME latest-line-wins loop — state         */
/* resolution is a fold over history in both drivers, never a mutate.  */
/* ------------------------------------------------------------------ */

/**
 * Append one subscription record to the ledger. JSONL driver: appends
 * the exact line the routes used to write themselves. Postgres driver:
 * inserts one 'subscriptions' event keyed by the normalized email.
 */
export async function appendSubscriptionRecord(
  record: SubscriptionRecord,
): Promise<void> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.subscriptions,
      normalizeSubscriptionEmail(record.customer?.email),
      `subscription.${record.status}`,
      record,
      record.created_at,
    );
    return;
  }
  const path = subscriptionsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/** readSubscriptionLedger, driver-aware. Entries in append order. */
export async function readSubscriptionLedgerAsync(): Promise<
  SubscriptionLedgerEntry[]
> {
  if (!postgresEnabled()) return readSubscriptionLedger();
  const events = await readStreamEvents(EVENT_STREAMS.subscriptions);
  const entries: SubscriptionLedgerEntry[] = [];
  for (const event of events) {
    const entry = subscriptionEntryFromParsed(event.payload);
    if (entry) entries.push(entry);
  }
  return entries;
}

/** findLatestSubscriptionRecord, driver-aware. Same acceptance rules. */
export async function findLatestSubscriptionRecordAsync(
  email: unknown,
): Promise<SubscriptionRecord | undefined> {
  if (!postgresEnabled()) return findLatestSubscriptionRecord(email);
  const target = normalizeSubscriptionEmail(email);
  if (!target) return undefined;
  const events = await readStreamEvents(EVENT_STREAMS.subscriptions);
  let latest: SubscriptionRecord | undefined;
  for (const event of events) {
    const parsed = event.payload as unknown as SubscriptionRecord;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof parsed.status === 'string' &&
      normalizeSubscriptionEmail(parsed.customer?.email) === target
    ) {
      latest = parsed;
    }
  }
  return latest;
}

/** isEntitledSubscriber, driver-aware. Entitlement semantics unchanged. */
export async function isEntitledSubscriberAsync(
  email: unknown,
): Promise<boolean> {
  if (!postgresEnabled()) return isEntitledSubscriber(email);
  const target = normalizeSubscriptionEmail(email);
  if (!target) return false;
  let latest: SubscriptionLedgerEntry | undefined;
  for (const entry of await readSubscriptionLedgerAsync()) {
    if (entry.email === target) latest = entry;
  }
  return (
    latest !== undefined &&
    (SUBSCRIBER_ENTITLED_STATUSES as readonly string[]).includes(latest.status)
  );
}
