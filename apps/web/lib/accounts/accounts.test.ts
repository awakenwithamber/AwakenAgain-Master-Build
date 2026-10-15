/**
 * Accounts store — Phase 3 Step 3 (JSONL driver).
 *
 * Locks in: the append-only fold (latest event of each kind wins),
 * likes validation + union merge, saved-search dedupe/cap, quiz-result
 * saves stamping progress, session lifecycle in the fold, and the
 * tombstone contract (deleted is terminal — no resurrection, sessions
 * stop resolving). PG parity for the same assertions lives in
 * lib/accounts/accounts-pg.test.ts (AWAKEN_PG_TEST_URL-gated).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  accountsLedgerPath,
  appendAccountRecord,
  cleanInterestSnapshot,
  cleanLikes,
  deleteAccountAsync,
  emptyAccountState,
  ensureAccountAsync,
  foldAccountRecords,
  issueSessionRecordAsync,
  loadAccountAsync,
  mergeLikes,
  normalizeAccountEmail,
  readAccountRecordsAsync,
  removeSearchAsync,
  revokeSessionRecordAsync,
  saveQuizResultAsync,
  saveSearchAsync,
  sessionIsActive,
  setLikesAsync,
  updateProgressAsync,
  type AccountRecord,
} from './accounts';
import type { QuizResultSnapshot } from '../quiz/quiz';

const EMAIL = 'friend@example.com';
const ROSE = 'gaias-rose-soap';
const CINNAMON = 'warm-cinnamon-comfort-soap';
const CHILL = 'chill-pill-capsules';

const SNAPSHOT: QuizResultSnapshot = {
  concernId: 'stress',
  concernLabel: 'Stress',
  formId: 'tea',
  formLabel: 'Tea',
  allies: [
    {
      name: 'Lemon Balm',
      latin: 'Melissa officinalis',
      evidence: 'traditional',
      note: 'Calming.',
    },
  ],
  productHandles: [CHILL],
  productReason: 'Because stress.',
};

let dir: string;
let savedEnv: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aa-accounts-'));
  savedEnv = process.env.ACCOUNTS_LEDGER_PATH;
  process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.ACCOUNTS_LEDGER_PATH;
  else process.env.ACCOUNTS_LEDGER_PATH = savedEnv;
});

describe('normalization + fold', () => {
  it('normalizes like the rest of the codebase (trim + lowercase)', () => {
    expect(normalizeAccountEmail('  Friend@Example.COM ')).toBe(EMAIL);
    expect(normalizeAccountEmail(undefined)).toBe('');
    expect(normalizeAccountEmail(42)).toBe('');
  });

  it('an email with no events folds to a fail-closed empty state', () => {
    const state = foldAccountRecords(EMAIL, []);
    expect(state).toEqual(emptyAccountState(EMAIL));
    expect(state.exists).toBe(false);
    expect(state.deleted).toBe(false);
  });

  it('latest likes event wins; profile name updates; created_at sticks', () => {
    const records: AccountRecord[] = [
      { email: EMAIL, type: 'account.created', recorded_at: '2026-10-15T00:00:00.000Z', display_name: 'First' },
      { email: EMAIL, type: 'account.likes_updated', recorded_at: '2026-10-15T01:00:00.000Z', likes: [ROSE] },
      { email: EMAIL, type: 'account.likes_updated', recorded_at: '2026-10-15T02:00:00.000Z', likes: [ROSE, CHILL] },
      { email: EMAIL, type: 'account.profile_updated', recorded_at: '2026-10-15T03:00:00.000Z', display_name: 'Renamed' },
    ];
    const state = foldAccountRecords(EMAIL, records);
    expect(state.exists).toBe(true);
    expect(state.created_at).toBe('2026-10-15T00:00:00.000Z');
    expect(state.display_name).toBe('Renamed');
    expect(state.likes).toEqual([ROSE, CHILL]);
  });
});

describe('JSONL store round-trip', () => {
  it('ensureAccount creates once; a second call appends nothing', async () => {
    const first = await ensureAccountAsync(' Friend@Example.com ', 'Fern');
    expect(first.exists).toBe(true);
    expect(first.display_name).toBe('Fern');
    const again = await ensureAccountAsync(EMAIL, 'Other');
    expect(again.display_name).toBe('Fern');
    const records = await readAccountRecordsAsync(EMAIL);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe('account.created');
  });

  it('reads only the requested email, tolerating malformed lines', async () => {
    writeFileSync(
      accountsLedgerPath(),
      [
        JSON.stringify({ email: EMAIL, type: 'account.created', recorded_at: '2026-10-15T00:00:00.000Z', display_name: null }),
        'not json at all',
        JSON.stringify({ email: 'someone-else@example.com', type: 'account.created', recorded_at: '2026-10-15T00:00:00.000Z', display_name: null }),
        JSON.stringify({ email: EMAIL, type: 'account.unknown_thing', recorded_at: '2026-10-15T01:00:00.000Z' }),
        '',
      ].join('\n'),
      'utf8',
    );
    const records = await readAccountRecordsAsync(EMAIL);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe('account.created');
    const state = await loadAccountAsync(EMAIL);
    expect(state.exists).toBe(true);
  });
});

describe('likes', () => {
  it('cleanLikes drops unknown handles, non-strings, and duplicates', () => {
    expect(cleanLikes([ROSE, 'not-a-product', ROSE, 42, CHILL, ''])).toEqual([ROSE, CHILL]);
    expect(cleanLikes('nope')).toEqual([]);
    expect(cleanLikes(null)).toEqual([]);
  });

  it('mergeLikes unions stored + local, stored order first', () => {
    expect(mergeLikes([ROSE], [CHILL, ROSE, CINNAMON])).toEqual([ROSE, CHILL, CINNAMON]);
    expect(mergeLikes([], [])).toEqual([]);
  });

  it('setLikes persists through the fold, cleaned', async () => {
    await ensureAccountAsync(EMAIL);
    const state = await setLikesAsync(EMAIL, [ROSE, 'bogus-handle']);
    expect(state.likes).toEqual([ROSE]);
    expect((await loadAccountAsync(EMAIL)).likes).toEqual([ROSE]);
  });
});

describe('saved searches', () => {
  it('save → newest first; same query+surface refreshes instead of duplicating; remove works', async () => {
    await ensureAccountAsync(EMAIL);
    await saveSearchAsync(EMAIL, 'lavender', 'catalog');
    await saveSearchAsync(EMAIL, 'sleep', 'herbs');
    let state = await saveSearchAsync(EMAIL, 'Lavender', 'catalog');
    expect(state.searches.map((s) => s.query)).toEqual(['Lavender', 'sleep']);
    const target = state.searches[1];
    state = await removeSearchAsync(EMAIL, target.id);
    expect(state.searches.map((s) => s.query)).toEqual(['Lavender']);
  });
});

describe('quiz results + progress', () => {
  it('saving a result appends the snapshot AND stamps quiz completion', async () => {
    await ensureAccountAsync(EMAIL);
    const state = await saveQuizResultAsync(EMAIL, SNAPSHOT);
    expect(state.quiz_results).toHaveLength(1);
    expect(state.quiz_results[0].result).toEqual(SNAPSHOT);
    expect(state.quiz_results[0].via).toBe('quiz');
    expect(state.progress?.quiz_completed_at).toBeTruthy();
  });

  it('cleanInterestSnapshot clamps to the personalization rules', () => {
    expect(
      cleanInterestSnapshot({ herbs: 45.9, soaps: 3, quiz: -2, bogus: 9 }),
    ).toEqual({
      herbs: 30,
      soaps: 3,
      grimoire: 0,
      readings: 0,
      quiz: 0,
      articles: 0,
    });
    expect(cleanInterestSnapshot({ herbs: 0 })).toBeNull();
    expect(cleanInterestSnapshot('nope')).toBeNull();
    expect(cleanInterestSnapshot(null)).toBeNull();
  });

  it('progress updates merge forward: completion stamp is never erased', async () => {
    await ensureAccountAsync(EMAIL);
    await saveQuizResultAsync(EMAIL, SNAPSHOT);
    const interests = cleanInterestSnapshot({ herbs: 5 });
    const state = await updateProgressAsync(EMAIL, { interests });
    expect(state.progress?.quiz_completed_at).toBeTruthy();
    expect(state.progress?.interests?.herbs).toBe(5);
  });
});

describe('sessions in the fold', () => {
  it('issued → active; revoked → inactive; expired → inactive', async () => {
    await ensureAccountAsync(EMAIL);
    const now = Math.floor(Date.now() / 1000);
    await issueSessionRecordAsync(EMAIL, {
      session_id: 'sess-1',
      issued_at: now,
      expires_at: now + 3600,
    });
    let state = await loadAccountAsync(EMAIL);
    expect(sessionIsActive(state, 'sess-1', now)).toBe(true);
    expect(sessionIsActive(state, 'sess-1', now + 3601)).toBe(false);
    expect(sessionIsActive(state, 'sess-unknown', now)).toBe(false);
    await revokeSessionRecordAsync(EMAIL, 'sess-1');
    state = await loadAccountAsync(EMAIL);
    expect(sessionIsActive(state, 'sess-1', now)).toBe(false);
  });
});

describe('tombstone', () => {
  it('deletion is terminal: no resurrection, sessions die, fold stays deleted', async () => {
    await ensureAccountAsync(EMAIL);
    const now = Math.floor(Date.now() / 1000);
    await issueSessionRecordAsync(EMAIL, {
      session_id: 'sess-9',
      issued_at: now,
      expires_at: now + 3600,
    });
    const deleted = await deleteAccountAsync(EMAIL);
    expect(deleted.deleted).toBe(true);
    expect(sessionIsActive(deleted, 'sess-9', now)).toBe(false);
    // ensureAccount must NOT resurrect a deleted account.
    const after = await ensureAccountAsync(EMAIL);
    expect(after.deleted).toBe(true);
    const types = (await readAccountRecordsAsync(EMAIL)).map((r) => r.type);
    expect(types.filter((t) => t === 'account.created')).toHaveLength(1);
    expect(types[types.length - 1]).toBe('account.deleted');
    void readFileSync; // (ledger assertions above read through the store)
  });

  it('appendAccountRecord writes parseable lines in append order', async () => {
    await appendAccountRecord({
      email: EMAIL,
      type: 'account.created',
      recorded_at: '2026-10-15T00:00:00.000Z',
      display_name: null,
    });
    const raw = readFileSync(accountsLedgerPath(), 'utf8').trim();
    expect(JSON.parse(raw).type).toBe('account.created');
  });
});
