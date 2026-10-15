/**
 * Append-only event store — the Postgres binding for every ledger the
 * app keeps (Phase 3 Step 1: store binding).
 *
 * Until now each store persisted to a local JSONL file. The interfaces
 * never changed; this module is the storage engine the Postgres
 * implementations of those interfaces share:
 *
 *   stream          one per ledger (see EVENT_STREAMS)
 *   stream_key      the fold key (normalized email, order_id, ...)
 *   event_type      '<thing>.<past-tense-verb>' — informational
 *   payload         the record, verbatim (the JSONL line's object)
 *
 * Semantics are the ledgers' own, preserved exactly:
 * - APPEND-ONLY. Events are inserted, never updated or deleted (the
 *   database enforces it — see db/migrations/001_events.sql).
 * - LATEST WINS. Current state for a key is its newest event, resolved
 *   by query (insertion order = `id`), never by mutation.
 * - FAIL CLOSED. No event for a key means no state — the same answer a
 *   missing JSONL file gives today.
 *
 * Driver selection is by environment and happens at CALL time:
 * DATABASE_URL set → Postgres (this module); unset → the JSONL stores,
 * byte-identical to before. The connection pool is created LAZILY on the
 * first actual query — importing this module never connects, so a
 * deploy without DATABASE_URL behaves exactly as it does today.
 *
 * SERVER-ONLY: uses `pg`. Never import from a client component.
 */
import { Pool } from 'pg';

/** Stream names — one per JSONL ledger the app keeps. */
export const EVENT_STREAMS = {
  subscriptions: 'subscriptions',
  orders: 'orders',
  contactMessages: 'contact_messages',
  orderTracking: 'order_tracking',
  orderPayments: 'order_payments',
  broadcasts: 'broadcasts',
  leads: 'leads',
  reviews: 'reviews',
} as const;

export type EventStream = (typeof EVENT_STREAMS)[keyof typeof EVENT_STREAMS];

/** True when the Postgres driver is selected (DATABASE_URL present). */
export function postgresEnabled(): boolean {
  return (
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Lazy pool                                                           */
/* ------------------------------------------------------------------ */

const pools = new Map<string, Pool>();

/**
 * The pool for the current DATABASE_URL, created on first use. Keyed by
 * connection string so tests can point at a scratch database without
 * disturbing any other pool.
 */
export function eventPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'eventPool() called without DATABASE_URL — Postgres driver is not selected.',
    );
  }
  let pool = pools.get(url);
  if (!pool) {
    pool = new Pool({ connectionString: url });
    pools.set(url, pool);
  }
  return pool;
}

/** End every open pool (test teardown; harmless in app code). */
export async function closeAllEventPools(): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((p) => p.end()));
}

/* ------------------------------------------------------------------ */
/* Event access                                                        */
/* ------------------------------------------------------------------ */

export interface StoredEvent<T = Record<string, unknown>> {
  id: number;
  stream: string;
  stream_key: string;
  event_type: string;
  payload: T;
  created_at: Date;
}

export interface AppendEventResult {
  id: number;
  persisted_at: string;
}

/**
 * Append one event. `createdAt` is the record's own timestamp when the
 * caller carries one (keeps a record's chronology identical to its JSONL
 * line); ordering authority is the returned `id`, never the timestamp.
 */
export async function appendEvent<T>(
  stream: EventStream,
  streamKey: string,
  eventType: string,
  payload: T,
  createdAt?: string,
): Promise<AppendEventResult> {
  const pool = eventPool();
  const { rows } = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO events (stream, stream_key, event_type, payload, created_at)
     VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
     RETURNING id, created_at`,
    [
      stream,
      streamKey,
      eventType,
      JSON.stringify(payload),
      createdAt ?? null,
    ],
  );
  const row = rows[0];
  return {
    id: Number(row.id),
    persisted_at: new Date(row.created_at).toISOString(),
  };
}

/** Every event in a stream, in append order (id ascending). */
export async function readStreamEvents<T = Record<string, unknown>>(
  stream: EventStream,
): Promise<StoredEvent<T>[]> {
  const pool = eventPool();
  const { rows } = await pool.query<StoredEvent<T>>(
    `SELECT id, stream, stream_key, event_type, payload, created_at
     FROM events WHERE stream = $1 ORDER BY id ASC`,
    [stream],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/**
 * The newest event for one key, or null when the key has no state —
 * the fail-closed primitive every "latest line wins" reader folds from.
 */
export async function readLatestEvent<T = Record<string, unknown>>(
  stream: EventStream,
  streamKey: string,
): Promise<StoredEvent<T> | null> {
  const pool = eventPool();
  const { rows } = await pool.query<StoredEvent<T>>(
    `SELECT id, stream, stream_key, event_type, payload, created_at
     FROM events WHERE stream = $1 AND stream_key = $2
     ORDER BY id DESC LIMIT 1`,
    [stream, streamKey],
  );
  if (rows.length === 0) return null;
  return { ...rows[0], id: Number(rows[0].id) };
}
