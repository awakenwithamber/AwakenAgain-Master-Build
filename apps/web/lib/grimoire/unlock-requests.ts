/**
 * Grimoire PERMANENT_UNLOCK requests — the manual-payment rail
 * (Phase 2, Workstream 3; scope per the owner-approved decision packet
 * ~/workspace/goals/accept-payments-online/files/
 * grimoire-phase2-bookipi-decision-packet-2026-10-24.md).
 *
 * Flow: the customer asks for the unlock at /grimoire/subscribe with
 * their email → a PENDING request is recorded here → they pay exactly
 * $8.88 by emailed Bookipi invoice or Venmo / Cash App, using the
 * request ID as the payment reference → the OWNER verifies the payment
 * and grants access from the admin endpoint (POST
 * /api/admin/grimoire/unlock), which writes the entitlement through
 * lib/grimoire/unlock.ts (source 'owner_manual') → the customer gets
 * the "unlock is active" email. A pending request grants NOTHING by
 * itself — entitlement reads only the unlock ledger.
 *
 * Storage follows the repo's append-only pattern: DATABASE_URL set →
 * the Postgres event store ('grimoire_unlock_requests' stream, keyed
 * by request_id); unset → the local JSONL ledger
 * (.grimoire-unlock-requests.jsonl, override
 * GRIMOIRE_UNLOCK_REQUESTS_LEDGER_PATH). A request's state is the
 * latest record for its request_id — history is never edited.
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
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from './edition';

export type UnlockRequestStatus = 'requested' | 'granted' | 'cancelled';
export type UnlockPaymentMethod = 'bookipi_invoice' | 'cash_app_or_venmo';

export interface UnlockRequestRecord {
  request_id: string;
  /** Normalized (trimmed, lowercased) customer email. */
  email: string;
  /** Always GRIMOIRE_UNLOCK_PRICE_CENTS — the $8.88 unlock, exactly. */
  amount_cents: number;
  payment_method: UnlockPaymentMethod;
  status: UnlockRequestStatus;
  /** The payment reference the owner verified, once granted. */
  granted_reference: string | null;
  /** ISO timestamp this record was appended. */
  created_at: string;
}

export function grimoireUnlockRequestsLedgerPath(): string {
  return (
    process.env.GRIMOIRE_UNLOCK_REQUESTS_LEDGER_PATH ??
    join(process.cwd(), '.grimoire-unlock-requests.jsonl')
  );
}

export function generateUnlockRequestId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `UNLOCK-${date}-${rand}`;
}

function isUnlockRequestRecord(v: unknown): v is UnlockRequestRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.request_id === 'string' &&
    typeof r.email === 'string' &&
    (r.status === 'requested' || r.status === 'granted' || r.status === 'cancelled')
  );
}

/** Every request record, in append order (driver-aware). */
export async function readUnlockRequestRecords(): Promise<UnlockRequestRecord[]> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<UnlockRequestRecord>(
      EVENT_STREAMS.grimoireUnlockRequests,
    );
    const records: UnlockRequestRecord[] = [];
    for (const event of events) {
      if (isUnlockRequestRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(grimoireUnlockRequestsLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: UnlockRequestRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isUnlockRequestRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

async function appendUnlockRequestRecord(
  record: UnlockRequestRecord,
): Promise<void> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.grimoireUnlockRequests,
      record.request_id,
      `grimoire_unlock_request.${record.status}`,
      record,
      record.created_at,
    );
    return;
  }
  const path = grimoireUnlockRequestsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/** Current state per request_id (latest record wins), append order kept. */
function foldLatest(
  records: readonly UnlockRequestRecord[],
): UnlockRequestRecord[] {
  const byId = new Map<string, UnlockRequestRecord>();
  for (const record of records) byId.set(record.request_id, record);
  return [...byId.values()];
}

/** The newest request state for one request_id, or null. */
export async function findUnlockRequest(
  requestId: string,
): Promise<UnlockRequestRecord | null> {
  const all = foldLatest(await readUnlockRequestRecords());
  return all.find((r) => r.request_id === requestId) ?? null;
}

/** Every request at its current state, newest first (admin list). */
export async function listUnlockRequests(): Promise<UnlockRequestRecord[]> {
  const all = foldLatest(await readUnlockRequestRecords());
  return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** The newest PENDING ('requested') request for an email, or null. */
export async function findPendingUnlockRequest(
  email: unknown,
): Promise<UnlockRequestRecord | null> {
  const target = normalizeSubscriptionEmail(email);
  if (!target) return null;
  const all = foldLatest(await readUnlockRequestRecords());
  const pending = all.filter(
    (r) => r.email === target && r.status === 'requested',
  );
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

/** Create a pending request. Caller checks duplicates first. */
export async function createUnlockRequest(input: {
  email: unknown;
  payment_method: UnlockPaymentMethod;
}): Promise<UnlockRequestRecord> {
  const email = normalizeSubscriptionEmail(input.email);
  if (!email) throw new Error('A valid email address is required.');
  const record: UnlockRequestRecord = {
    request_id: generateUnlockRequestId(),
    email,
    amount_cents: GRIMOIRE_UNLOCK_PRICE_CENTS,
    payment_method: input.payment_method,
    status: 'requested',
    granted_reference: null,
    created_at: new Date().toISOString(),
  };
  await appendUnlockRequestRecord(record);
  return record;
}

/** Append a state transition for an existing request (grant/cancel). */
export async function transitionUnlockRequest(
  requestId: string,
  status: Exclude<UnlockRequestStatus, 'requested'>,
  grantedReference: string | null = null,
): Promise<UnlockRequestRecord | null> {
  const current = await findUnlockRequest(requestId);
  if (!current) return null;
  if (current.status === status) return current;
  const next: UnlockRequestRecord = {
    ...current,
    status,
    granted_reference:
      status === 'granted' ? (grantedReference ?? current.granted_reference) : current.granted_reference,
    created_at: new Date().toISOString(),
  };
  await appendUnlockRequestRecord(next);
  return next;
}
