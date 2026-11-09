/**
 * Grimoire PERMANENT_UNLOCK entitlement — SERVER AUTHORITY (Stage 2).
 *
 * Owner decision 2026-10-21 (§13(1) + §13(2), binding):
 * - The canonical edition is the 333-page edition — edition id
 *   'living-grimoire-333', displayed as "Living Grimoire — 333-page
 *   edition". There is NO 117-page edition.
 * - The $8.88 one-time PERMANENT_UNLOCK covers the full composed
 *   edition (owner decision 2026-11-02, WS4): the complete current
 *   edition PLUS the collected works bound with it (1,051 pages in
 *   all) and all future chapters/revisions of that composed
 *   edition. Separate future editions and add-on products are NOT
 *   included.
 * - Refund / chargeback of the unlock transaction REVOKES it.
 * - Permanent rights survive subscription cancellation; subscribing
 *   never removes them (this ledger is independent of subscriptions).
 *
 * Storage follows the repo's append-only ledger pattern (same driver
 * selection as lib/subscriptions/entitlement.ts and
 * lib/payments/stripe.ts): DATABASE_URL set → the Postgres event
 * store ('grimoire_unlocks' stream, keyed by normalized email);
 * unset → the local JSONL ledger (.grimoire-unlocks.jsonl, override
 * GRIMOIRE_UNLOCKS_LEDGER_PATH). State is a latest-wins fold over the
 * email's records — history is never edited.
 *
 * Grant/revoke are IDEMPOTENT: granting a transaction that is already
 * the active grant for the email records nothing new; revoking an
 * already-revoked (or unknown) transaction changes nothing.
 *
 * SERVER-ONLY: uses node:fs / pg. Never import from a client component.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';
import { normalizeSubscriptionEmail } from '../subscriptions/entitlement';

export {
  GRIMOIRE_EDITION_ID,
  GRIMOIRE_EDITION_NAME,
  GRIMOIRE_UNLOCK_PRICE_CENTS,
  GRIMOIRE_UNLOCK_SCOPE,
} from './edition';
import { GRIMOIRE_EDITION_ID, GRIMOIRE_UNLOCK_SCOPE } from './edition';

export type UnlockState = 'active' | 'revoked';
export type UnlockRevokeReason = 'refund' | 'chargeback';

export interface GrimoireUnlockRecord {
  /** Normalized (trimmed, lowercased) buyer email. */
  email: string;
  type: 'PERMANENT_UNLOCK';
  edition_id: typeof GRIMOIRE_EDITION_ID;
  /** Human-readable scope note (owner decision §13(2), 2026-10-21). */
  scope: string;
  /** ISO timestamp the entitlement took effect (grant time). */
  effective_at: string;
  /**
   * Primary transaction reference: the Stripe payment intent id when
   * known, else the checkout session id, else the charge id.
   */
  transaction_ref: string;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  charge_id: string | null;
  state: UnlockState;
  revoked_at: string | null;
  revoked_reason: UnlockRevokeReason | null;
  /**
   * Provenance: which verified path wrote this record — the
   * signature-verified Stripe webhook (historical/dormant) or the
   * owner's manual grant (Phase 2, Workstream 3: the owner records a
   * verified $8.88 payment through POST /api/admin/grimoire/unlock).
   */
  source: 'stripe_webhook' | 'owner_manual';
  /** ISO timestamp this ledger record was appended. */
  created_at: string;
}

export function grimoireUnlocksLedgerPath(): string {
  return (
    process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH ??
    join(process.cwd(), '.grimoire-unlocks.jsonl')
  );
}

function isUnlockRecord(v: unknown): v is GrimoireUnlockRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    r.type === 'PERMANENT_UNLOCK' &&
    typeof r.email === 'string' &&
    typeof r.transaction_ref === 'string' &&
    (r.state === 'active' || r.state === 'revoked')
  );
}

/** Every unlock record, in append order (driver-aware). */
export async function readUnlockRecords(): Promise<GrimoireUnlockRecord[]> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<GrimoireUnlockRecord>(
      EVENT_STREAMS.grimoireUnlocks,
    );
    const records: GrimoireUnlockRecord[] = [];
    for (const event of events) {
      if (isUnlockRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(grimoireUnlocksLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: GrimoireUnlockRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isUnlockRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

async function appendUnlockRecord(
  record: GrimoireUnlockRecord,
): Promise<void> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.grimoireUnlocks,
      record.email,
      record.state === 'active'
        ? 'grimoire_unlock.granted'
        : 'grimoire_unlock.revoked',
      record,
      record.created_at,
    );
    return;
  }
  const path = grimoireUnlocksLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/** The latest unlock record for an email, or null when none exists. */
export async function findLatestUnlock(
  email: unknown,
): Promise<GrimoireUnlockRecord | null> {
  const target = normalizeSubscriptionEmail(email);
  if (!target) return null;
  const records = await readUnlockRecords();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].email === target) return records[i];
  }
  return null;
}

/**
 * Find an unlock record by ANY of its Stripe references (session id,
 * payment intent id, charge id, or the primary transaction_ref). The
 * refund/dispute webhook handlers resolve through this: charge events
 * carry the charge id + payment intent, recorded here at grant time.
 * Latest matching record wins.
 */
export async function findUnlockByTransactionRef(
  ref: string | null | undefined,
): Promise<GrimoireUnlockRecord | null> {
  if (!ref) return null;
  const records = await readUnlockRecords();
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (
      r.transaction_ref === ref ||
      r.stripe_session_id === ref ||
      r.payment_intent_id === ref ||
      r.charge_id === ref
    ) {
      return r;
    }
  }
  return null;
}

/** True when the email's LATEST unlock record is active (not revoked). */
export async function isUnlockEntitled(email: unknown): Promise<boolean> {
  const latest = await findLatestUnlock(email);
  return latest !== null && latest.state === 'active';
}

export interface GrantUnlockInput {
  email: unknown;
  stripe_session_id?: string | null;
  payment_intent_id?: string | null;
  charge_id?: string | null;
  /** Explicit primary ref; defaults to payment intent → session → charge. */
  transaction_ref?: string | null;
  effective_at?: string;
  /** Grant provenance — defaults to 'stripe_webhook' (existing callers). */
  source?: 'stripe_webhook' | 'owner_manual';
}

/**
 * Grant the PERMANENT_UNLOCK. Called by the signature-verified Stripe
 * webhook (checkout.session.completed carrying unlock metadata) or —
 * Phase 2, Workstream 3 — by the owner-secret admin grant path with
 * source 'owner_manual' after the owner verifies the $8.88 payment
 * (the transaction_ref is then the payment reference / unlock request
 * ID). Idempotent: when the email's latest record is already an
 * active grant for the same transaction, it is returned as-is and
 * nothing is appended.
 */
export async function grantUnlock(
  input: GrantUnlockInput,
): Promise<GrimoireUnlockRecord> {
  const email = normalizeSubscriptionEmail(input.email);
  if (!email) throw new Error('A valid email address is required to grant an unlock.');
  const transaction_ref =
    input.transaction_ref ??
    input.payment_intent_id ??
    input.stripe_session_id ??
    input.charge_id ??
    null;
  if (!transaction_ref) {
    throw new Error('A transaction reference is required to grant an unlock.');
  }
  const latest = await findLatestUnlock(email);
  if (
    latest &&
    latest.state === 'active' &&
    latest.transaction_ref === transaction_ref
  ) {
    return latest;
  }
  const now = new Date().toISOString();
  const record: GrimoireUnlockRecord = {
    email,
    type: 'PERMANENT_UNLOCK',
    edition_id: GRIMOIRE_EDITION_ID,
    scope: GRIMOIRE_UNLOCK_SCOPE,
    effective_at: input.effective_at ?? now,
    transaction_ref,
    stripe_session_id: input.stripe_session_id ?? null,
    payment_intent_id: input.payment_intent_id ?? null,
    charge_id: input.charge_id ?? null,
    state: 'active',
    revoked_at: null,
    revoked_reason: null,
    source: input.source ?? 'stripe_webhook',
    created_at: now,
  };
  await appendUnlockRecord(record);
  return record;
}

/**
 * Revoke the unlock bound to a transaction reference (refund →
 * 'refund', chargeback/dispute → 'chargeback'; owner decision
 * 2026-10-21 §13(2)). Appends a revoked copy of the grant — history
 * is never edited. Idempotent: an already-revoked or unknown
 * transaction changes nothing (returns the current record or null).
 */
export async function revokeUnlockByTransactionRef(
  ref: string | null | undefined,
  reason: UnlockRevokeReason,
): Promise<GrimoireUnlockRecord | null> {
  const existing = await findUnlockByTransactionRef(ref);
  if (!existing) return null;
  if (existing.state === 'revoked') return existing;
  const now = new Date().toISOString();
  const revoked: GrimoireUnlockRecord = {
    ...existing,
    state: 'revoked',
    revoked_at: now,
    revoked_reason: reason,
    created_at: now,
  };
  await appendUnlockRecord(revoked);
  return revoked;
}

/**
 * Revoke the email's LATEST unlock, whatever rail granted it (Phase 2,
 * Workstream 3 — the admin path for manual grants, whose reference is
 * the unlock request ID / payment reference). Same canon as the
 * by-transaction revoke: refund → 'refund', chargeback → 'chargeback'
 * (owner decision 2026-10-21 §13(2)); appends a revoked copy; an
 * already-revoked or unknown email changes nothing.
 */
export async function revokeLatestUnlockForEmail(
  email: unknown,
  reason: UnlockRevokeReason,
): Promise<GrimoireUnlockRecord | null> {
  const latest = await findLatestUnlock(email);
  if (!latest) return null;
  if (latest.state === 'revoked') return latest;
  const now = new Date().toISOString();
  const revoked: GrimoireUnlockRecord = {
    ...latest,
    state: 'revoked',
    revoked_at: now,
    revoked_reason: reason,
    created_at: now,
  };
  await appendUnlockRecord(revoked);
  return revoked;
}
