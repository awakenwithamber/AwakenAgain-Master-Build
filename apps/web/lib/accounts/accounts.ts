/**
 * Customer accounts + profiles — Phase 3 Step 3 (owner spec, repeated
 * 2026-10-15: "each user to create a profile to save progress, searches,
 * likes, herbal allies").
 *
 * An account is keyed to a NORMALIZED EMAIL and is nothing but an
 * append-only ledger of account events, stored through the Step 1 store
 * binding exactly like every other ledger in this app:
 *
 * - JSONL: `.accounts-ledger.jsonl` (env ACCOUNTS_LEDGER_PATH overrides),
 *   one event per line.
 * - Postgres: events in the 'accounts' stream, keyed by the email.
 *
 * Driver selection is by environment at CALL time (DATABASE_URL set →
 * Postgres; unset → JSONL, byte-identical conventions to the other
 * stores). Current state is a FOLD over the events in append order —
 * latest event of each kind wins; nothing is ever updated or deleted.
 * Account deletion is an append-only TOMBSTONE event: after it, the
 * fold reports `deleted: true` forever (there is no resurrection event),
 * sign-in fails closed, and sessions stop resolving.
 *
 * What a profile holds (owner spec):
 * - herbal allies: quiz result snapshots saved to the profile (leads
 *   captured for the same email are linked at read time — see
 *   lib/accounts/profile.ts — never copied or mutated).
 * - likes: product handles (validated against the catalog at write).
 * - saved searches: explicit "save this search" entries (catalog +
 *   herb-library surfaces).
 * - progress: what the site ALREADY tracks on-device (surveyed
 *   2026-10-15: quiz completion and the interest-profile scores —
 *   lib/personalization/interests.ts). No new tracking is invented here.
 *
 * HARD BOUNDARY: an account is NOT a Living Grimoire membership.
 * Nothing in this module reads or writes subscription entitlement;
 * lib/subscriptions/entitlement.ts semantics are untouched, and signing
 * in to an account grants no Grimoire access (that gate keeps its own
 * OTP + entitlement check).
 *
 * SERVER-ONLY: uses node:fs / pg. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';
import { getProductByHandle } from '../catalog/products';
import {
  INTEREST_CATEGORIES,
  MAX_SCORE,
  type InterestProfile,
} from '../personalization/interests';
import type { QuizResultSnapshot } from '../quiz/quiz';

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Account emails normalize exactly like subscription emails (trim +
 * lowercase — the same rule sanitizeEmail applies on write). A separate
 * name so this module never reads as entitlement code.
 */
export function normalizeAccountEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Ledger path — the same convention as the subscription ledger. */
export function accountsLedgerPath(): string {
  return (
    process.env.ACCOUNTS_LEDGER_PATH ??
    join(process.cwd(), '.accounts-ledger.jsonl')
  );
}

/* ------------------------------------------------------------------ */
/* Event records (the append-only ledger lines / event payloads)       */
/* ------------------------------------------------------------------ */

export interface SavedSearch {
  id: string;
  query: string;
  surface: 'catalog' | 'herbs';
  saved_at: string;
}

export interface SavedQuizResult {
  result: QuizResultSnapshot;
  saved_at: string;
  /** 'quiz' — saved from the quiz while signed in; 'lead' — linked lead. */
  via: 'quiz' | 'lead';
}

/**
 * Progress = the progress the site already tracks on-device, persisted:
 * the quiz-completion stamp and a snapshot of the interest profile
 * (lib/personalization/interests.ts accrual: quiz +3, builders +3,
 * section views +1). Article/guide read markers do not exist on-device
 * today (verified by survey 2026-10-15) — nothing is invented here.
 */
export interface AccountProgress {
  quiz_completed_at: string | null;
  interests: InterestProfile | null;
  updated_at: string;
}

interface AccountRecordBase {
  email: string;
  recorded_at: string;
}

export interface AccountCreatedRecord extends AccountRecordBase {
  type: 'account.created';
  display_name: string | null;
}
export interface AccountProfileUpdatedRecord extends AccountRecordBase {
  type: 'account.profile_updated';
  display_name: string | null;
}
export interface AccountLikesUpdatedRecord extends AccountRecordBase {
  type: 'account.likes_updated';
  /** Full replacement set — the fold takes the newest one verbatim. */
  likes: string[];
}
export interface AccountSearchSavedRecord extends AccountRecordBase {
  type: 'account.search_saved';
  search: SavedSearch;
}
export interface AccountSearchRemovedRecord extends AccountRecordBase {
  type: 'account.search_removed';
  search_id: string;
}
export interface AccountQuizResultSavedRecord extends AccountRecordBase {
  type: 'account.quiz_result_saved';
  result: QuizResultSnapshot;
  via: 'quiz' | 'lead';
}
export interface AccountProgressUpdatedRecord extends AccountRecordBase {
  type: 'account.progress_updated';
  progress: AccountProgress;
}
export interface AccountSessionIssuedRecord extends AccountRecordBase {
  type: 'account.session_issued';
  session_id: string;
  issued_at: number;
  /** Unix seconds. */
  expires_at: number;
}
export interface AccountSessionRevokedRecord extends AccountRecordBase {
  type: 'account.session_revoked';
  session_id: string;
}
export interface AccountDeletedRecord extends AccountRecordBase {
  type: 'account.deleted';
}

export type AccountRecord =
  | AccountCreatedRecord
  | AccountProfileUpdatedRecord
  | AccountLikesUpdatedRecord
  | AccountSearchSavedRecord
  | AccountSearchRemovedRecord
  | AccountQuizResultSavedRecord
  | AccountProgressUpdatedRecord
  | AccountSessionIssuedRecord
  | AccountSessionRevokedRecord
  | AccountDeletedRecord;

export type AccountRecordType = AccountRecord['type'];

/* ------------------------------------------------------------------ */
/* Folded state (the read model)                                       */
/* ------------------------------------------------------------------ */

export interface AccountSessionState {
  session_id: string;
  issued_at: number;
  expires_at: number;
  revoked: boolean;
}

export interface AccountState {
  /** Normalized email — the account key. */
  email: string;
  /** Any event at all exists for this email. */
  exists: boolean;
  /** Tombstone present — terminal: sign-in fails closed, no sessions. */
  deleted: boolean;
  display_name: string | null;
  created_at: string | null;
  likes: string[];
  /** Newest first, capped at MAX_SAVED_SEARCHES. */
  searches: SavedSearch[];
  /** Append order (oldest first). */
  quiz_results: SavedQuizResult[];
  progress: AccountProgress | null;
  sessions: AccountSessionState[];
}

export const MAX_LIKES = 200;
export const MAX_SAVED_SEARCHES = 50;

export function emptyAccountState(email: string): AccountState {
  return {
    email,
    exists: false,
    deleted: false,
    display_name: null,
    created_at: null,
    likes: [],
    searches: [],
    quiz_results: [],
    progress: null,
    sessions: [],
  };
}

const ACCOUNT_RECORD_TYPES: ReadonlySet<string> = new Set([
  'account.created',
  'account.profile_updated',
  'account.likes_updated',
  'account.search_saved',
  'account.search_removed',
  'account.quiz_result_saved',
  'account.progress_updated',
  'account.session_issued',
  'account.session_revoked',
  'account.deleted',
]);

/**
 * Ledger acceptance rule (shared by both drivers, in the codebase's
 * tolerant style): a stored object counts when it carries the account's
 * normalized email and a known account event type.
 */
export function accountRecordFromParsed(
  parsed: unknown,
  email: string,
): AccountRecord | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== 'string' || !ACCOUNT_RECORD_TYPES.has(record.type)) {
    return null;
  }
  if (normalizeAccountEmail(record.email) !== email) return null;
  return record as unknown as AccountRecord;
}

/** Fold one email's records, in append order, into its current state. */
export function foldAccountRecords(
  email: string,
  records: readonly AccountRecord[],
): AccountState {
  const state = emptyAccountState(email);
  const sessionById = new Map<string, AccountSessionState>();
  for (const record of records) {
    state.exists = true;
    switch (record.type) {
      case 'account.created':
        if (state.created_at === null) state.created_at = record.recorded_at;
        if (typeof record.display_name === 'string' && record.display_name) {
          state.display_name = record.display_name;
        }
        break;
      case 'account.profile_updated':
        state.display_name = record.display_name;
        break;
      case 'account.likes_updated':
        state.likes = Array.isArray(record.likes)
          ? record.likes.filter((h): h is string => typeof h === 'string')
          : [];
        break;
      case 'account.search_saved': {
        if (
          !record.search ||
          typeof record.search.id !== 'string' ||
          typeof record.search.query !== 'string'
        ) {
          break;
        }
        // Re-saving the same query on the same surface refreshes it to
        // the newest position instead of duplicating it.
        const q = record.search.query.trim().toLowerCase();
        state.searches = state.searches.filter(
          (s) =>
            !(
              s.query.trim().toLowerCase() === q &&
              s.surface === record.search.surface
            ),
        );
        state.searches.unshift(record.search);
        break;
      }
      case 'account.search_removed':
        state.searches = state.searches.filter(
          (s) => s.id !== record.search_id,
        );
        break;
      case 'account.quiz_result_saved':
        if (record.result && Array.isArray(record.result.allies)) {
          state.quiz_results.push({
            result: record.result,
            saved_at: record.recorded_at,
            via: record.via === 'lead' ? 'lead' : 'quiz',
          });
        }
        break;
      case 'account.progress_updated':
        if (record.progress && typeof record.progress === 'object') {
          state.progress = record.progress;
        }
        break;
      case 'account.session_issued':
        sessionById.set(record.session_id, {
          session_id: record.session_id,
          issued_at: record.issued_at,
          expires_at: record.expires_at,
          revoked: false,
        });
        break;
      case 'account.session_revoked': {
        const session = sessionById.get(record.session_id);
        if (session) session.revoked = true;
        break;
      }
      case 'account.deleted':
        state.deleted = true;
        break;
    }
  }
  state.searches = state.searches.slice(0, MAX_SAVED_SEARCHES);
  state.sessions = [...sessionById.values()];
  return state;
}

/** A session resolves only when issued, unrevoked, unexpired — and the account is not deleted. */
export function sessionIsActive(
  state: AccountState,
  sessionId: string,
  nowSeconds: number,
): boolean {
  if (!state.exists || state.deleted) return false;
  const session = state.sessions.find((s) => s.session_id === sessionId);
  if (!session || session.revoked) return false;
  return session.expires_at >= nowSeconds;
}

/* ------------------------------------------------------------------ */
/* Storage (driver-aware append + read)                                */
/* ------------------------------------------------------------------ */

function nowIso(): string {
  return new Date().toISOString();
}

/** Append one account event through the selected driver. */
export async function appendAccountRecord(
  record: AccountRecord,
): Promise<AccountRecord> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.accounts,
      normalizeAccountEmail(record.email),
      record.type,
      record,
      record.recorded_at,
    );
    return record;
  }
  const path = accountsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Every accepted record for one email, in append order, either driver. */
export async function readAccountRecordsAsync(
  emailInput: unknown,
): Promise<AccountRecord[]> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return [];
  if (postgresEnabled()) {
    const events = await readStreamEvents(EVENT_STREAMS.accounts);
    const records: AccountRecord[] = [];
    for (const event of events) {
      if (event.stream_key !== email) continue;
      const record = accountRecordFromParsed(event.payload, email);
      if (record) records.push(record);
    }
    return records;
  }
  let raw: string;
  try {
    raw = readFileSync(accountsLedgerPath(), 'utf8');
  } catch {
    return []; // no ledger yet → no accounts
  }
  const records: AccountRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = accountRecordFromParsed(JSON.parse(trimmed), email);
      if (record) records.push(record);
    } catch {
      // skip malformed line — ledger noise never breaks account reads
    }
  }
  return records;
}

/** Current folded state for an email (fail-closed absence: exists=false). */
export async function loadAccountAsync(
  emailInput: unknown,
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return emptyAccountState('');
  const records = await readAccountRecordsAsync(email);
  return foldAccountRecords(email, records);
}

/* ------------------------------------------------------------------ */
/* Mutations (each = exactly one appended event)                       */
/* ------------------------------------------------------------------ */

/**
 * Create the account if it has no events yet. A DELETED account is
 * never resurrected: the tombstone is terminal, and this returns the
 * deleted state without appending anything.
 */
export async function ensureAccountAsync(
  emailInput: unknown,
  displayName?: string | null,
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  if (state.exists || state.deleted) return state;
  await appendAccountRecord({
    email,
    type: 'account.created',
    recorded_at: nowIso(),
    display_name: displayName ?? null,
  });
  return loadAccountAsync(email);
}

/**
 * Validate a likes list at the trust boundary: strings only, each must
 * be a real catalog product handle (the profile renders titles from the
 * catalog), de-duplicated, capped. Unknown handles are dropped, never
 * stored — a retired product simply falls off the list.
 */
export function cleanLikes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const likes: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const handle = item.trim();
    if (!handle || seen.has(handle)) continue;
    if (!getProductByHandle(handle)) continue;
    seen.add(handle);
    likes.push(handle);
    if (likes.length >= MAX_LIKES) break;
  }
  return likes;
}

/** Union merge (first-sign-in local sync): stored order, then local additions. */
export function mergeLikes(stored: string[], local: unknown): string[] {
  const merged = [...stored];
  for (const handle of cleanLikes(local)) {
    if (!merged.includes(handle)) merged.push(handle);
  }
  return merged.slice(0, MAX_LIKES);
}

export async function setLikesAsync(
  emailInput: unknown,
  likes: string[],
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.likes_updated',
    recorded_at: nowIso(),
    likes: cleanLikes(likes),
  });
  return loadAccountAsync(email);
}

export function cleanSearchQuery(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const query = input.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 120) return null;
  return query;
}

export async function saveSearchAsync(
  emailInput: unknown,
  query: string,
  surface: SavedSearch['surface'],
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  const search: SavedSearch = {
    id: randomUUID(),
    query,
    surface,
    saved_at: nowIso(),
  };
  await appendAccountRecord({
    email,
    type: 'account.search_saved',
    recorded_at: search.saved_at,
    search,
  });
  return loadAccountAsync(email);
}

export async function removeSearchAsync(
  emailInput: unknown,
  searchId: string,
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.search_removed',
    recorded_at: nowIso(),
    search_id: searchId,
  });
  return loadAccountAsync(email);
}

export async function saveQuizResultAsync(
  emailInput: unknown,
  result: QuizResultSnapshot,
  via: 'quiz' | 'lead' = 'quiz',
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.quiz_result_saved',
    recorded_at: nowIso(),
    result,
    via,
  });
  // Saving a result IS quiz completion — stamp the progress marker in
  // the same breath (progress folds latest-wins, so merge forward).
  const state = await loadAccountAsync(email);
  await appendAccountRecord({
    email,
    type: 'account.progress_updated',
    recorded_at: nowIso(),
    progress: {
      quiz_completed_at:
        state.progress?.quiz_completed_at ?? new Date().toISOString(),
      interests: state.progress?.interests ?? null,
      updated_at: nowIso(),
    },
  });
  return loadAccountAsync(email);
}

/**
 * Validate an on-device interest snapshot at the trust boundary, using
 * the personalization module's own rules (six known categories, finite
 * numbers, floored, capped at MAX_SCORE, zero/negative dropped).
 */
export function cleanInterestSnapshot(input: unknown): InterestProfile | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const source = input as Record<string, unknown>;
  const snapshot = {} as InterestProfile;
  let any = false;
  for (const category of INTEREST_CATEGORIES) {
    const value = source[category];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      snapshot[category] = Math.min(MAX_SCORE, Math.floor(value));
      any = true;
    } else {
      snapshot[category] = 0;
    }
  }
  return any ? snapshot : null;
}

/**
 * Merge a progress update forward: a provided quiz_completed_at stamps
 * completion (an existing stamp is never erased), a provided interest
 * snapshot replaces the stored one (it is a device snapshot by design).
 */
export async function updateProgressAsync(
  emailInput: unknown,
  update: {
    quiz_completed_at?: string | null;
    interests?: InterestProfile | null;
  },
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  const state = await loadAccountAsync(email);
  await appendAccountRecord({
    email,
    type: 'account.progress_updated',
    recorded_at: nowIso(),
    progress: {
      quiz_completed_at:
        update.quiz_completed_at ?? state.progress?.quiz_completed_at ?? null,
      interests:
        update.interests !== undefined
          ? update.interests
          : (state.progress?.interests ?? null),
      updated_at: nowIso(),
    },
  });
  return loadAccountAsync(email);
}

export async function issueSessionRecordAsync(
  emailInput: unknown,
  session: { session_id: string; issued_at: number; expires_at: number },
): Promise<void> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.session_issued',
    recorded_at: nowIso(),
    session_id: session.session_id,
    issued_at: session.issued_at,
    expires_at: session.expires_at,
  });
}

export async function revokeSessionRecordAsync(
  emailInput: unknown,
  sessionId: string,
): Promise<void> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.session_revoked',
    recorded_at: nowIso(),
    session_id: sessionId,
  });
}

/**
 * Delete the account: ONE tombstone event. Sessions stop resolving
 * (sessionIsActive checks the tombstone), sign-in fails closed, and the
 * fold keeps reporting deleted:true. The ledger lines themselves are
 * never erased — append-only is the storage law; the tombstone is what
 * "deleted" means, and exports after deletion return the tombstone
 * state only (see lib/accounts/profile.ts).
 */
export async function deleteAccountAsync(
  emailInput: unknown,
): Promise<AccountState> {
  const email = normalizeAccountEmail(emailInput);
  await appendAccountRecord({
    email,
    type: 'account.deleted',
    recorded_at: nowIso(),
  });
  return loadAccountAsync(email);
}
