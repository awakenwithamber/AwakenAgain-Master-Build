#!/usr/bin/env node
/**
 * migrate-jsonl-to-events — Phase 3 Step 1 (store binding).
 *
 * One-shot, idempotent migration of every JSONL ledger the app keeps
 * into the append-only Postgres `events` table (db/migrations/001_events.sql):
 *
 *   1. BACKUP FIRST. Every existing ledger file is copied, read-only
 *      (mode 0444), into backups/jsonl-migration-<timestamp>/ before a
 *      single row is inserted. The originals are never modified — they
 *      stay on disk as the rollback (rollback = unset DATABASE_URL; the
 *      app reads the JSONL again, byte-identical).
 *   2. VERBATIM INSERT. Each line becomes one event in file order:
 *      payload is the parsed line exactly as written; the event's
 *      created_at is the record's own timestamp. Lines that do not parse
 *      as JSON, or that carry no stream key, are SKIPPED and counted —
 *      those are precisely the lines every ledger reader already skips,
 *      so migrated state equals JSONL state for every key.
 *   3. IDEMPOTENT. A migration_markers row per source records the line
 *      count + sha256 that were migrated. A re-run with an unchanged
 *      source is a no-op. A source that CHANGED after migration aborts
 *      the run loudly — resolve by deciding which store is live before
 *      re-running; never double-insert.
 *
 * Usage (from apps/web, with the app stopped or DATABASE_URL still
 * unset so no JSONL writes race the copy):
 *   DATABASE_URL=postgres://… npm run db:migrate-jsonl
 *
 * Source paths honor the same env overrides the app uses.
 */
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set — nowhere to migrate to.');
  process.exit(1);
}

const cwd = process.cwd();
const normalizeEmail = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';
const stringKey = (v) => (typeof v === 'string' && v.length > 0 ? v : '');

/** Source table: [marker name, file, stream, keyOf, typeOf, timestampOf]. */
function sources() {
  const leadsDir = process.env.LEAD_STORE_DIR ?? join(cwd, 'data', 'leads');
  const reviewsDir =
    process.env.REVIEW_STORE_DIR ?? join(cwd, 'data', 'reviews');
  return [
    {
      name: 'subscriptions',
      file:
        process.env.SUBSCRIPTIONS_LEDGER_PATH ??
        join(cwd, '.subscriptions-ledger.jsonl'),
      stream: 'subscriptions',
      keyOf: (p) => normalizeEmail(p?.customer?.email),
      typeOf: (p) =>
        typeof p?.status === 'string'
          ? `subscription.${p.status}`
          : 'subscription.recorded',
      tsOf: (p) => p?.created_at,
    },
    {
      name: 'orders',
      file: process.env.ORDERS_LEDGER_PATH ?? join(cwd, '.orders-ledger.jsonl'),
      stream: 'orders',
      keyOf: (p) => stringKey(p?.order_id),
      typeOf: () => 'order.recorded',
      tsOf: (p) => p?.created_at,
    },
    {
      name: 'contact_messages',
      file:
        process.env.CONTACT_MESSAGES_PATH ??
        join(cwd, '.contact-messages.jsonl'),
      stream: 'contact_messages',
      keyOf: (p) => stringKey(p?.message_id),
      typeOf: () => 'contact_message.recorded',
      tsOf: (p) => p?.created_at,
    },
    {
      name: 'order_tracking',
      file:
        process.env.ORDER_TRACKING_LEDGER_PATH ??
        join(cwd, '.order-tracking-ledger.jsonl'),
      stream: 'order_tracking',
      keyOf: (p) => stringKey(p?.order_id),
      typeOf: () => 'tracking.recorded',
      tsOf: (p) => p?.recorded_at,
    },
    {
      // Payment confirmations (audit fix 2026-10-15) — same append-only
      // side-ledger shape as order_tracking; keyed by order like tracking.
      name: 'order_payments',
      file:
        process.env.ORDER_PAYMENTS_LEDGER_PATH ??
        join(cwd, '.order-payments-ledger.jsonl'),
      stream: 'order_payments',
      keyOf: (p) => stringKey(p?.order_id),
      typeOf: () => 'payment.confirmed',
      tsOf: (p) => p?.recorded_at,
    },
    {
      name: 'broadcasts',
      file:
        process.env.BROADCAST_LEDGER_PATH ?? join(cwd, '.broadcasts-ledger.jsonl'),
      stream: 'broadcasts',
      keyOf: (p) => stringKey(p?.broadcast_id),
      typeOf: () => 'broadcast.recorded',
      tsOf: (p) => p?.created_at,
    },
    {
      name: 'leads:quiz_lead',
      file: join(leadsDir, 'quiz_lead.jsonl'),
      stream: 'leads',
      keyOf: (p) => normalizeEmail(p?.email),
      typeOf: (p) =>
        typeof p?.kind === 'string' ? `lead.${p.kind}` : 'lead.recorded',
      tsOf: (p) => p?.capturedAt,
    },
    {
      name: 'leads:newsletter',
      file: join(leadsDir, 'newsletter.jsonl'),
      stream: 'leads',
      keyOf: (p) => normalizeEmail(p?.email),
      typeOf: (p) =>
        typeof p?.kind === 'string' ? `lead.${p.kind}` : 'lead.recorded',
      tsOf: (p) => p?.capturedAt,
    },
    {
      // Get-involved captures (2026-10-15, audit fix #8) — same lead
      // shape as quiz/newsletter; keyed by normalized email like both.
      name: 'leads:affiliate_interest',
      file: join(leadsDir, 'affiliate_interest.jsonl'),
      stream: 'leads',
      keyOf: (p) => normalizeEmail(p?.email),
      typeOf: (p) =>
        typeof p?.kind === 'string' ? `lead.${p.kind}` : 'lead.recorded',
      tsOf: (p) => p?.capturedAt,
    },
    {
      name: 'leads:partner_idea',
      file: join(leadsDir, 'partner_idea.jsonl'),
      stream: 'leads',
      keyOf: (p) => normalizeEmail(p?.email),
      typeOf: (p) =>
        typeof p?.kind === 'string' ? `lead.${p.kind}` : 'lead.recorded',
      tsOf: (p) => p?.capturedAt,
    },
    {
      name: 'reviews',
      file: join(reviewsDir, 'reviews.jsonl'),
      stream: 'reviews',
      keyOf: (p) => stringKey(p?.id),
      typeOf: () => 'review.recorded',
      tsOf: (p) => p?.createdAt,
    },
    {
      // Customer accounts (Phase 3 Step 3) — one append-only ledger of
      // account events keyed by normalized email; the record's own type
      // is the event type, same as the app writes it.
      name: 'accounts',
      file:
        process.env.ACCOUNTS_LEDGER_PATH ??
        join(cwd, '.accounts-ledger.jsonl'),
      stream: 'accounts',
      keyOf: (p) => normalizeEmail(p?.email),
      typeOf: (p) =>
        typeof p?.type === 'string' ? p.type : 'account.recorded',
      tsOf: (p) => p?.recorded_at,
    },
  ];
}

function validTimestamp(v) {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const pool = new Pool({ connectionString: url });
try {
  // Schema first (the 001 DDL is idempotent).
  const schemaSql = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'db',
      'migrations',
      '001_events.sql',
    ),
    'utf8',
  );
  await pool.query(schemaSql);

  const present = [];
  for (const source of sources()) {
    if (!existsSync(source.file)) {
      console.log(`${source.name}: no file at ${source.file} — nothing to migrate`);
      continue;
    }
    const bytes = readFileSync(source.file);
    const lines = bytes
      .toString('utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0);
    present.push({
      ...source,
      bytes,
      lines,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  if (present.length === 0) {
    console.log('no JSONL ledgers found — nothing to migrate');
    process.exit(0);
  }

  // Marker check BEFORE any write: unchanged → skip; changed → abort.
  const todo = [];
  for (const source of present) {
    const { rows } = await pool.query(
      'SELECT line_count, sha256 FROM migration_markers WHERE source = $1',
      [source.name],
    );
    if (rows.length > 0) {
      if (rows[0].sha256 === source.sha256) {
        console.log(
          `${source.name}: already migrated (${rows[0].line_count} lines, marker matches) — skipping`,
        );
        continue;
      }
      console.error(
        `${source.name}: ABORT — source file changed after migration ` +
          `(marker: ${rows[0].line_count} lines sha ${rows[0].sha256.slice(0, 12)}…; ` +
          `now: ${source.lines.length} lines sha ${source.sha256.slice(0, 12)}…). ` +
          'Decide which store is live before re-running; nothing was inserted.',
      );
      process.exit(1);
    }
    todo.push(source);
  }
  if (todo.length === 0) {
    console.log('all ledgers already migrated — no-op');
    process.exit(0);
  }

  // Backup: read-only copies of every present source, before any insert.
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('Z', 'Z');
  const backupDir = join(cwd, 'backups', `jsonl-migration-${stamp}`);
  mkdirSync(backupDir, { recursive: true });
  for (const source of present) {
    const dest = join(
      backupDir,
      `${source.name.replace(/[:/]/g, '-')}.jsonl`,
    );
    copyFileSync(source.file, dest);
    chmodSync(dest, 0o444);
  }
  console.log(`backup: originals copied read-only to ${backupDir}`);

  // Insert per source, in a transaction with its marker.
  let totalInserted = 0;
  for (const source of todo) {
    let inserted = 0;
    let skippedMalformed = 0;
    let skippedNoKey = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const line of source.lines) {
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          skippedMalformed++;
          continue;
        }
        const key = source.keyOf(parsed);
        if (!key) {
          skippedNoKey++;
          continue;
        }
        await client.query(
          `INSERT INTO events (stream, stream_key, event_type, payload, origin, created_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, now()))`,
          [
            source.stream,
            key,
            source.typeOf(parsed),
            JSON.stringify(parsed),
            `migration:${source.name}`,
            validTimestamp(source.tsOf(parsed)),
          ],
        );
        inserted++;
      }
      await client.query(
        'INSERT INTO migration_markers (source, line_count, sha256) VALUES ($1, $2, $3)',
        [source.name, source.lines.length, source.sha256],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    totalInserted += inserted;
    console.log(
      `${source.name}: ${source.lines.length} lines → ${inserted} events ` +
        `(skipped: ${skippedMalformed} malformed, ${skippedNoKey} no-key)`,
    );
  }
  console.log(`done: ${totalInserted} events inserted; originals untouched`);
} finally {
  await pool.end();
}
