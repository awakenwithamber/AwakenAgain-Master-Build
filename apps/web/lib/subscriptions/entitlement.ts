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
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 * Fails CLOSED: a missing/unreadable ledger or malformed line means
 * "not entitled", never an exception into checkout.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  SubscriptionRecord,
  SubscriptionStatus,
} from './subscriptions';

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
      const parsed = JSON.parse(trimmed) as {
        customer?: { email?: unknown };
        status?: unknown;
      };
      const email = normalizeSubscriptionEmail(parsed?.customer?.email);
      if (email && typeof parsed?.status === 'string') {
        entries.push({ email, status: parsed.status });
      }
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
