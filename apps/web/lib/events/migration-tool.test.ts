/**
 * JSONL → events migration tool — Phase 3 Step 1 (store binding).
 *
 * Runs scripts/migrate-jsonl-to-events.mjs as a child process against
 * fixture ledgers and a scratch Postgres, and proves the migration
 * contract: originals backed up read-only and never modified; migrated
 * latest-state equals JSONL latest-state for every key; a re-run is a
 * no-op; a source changed after migration aborts instead of
 * double-inserting.
 *
 * Gated on AWAKEN_PG_TEST_URL, like postgres-stores.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { closeAllEventPools } from './event-store';
import {
  findLatestSubscriptionRecord,
  findLatestSubscriptionRecordAsync,
  isEntitledSubscriber,
  isEntitledSubscriberAsync,
} from '../subscriptions/entitlement';
import {
  findLatestTracking,
  findLatestTrackingAsync,
} from '../orders/tracking';
import { JsonlOrderStore, defaultOrderStore } from '../stores/order-store';

const PG_URL = process.env.AWAKEN_PG_TEST_URL;
const describePg = PG_URL ? describe : describe.skip;

const APP_WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOL = join(APP_WEB, 'scripts', 'migrate-jsonl-to-events.mjs');

function subscriptionLine(email: string, status: string): string {
  return JSON.stringify({
    subscription_id: 'SUB-TEST-0001',
    created_at: '2026-10-13T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
  });
}

function orderLine(id: string, createdAt: string, total: number): string {
  return JSON.stringify({
    order_id: id,
    created_at: createdAt,
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test', email: 'test@example.com' },
    items: [],
    bundle: null,
    subtotal_cents: total,
    shipping_cents: 0,
    shipping_status: 'FREE',
    free_shipping_threshold_cents: 4500,
    total_cents: total,
    is_subscriber_asserted: false,
    payment_method: 'cash_app_or_venmo',
  });
}

function trackingLine(orderId: string, number: string, recordedAt: string): string {
  return JSON.stringify({
    event_id: `TRK-${number}`,
    order_id: orderId,
    carrier: 'usps',
    tracking_number: number,
    recorded_at: recordedAt,
    recorded_by: 'owner',
    ledger_version: 1,
  });
}

interface ToolResult {
  code: number;
  stdout: string;
  stderr: string;
}

let admin: Pool;
let previousDatabaseUrl: string | undefined;
let root: string;
let subsPath: string;
let ordersPath: string;
let trackingPath: string;
let leadsDir: string;
let fixtureShas: Record<string, string>;
let firstRun: ToolResult;

function shaOf(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function toolEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: PG_URL,
    SUBSCRIPTIONS_LEDGER_PATH: subsPath,
    ORDERS_LEDGER_PATH: ordersPath,
    ORDER_TRACKING_LEDGER_PATH: trackingPath,
    CONTACT_MESSAGES_PATH: join(root, 'absent-contact.jsonl'),
    BROADCAST_LEDGER_PATH: join(root, 'absent-broadcasts.jsonl'),
    LEAD_STORE_DIR: leadsDir,
    REVIEW_STORE_DIR: join(root, 'absent-reviews'),
  };
}

function runTool(): Promise<ToolResult> {
  return new Promise((resolve) => {
    execFile(
      'node',
      [TOOL],
      { cwd: root, env: toolEnv() },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code as unknown as number) || 1 : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

beforeAll(async () => {
  if (!PG_URL) return;
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = PG_URL;
  admin = new Pool({ connectionString: PG_URL });
  const schema = readFileSync(
    join(APP_WEB, 'db', 'migrations', '001_events.sql'),
    'utf8',
  );
  await admin.query(schema);
  await admin.query('TRUNCATE events, migration_markers');

  root = mkdtempSync(join(tmpdir(), 'jsonl-migration-test-'));
  subsPath = join(root, 'subscriptions.jsonl');
  ordersPath = join(root, 'orders.jsonl');
  trackingPath = join(root, 'tracking.jsonl');
  leadsDir = join(root, 'leads');

  writeFileSync(
    subsPath,
    [
      subscriptionLine('a@example.com', 'pending_payment'),
      subscriptionLine('a@example.com', 'active'),
      subscriptionLine('b@example.com', 'active'),
      subscriptionLine('b@example.com', 'cancelled'),
      'this is not json',
      JSON.stringify({ status: 'active', customer: {} }), // no usable email
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    ordersPath,
    [
      orderLine('AWK-20261004-AAAAAA', '2026-10-04T10:00:00.000Z', 3577),
      orderLine('AWK-20261005-BBBBBB', '2026-10-05T10:00:00.000Z', 1977),
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    trackingPath,
    [
      trackingLine('AWK-20261004-AAAAAA', '9400111111111111111111', '2026-10-06T10:00:00.000Z'),
      trackingLine('AWK-20261004-AAAAAA', '9400222222222222222222', '2026-10-07T10:00:00.000Z'),
      '',
    ].join('\n'),
    'utf8',
  );
  mkdirSync(leadsDir, { recursive: true });
  writeFileSync(
    join(leadsDir, 'newsletter.jsonl'),
    [
      JSON.stringify({
        id: 'lead-1',
        kind: 'newsletter',
        email: 'News@Example.com',
        name: null,
        consent: true,
        consentAt: '2026-10-01T00:00:00.000Z',
        metadata: {},
        capturedAt: '2026-10-01T00:00:00.000Z',
        source: 'nextjs',
      }),
      JSON.stringify({
        id: 'lead-2',
        kind: 'newsletter',
        email: 'two@example.com',
        name: null,
        consent: true,
        consentAt: '2026-10-02T00:00:00.000Z',
        metadata: {},
        capturedAt: '2026-10-02T00:00:00.000Z',
        source: 'nextjs',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(leadsDir, 'quiz_lead.jsonl'),
    [
      JSON.stringify({
        id: 'lead-3',
        kind: 'quiz_lead',
        email: 'quiz@example.com',
        name: null,
        consent: true,
        consentAt: '2026-10-03T00:00:00.000Z',
        metadata: {},
        capturedAt: '2026-10-03T00:00:00.000Z',
        source: 'nextjs',
      }),
      '',
    ].join('\n'),
    'utf8',
  );

  fixtureShas = {
    subs: shaOf(subsPath),
    orders: shaOf(ordersPath),
    tracking: shaOf(trackingPath),
  };

  firstRun = await runTool();
}, 60000);

afterAll(async () => {
  if (!PG_URL) return;
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
  await closeAllEventPools();
  await admin.end();
});

describePg('migrate-jsonl-to-events', () => {
  it('runs clean and reports per-store counts with skips', () => {
    expect(firstRun.code).toBe(0);
    expect(firstRun.stdout).toContain(
      'subscriptions: 6 lines → 4 events (skipped: 1 malformed, 1 no-key)',
    );
    expect(firstRun.stdout).toContain('orders: 2 lines → 2 events');
    expect(firstRun.stdout).toContain('order_tracking: 2 lines → 2 events');
    expect(firstRun.stdout).toContain('leads:newsletter: 2 lines → 2 events');
    expect(firstRun.stdout).toContain('leads:quiz_lead: 1 lines → 1 events');
    expect(firstRun.stdout).toContain('done: 11 events inserted');
  });

  it('backs up originals read-only and never modifies them', () => {
    const backupsRoot = join(root, 'backups');
    const dirs = readdirSync(backupsRoot);
    expect(dirs).toHaveLength(1);
    const backupDir = join(backupsRoot, dirs[0]);
    const copy = join(backupDir, 'subscriptions.jsonl');
    expect(existsSync(copy)).toBe(true);
    expect(readFileSync(copy, 'utf8')).toBe(readFileSync(subsPath, 'utf8'));
    expect(statSync(copy).mode & 0o222).toBe(0); // no write bits
    expect(shaOf(subsPath)).toBe(fixtureShas.subs);
    expect(shaOf(ordersPath)).toBe(fixtureShas.orders);
    expect(shaOf(trackingPath)).toBe(fixtureShas.tracking);
  });

  it('migrated latest-state equals JSONL latest-state for every key', async () => {
    // Subscriptions / entitlement.
    for (const email of ['a@example.com', 'b@example.com', 'ghost@example.com']) {
      expect(await isEntitledSubscriberAsync(email)).toBe(
        isEntitledSubscriber(email, subsPath),
      );
    }
    expect(await isEntitledSubscriberAsync('a@example.com')).toBe(true);
    expect(await isEntitledSubscriberAsync('b@example.com')).toBe(false);
    const pgLatest = await findLatestSubscriptionRecordAsync('b@example.com');
    const jsonlLatest = findLatestSubscriptionRecord('b@example.com', subsPath);
    expect(pgLatest?.status).toBe(jsonlLatest?.status);

    // Orders (admin read model).
    const pgOrders = await defaultOrderStore().listOrders({ limit: 100 });
    const jsonlOrders = await new JsonlOrderStore(ordersPath).listOrders({
      limit: 100,
    });
    expect(pgOrders.map((o) => o.order_id)).toEqual(
      jsonlOrders.map((o) => o.order_id),
    );
    expect(pgOrders).toEqual(jsonlOrders);

    // Tracking.
    const pgTracking = await findLatestTrackingAsync('AWK-20261004-AAAAAA');
    const jsonlTracking = findLatestTracking('AWK-20261004-AAAAAA', trackingPath);
    expect(pgTracking?.tracking_number).toBe('9400222222222222222222');
    expect(pgTracking?.tracking_number).toBe(jsonlTracking?.tracking_number);

    // Leads landed in one stream, keyed by normalized email.
    const { rows } = await admin.query(
      "SELECT stream_key FROM events WHERE stream = 'leads' ORDER BY id",
    );
    expect(rows.map((r) => r.stream_key)).toEqual([
      'quiz@example.com',
      'news@example.com',
      'two@example.com',
    ]);
  });

  it('re-run is a no-op (markers match, counts unchanged)', async () => {
    const before = await admin.query('SELECT count(*)::int AS n FROM events');
    const second = await runTool();
    expect(second.code).toBe(0);
    expect(second.stdout).toContain('already migrated');
    expect(second.stdout).toContain('no-op');
    const after = await admin.query('SELECT count(*)::int AS n FROM events');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('a source changed after migration aborts instead of double-inserting', async () => {
    appendFileSync(
      ordersPath,
      orderLine('AWK-20261006-CCCCCC', '2026-10-06T10:00:00.000Z', 100) + '\n',
      'utf8',
    );
    const third = await runTool();
    expect(third.code).toBe(1);
    expect(third.stderr).toContain('ABORT');
    const { rows } = await admin.query(
      "SELECT count(*)::int AS n FROM events WHERE stream = 'orders'",
    );
    expect(rows[0].n).toBe(2); // nothing new was inserted
  });
});
