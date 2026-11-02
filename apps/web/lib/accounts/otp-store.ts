/**
 * Account verification-code stores — Phase 2B (replaces the in-memory
 * store from the original Workstream 2g scope, per the owner's
 * registration-redesign directive 2026-10-30).
 *
 * ONE store now backs all three code purposes — legacy sign-in,
 * registration email verification, and password reset
 * (lib/accounts/otp.ts owns the semantics: 6-digit codes, 10-minute
 * TTL, scrypt hashing at rest, single use, max 5 attempts; this module
 * owns only persistence).
 *
 * Driver selection mirrors how orders/accounts persist (NOT the
 * Grimoire OTP's in-memory fallback):
 * - DATABASE_URL set → PgAccountOtpStore over the append-only event
 *   store ('account_otp_codes' stream, keyed by request_id; deletes
 *   are tombstone events), exactly like PgOtpStore.
 * - DATABASE_URL unset → JsonlAccountOtpStore at
 *   .account-codes-ledger.jsonl (env ACCOUNT_CODES_LEDGER_PATH
 *   overrides), append-only lines folded latest-wins per request_id —
 *   the same durable behavior the other ledgers have without a
 *   database. There is no configuration in which codes silently live
 *   in process memory only: the JSONL file IS the configured store,
 *   so an unconfigured-looking deployment behaves exactly like the
 *   order/account ledgers do (fail-closed posture preserved — with no
 *   DATABASE_URL the site already runs on its local ledgers).
 *
 * Migration note: the swap invalidates any code issued by the old
 * in-memory store (they were 10-minute ephemeral codes; anyone mid
 * sign-in simply requests a new one).
 *
 * SERVER-ONLY: uses node:fs / pg. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readLatestEvent,
  readStreamEvents,
} from '../events/event-store';
import { normalizeAccountEmail } from './accounts';
import type {
  AccountCodePurpose,
  AccountOtpStore,
  PersistedAccountCodeRequest,
} from './otp';

interface CodeTombstone {
  deleted: true;
  key: string;
}

function isTombstone(v: unknown): v is CodeTombstone {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>).deleted === true
  );
}

function isCodeRecord(v: unknown): v is PersistedAccountCodeRequest {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.request_id === 'string' &&
    typeof r.email === 'string' &&
    typeof r.code_hash === 'string' &&
    typeof r.expires_at === 'number'
  );
}

function purposeOf(record: PersistedAccountCodeRequest): AccountCodePurpose {
  return record.purpose ?? 'account_signin';
}

/* ------------------------------------------------------------------ */
/* JSONL implementation                                                 */
/* ------------------------------------------------------------------ */

export function accountCodesLedgerPath(): string {
  return (
    process.env.ACCOUNT_CODES_LEDGER_PATH ??
    join(process.cwd(), '.account-codes-ledger.jsonl')
  );
}

type LedgerLine = PersistedAccountCodeRequest | CodeTombstone;

/** Fold the whole ledger: latest line per request_id wins. */
function foldLedger(
  ledgerPath: string = accountCodesLedgerPath(),
): Map<string, LedgerLine> {
  const byId = new Map<string, LedgerLine>();
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return byId; // no ledger yet → no codes
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isTombstone(parsed) && typeof parsed.key === 'string') {
        byId.set(parsed.key, parsed);
      } else if (isCodeRecord(parsed)) {
        byId.set(parsed.request_id, parsed);
      }
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return byId;
}

export class JsonlAccountOtpStore implements AccountOtpStore {
  async saveCodeRequest(record: PersistedAccountCodeRequest): Promise<void> {
    const path = accountCodesLedgerPath();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  }

  async getCodeRequest(
    requestId: string,
  ): Promise<PersistedAccountCodeRequest | null> {
    const line = foldLedger().get(requestId);
    if (!line || isTombstone(line)) return null;
    return line;
  }

  async deleteCodeRequest(requestId: string): Promise<void> {
    const path = accountCodesLedgerPath();
    await mkdir(dirname(path), { recursive: true });
    const tombstone: CodeTombstone = { deleted: true, key: requestId };
    await appendFile(path, `${JSON.stringify(tombstone)}\n`, 'utf8');
  }

  async getLatestCodeRequestForEmail(
    email: string,
    purpose: AccountCodePurpose,
  ): Promise<PersistedAccountCodeRequest | null> {
    const target = normalizeAccountEmail(email);
    let latest: PersistedAccountCodeRequest | null = null;
    for (const line of foldLedger().values()) {
      if (isTombstone(line)) continue;
      if (normalizeAccountEmail(line.email) !== target) continue;
      if (purposeOf(line) !== purpose) continue;
      if (line.consumed) continue;
      latest = line;
    }
    return latest;
  }
}

/* ------------------------------------------------------------------ */
/* Postgres implementation (mirrors lib/grimoire/otp.ts PgOtpStore)     */
/* ------------------------------------------------------------------ */

export class PgAccountOtpStore implements AccountOtpStore {
  async saveCodeRequest(record: PersistedAccountCodeRequest): Promise<void> {
    await appendEvent(
      EVENT_STREAMS.accountOtpCodes,
      record.request_id,
      'account_otp.code_request_saved',
      record,
    );
  }

  async getCodeRequest(
    requestId: string,
  ): Promise<PersistedAccountCodeRequest | null> {
    const event = await readLatestEvent<
      PersistedAccountCodeRequest | CodeTombstone
    >(EVENT_STREAMS.accountOtpCodes, requestId);
    if (!event || isTombstone(event.payload)) return null;
    return event.payload;
  }

  async deleteCodeRequest(requestId: string): Promise<void> {
    await appendEvent(
      EVENT_STREAMS.accountOtpCodes,
      requestId,
      'account_otp.code_request_deleted',
      { deleted: true, key: requestId } satisfies CodeTombstone,
    );
  }

  async getLatestCodeRequestForEmail(
    email: string,
    purpose: AccountCodePurpose,
  ): Promise<PersistedAccountCodeRequest | null> {
    const target = normalizeAccountEmail(email);
    const events = await readStreamEvents(EVENT_STREAMS.accountOtpCodes);
    const byId = new Map<string, PersistedAccountCodeRequest | CodeTombstone>();
    for (const event of events) {
      const payload: unknown = event.payload;
      if (isTombstone(payload)) {
        byId.set(event.stream_key, payload);
      } else if (isCodeRecord(payload)) {
        byId.set(payload.request_id, payload);
      }
    }
    let latest: PersistedAccountCodeRequest | null = null;
    for (const line of byId.values()) {
      if (isTombstone(line)) continue;
      if (normalizeAccountEmail(line.email) !== target) continue;
      if (purposeOf(line) !== purpose) continue;
      if (line.consumed) continue;
      latest = line;
    }
    return latest;
  }
}

/* ------------------------------------------------------------------ */
/* Factory (cached by driver, like getSharedOtpStore)                   */
/* ------------------------------------------------------------------ */

export function createAccountOtpStore(): AccountOtpStore {
  return postgresEnabled() ? new PgAccountOtpStore() : new JsonlAccountOtpStore();
}

let sharedStore: { pg: boolean; store: AccountOtpStore } | null = null;

/** The routes' bound store — resolved at call time so env changes rebind. */
export function getSharedAccountOtpStore(): AccountOtpStore {
  const pg = postgresEnabled();
  if (!sharedStore || sharedStore.pg !== pg) {
    sharedStore = { pg, store: createAccountOtpStore() };
  }
  return sharedStore.store;
}
