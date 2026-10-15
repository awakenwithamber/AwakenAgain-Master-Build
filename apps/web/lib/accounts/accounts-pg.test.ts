/**
 * Accounts store — Postgres parity (Phase 3 Step 3).
 *
 * The Step 1 discipline: the SAME records through both drivers must
 * fold to the SAME state. This file appends an identical account
 * record sequence via the JSONL driver and via the Postgres driver
 * (DATABASE_URL pointed at a scratch DB) and asserts the read-backs
 * and folded states are deep-equal — plus the tombstone/session
 * contract against the real event store, and lead-reader parity for
 * the profile's linked quiz results.
 *
 * Gated on AWAKEN_PG_TEST_URL (a scratch database the run may TRUNCATE):
 *   AWAKEN_PG_TEST_URL=postgres://… npx vitest run lib/accounts/accounts-pg
 * Without it the file skips, so the default suite stays green on
 * machines with no Postgres.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  appendAccountRecord,
  deleteAccountAsync,
  ensureAccountAsync,
  loadAccountAsync,
  readAccountRecordsAsync,
  sessionIsActive,
  type AccountRecord,
} from './accounts';
import { leadStore, readLeadsForEmailAsync } from '../leads/lead-store';
import { closeAllEventPools } from '../events/event-store';
import {
  createAccountSession,
  resolveAccountSession,
} from './session';
import type { QuizResultSnapshot } from '../quiz/quiz';

const PG_URL = process.env.AWAKEN_PG_TEST_URL;
const describePg = PG_URL ? describe : describe.skip;

const EMAIL = 'friend@example.com';
const ROSE = 'gaias-rose-soap';
const CHILL = 'chill-pill-capsules';

const SNAPSHOT: QuizResultSnapshot = {
  concernId: 'sleep',
  concernLabel: 'Sleep & Rest',
  formId: 'tea',
  formLabel: 'Herbal Tea',
  allies: [
    {
      name: 'Valerian root',
      latin: 'Valeriana officinalis',
      evidence: 'traditional',
      note: 'Rest.',
    },
  ],
  productHandles: ['dreamease-capsules'],
  productReason: 'For sleep.',
};

/** One fixed record sequence, appended verbatim through both drivers. */
const RECORDS: AccountRecord[] = [
  { email: EMAIL, type: 'account.created', recorded_at: '2026-10-15T00:00:00.000Z', display_name: 'Fern' },
  { email: EMAIL, type: 'account.likes_updated', recorded_at: '2026-10-15T01:00:00.000Z', likes: [ROSE] },
  { email: EMAIL, type: 'account.likes_updated', recorded_at: '2026-10-15T02:00:00.000Z', likes: [ROSE, CHILL] },
  {
    email: EMAIL,
    type: 'account.search_saved',
    recorded_at: '2026-10-15T03:00:00.000Z',
    search: { id: 's1', query: 'lavender', surface: 'catalog', saved_at: '2026-10-15T03:00:00.000Z' },
  },
  {
    email: EMAIL,
    type: 'account.search_saved',
    recorded_at: '2026-10-15T04:00:00.000Z',
    search: { id: 's2', query: 'sleep', surface: 'herbs', saved_at: '2026-10-15T04:00:00.000Z' },
  },
  { email: EMAIL, type: 'account.search_removed', recorded_at: '2026-10-15T05:00:00.000Z', search_id: 's1' },
  { email: EMAIL, type: 'account.quiz_result_saved', recorded_at: '2026-10-15T06:00:00.000Z', result: SNAPSHOT, via: 'quiz' },
  {
    email: EMAIL,
    type: 'account.progress_updated',
    recorded_at: '2026-10-15T07:00:00.000Z',
    progress: {
      quiz_completed_at: '2026-10-15T06:00:00.000Z',
      interests: { herbs: 5, soaps: 0, grimoire: 0, readings: 0, quiz: 3, articles: 0 },
      updated_at: '2026-10-15T07:00:00.000Z',
    },
  },
  { email: EMAIL, type: 'account.session_issued', recorded_at: '2026-10-15T08:00:00.000Z', session_id: 'sess-pg-1', issued_at: 1760000000, expires_at: 1760003600 },
];

let admin: Pool;
let previousDatabaseUrl: string | undefined;
let previousLedgerPath: string | undefined;
let previousLeadDir: string | undefined;
let previousSecret: string | undefined;

describePg('accounts store — Postgres parity', () => {
  beforeAll(async () => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    previousLedgerPath = process.env.ACCOUNTS_LEDGER_PATH;
    previousLeadDir = process.env.LEAD_STORE_DIR;
    previousSecret = process.env.ACCOUNT_SESSION_SECRET;
    process.env.ACCOUNT_SESSION_SECRET = 'pg-parity-secret-that-is-long-enough';
    admin = new Pool({ connectionString: PG_URL });
    const schema = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'db',
        'migrations',
        '001_events.sql',
      ),
      'utf8',
    );
    await admin.query(schema);
  });

  beforeEach(async () => {
    await admin.query('TRUNCATE events, migration_markers');
    delete process.env.DATABASE_URL;
  });

  afterAll(async () => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousLedgerPath === undefined) delete process.env.ACCOUNTS_LEDGER_PATH;
    else process.env.ACCOUNTS_LEDGER_PATH = previousLedgerPath;
    if (previousLeadDir === undefined) delete process.env.LEAD_STORE_DIR;
    else process.env.LEAD_STORE_DIR = previousLeadDir;
    if (previousSecret === undefined) delete process.env.ACCOUNT_SESSION_SECRET;
    else process.env.ACCOUNT_SESSION_SECRET = previousSecret;
    await closeAllEventPools();
    await admin.end();
  });

  it('identical records fold identically under JSONL and Postgres', async () => {
    // JSONL driver.
    const dir = mkdtempSync(join(tmpdir(), 'aa-accounts-pg-'));
    process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
    delete process.env.DATABASE_URL;
    for (const record of RECORDS) await appendAccountRecord(record);
    const jsonlRecords = await readAccountRecordsAsync(EMAIL);
    const jsonlState = await loadAccountAsync(EMAIL);

    // Postgres driver.
    process.env.DATABASE_URL = PG_URL;
    for (const record of RECORDS) await appendAccountRecord(record);
    const pgRecords = await readAccountRecordsAsync(EMAIL);
    const pgState = await loadAccountAsync(EMAIL);

    expect(pgRecords).toEqual(jsonlRecords);
    expect(pgState).toEqual(jsonlState);
    expect(pgState.likes).toEqual([ROSE, CHILL]);
    expect(pgState.searches.map((s) => s.id)).toEqual(['s2']);
    expect(pgState.quiz_results).toHaveLength(1);
    expect(pgState.progress?.interests?.herbs).toBe(5);
    expect(sessionIsActive(pgState, 'sess-pg-1', 1760000100)).toBe(true);
  });

  it('tombstone + sessions hold against the real event store', async () => {
    process.env.DATABASE_URL = PG_URL;
    await ensureAccountAsync(EMAIL);
    const { token } = await createAccountSession(EMAIL);
    await expect(resolveAccountSession(token)).resolves.not.toBeNull();
    await deleteAccountAsync(EMAIL);
    await expect(resolveAccountSession(token)).resolves.toBeNull();
    const state = await ensureAccountAsync(EMAIL);
    expect(state.deleted).toBe(true); // no resurrection under PG either
  });

  it('lead reader parity: a PG quiz lead links with its snapshot intact', async () => {
    process.env.DATABASE_URL = PG_URL;
    await leadStore.append({
      kind: 'quiz_lead',
      email: EMAIL,
      name: 'Fern',
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: { concern_id: 'sleep', form_id: 'tea' },
      quizResult: SNAPSHOT,
    });
    const leads = await readLeadsForEmailAsync(EMAIL);
    expect(leads).toHaveLength(1);
    expect(leads[0].kind).toBe('quiz_lead');
    expect(leads[0].quizResult).toEqual(SNAPSHOT);
    expect(await readLeadsForEmailAsync('nobody@example.com')).toEqual([]);
  });
});
