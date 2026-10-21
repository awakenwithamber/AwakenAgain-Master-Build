/**
 * Provider-neutral record store — order intake (G3) + contact pipeline (G5).
 *
 * CONTRACT FIRST: `RecordStore<TRecord, TSummary>` is the only persistence
 * interface any Route Handler may depend on. It defines durable append plus
 * read-back for the fulfillment review queue. The single implementation
 * wired today is local JSONL (`JsonlRecordStore`) — the same reversible
 * ledger pattern the checkout flow already uses.
 *
 * The Postgres-backed implementation (PgRecordStore, Phase 3 Step 1)
 * implements this same interface over the append-only event store
 * (lib/events/event-store.ts) and is selected by configuration
 * (DATABASE_URL), never by editing call sites.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  OrderRecord,
  ShippingStatus,
  StoredPaymentMethod,
} from '../checkout/order';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readLatestEvent,
  readStreamEvents,
  type EventStream,
} from '../events/event-store';

/* ------------------------------------------------------------------ */
/* Generic contract                                                     */
/* ------------------------------------------------------------------ */

/** Proof that a record was durably persisted (not an analytics event). */
export interface StoreReceipt {
  /** Business ID of the persisted record (order_id / message_id). */
  id: string;
  persisted_at: string;
  backend: 'jsonl' | 'postgres';
}

export interface ReviewQueueOptions {
  /** Maximum entries returned, newest first. Defaults to 100. */
  limit?: number;
}

/**
 * The persistence contract. Every implementation must:
 * - append() durably (throw on failure — callers map to 500);
 * - return summaries newest-first from reviewQueue();
 * - never mutate or reorder records on read.
 */
export interface RecordStore<
  TRecord extends { created_at: string },
  TSummary,
> {
  append(record: TRecord): Promise<StoreReceipt>;
  get(id: string): Promise<TRecord | null>;
  reviewQueue(opts?: ReviewQueueOptions): Promise<TSummary[]>;
}

/* ------------------------------------------------------------------ */
/* Orders                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fulfillment review-queue shape (G3). One entry per accepted order: the
 * triage facts Amber needs before personally confirming an order —
 * identity-free beyond name/email, money in integer cents. Carries no PII
 * beyond what fulfillment requires (name + email for confirmation contact;
 * no notes, no addresses — those stay in the full order record).
 */
export interface OrderReviewEntry {
  order_id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  item_count: number;
  bundle_included: boolean;
  subtotal_cents: number;
  total_cents: number;
  shipping_status: ShippingStatus;
  /** Stored type: legacy entries may carry the removed Bookipi value. */
  payment_method: StoredPaymentMethod;
  /** Fulfillment triage state — 'pending_review' until the admin flow (G12) confirms. */
  review_status: 'pending_review';
}

export function toOrderReviewEntry(record: OrderRecord): OrderReviewEntry {
  return {
    order_id: record.order_id,
    created_at: record.created_at,
    customer_name: record.customer.name,
    customer_email: record.customer.email,
    item_count: record.items.reduce((n, line) => n + line.quantity, 0),
    bundle_included: record.bundle !== null,
    subtotal_cents: record.subtotal_cents,
    total_cents: record.total_cents,
    shipping_status: record.shipping_status,
    payment_method: record.payment_method,
    review_status: 'pending_review',
  };
}

/** Env override for tests/preview; default keeps the existing ledger file. */
export function defaultOrderLedgerPath(): string {
  return (
    process.env.ORDERS_LEDGER_PATH ?? join(process.cwd(), '.orders-ledger.jsonl')
  );
}

/* ------------------------------------------------------------------ */
/* Local JSONL implementation                                           */
/* ------------------------------------------------------------------ */

export interface JsonlStoreOptions<TRecord, TSummary> {
  /** File path, or a thunk so tests can redirect per-call via env. */
  path: string | (() => string);
  /** Extract the business ID from a record (order_id / message_id). */
  getId: (record: TRecord) => string;
  /** Project a record to its review-queue summary. */
  toSummary: (record: TRecord) => TSummary;
  /** Rehydrate a parsed line; default is the identity (plain JSON). */
  reviver?: (raw: unknown) => TRecord;
}

/**
 * Line-delimited JSON persistence: one JSON object per line, appended
 * atomically per call. Reversible (delete a line to retract) and
 * human-inspectable — the same pattern the checkout ledger established.
 * Reads scan the whole file; this is the local/dev implementation, not a
 * production database (scale decision belongs to the Supabase migration,
 * which will implement RecordStore instead of replacing call sites).
 */
export class JsonlRecordStore<
  TRecord extends { created_at: string },
  TSummary,
> implements RecordStore<TRecord, TSummary>
{
  private readonly options: JsonlStoreOptions<TRecord, TSummary>;

  constructor(options: JsonlStoreOptions<TRecord, TSummary>) {
    this.options = options;
  }

  private path(): string {
    const p = this.options.path;
    return typeof p === 'function' ? p() : p;
  }

  async append(record: TRecord): Promise<StoreReceipt> {
    const path = this.path();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
    return {
      id: this.options.getId(record),
      persisted_at: new Date().toISOString(),
      backend: 'jsonl',
    };
  }

  /** Read every record, newest first. */
  private async readAll(): Promise<TRecord[]> {
    let raw: string;
    try {
      raw = await readFile(this.path(), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const revive = this.options.reviver ?? ((v: unknown) => v as TRecord);
    const records: TRecord[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      records.push(revive(JSON.parse(trimmed)));
    }
    // Ledger order is chronological; review queue wants newest first.
    return records.reverse();
  }

  async get(id: string): Promise<TRecord | null> {
    const getId = this.options.getId;
    for (const record of await this.readAll()) {
      if (getId(record) === id) return record;
    }
    return null;
  }

  async reviewQueue(opts: ReviewQueueOptions = {}): Promise<TSummary[]> {
    const limit = opts.limit ?? 100;
    const summaries = (await this.readAll()).map(this.options.toSummary);
    return summaries.slice(0, Math.max(0, limit));
  }
}

/* ------------------------------------------------------------------ */
/* Postgres event-store implementation (Phase 3 Step 1)                */
/* ------------------------------------------------------------------ */

export interface PgStoreOptions<TRecord, TSummary> {
  /** Event stream this store's records live in. */
  stream: EventStream;
  /** Extract the business ID (the stream key) from a record. */
  getId: (record: TRecord) => string;
  /** Event type stamped on appends. */
  eventType: string;
  /** Project a record to its review-queue summary. */
  toSummary: (record: TRecord) => TSummary;
  /** Rehydrate a stored payload; default is the identity (plain JSON). */
  reviver?: (raw: unknown) => TRecord;
}

/**
 * RecordStore over the append-only Postgres event store
 * (lib/events/event-store.ts). Semantics mirror JsonlRecordStore
 * exactly: append is durable before it resolves; get() returns the
 * LATEST event for the id (the JSONL scan returns the last matching
 * line); reviewQueue() is newest-append-first. Selected by
 * configuration (DATABASE_URL), never by editing call sites.
 */
export class PgRecordStore<
  TRecord extends { created_at: string },
  TSummary,
> implements RecordStore<TRecord, TSummary>
{
  constructor(private readonly options: PgStoreOptions<TRecord, TSummary>) {}

  private revive(raw: unknown): TRecord {
    return this.options.reviver
      ? this.options.reviver(raw)
      : (raw as TRecord);
  }

  async append(record: TRecord): Promise<StoreReceipt> {
    const result = await appendEvent(
      this.options.stream,
      this.options.getId(record),
      this.options.eventType,
      record,
      record.created_at,
    );
    return {
      id: this.options.getId(record),
      persisted_at: result.persisted_at,
      backend: 'postgres',
    };
  }

  async get(id: string): Promise<TRecord | null> {
    const event = await readLatestEvent(this.options.stream, id);
    return event ? this.revive(event.payload) : null;
  }

  async reviewQueue(opts: ReviewQueueOptions = {}): Promise<TSummary[]> {
    const limit = opts.limit ?? 100;
    const events = await readStreamEvents(this.options.stream);
    const summaries = events
      .reverse()
      .map((event) => this.options.toSummary(this.revive(event.payload)));
    return summaries.slice(0, Math.max(0, limit));
  }
}

/**
 * Order store wired to the shared ledger. Driver selection by env
 * (Phase 3 Step 1): DATABASE_URL set → Postgres event store; unset →
 * the JSONL ledger, byte-identical to before.
 */
export function createOrderStore(): RecordStore<OrderRecord, OrderReviewEntry> {
  if (postgresEnabled()) {
    return new PgRecordStore<OrderRecord, OrderReviewEntry>({
      stream: EVENT_STREAMS.orders,
      getId: (record) => record.order_id,
      eventType: 'order.recorded',
      toSummary: toOrderReviewEntry,
    });
  }
  return new JsonlRecordStore<OrderRecord, OrderReviewEntry>({
    path: defaultOrderLedgerPath,
    getId: (record) => record.order_id,
    toSummary: toOrderReviewEntry,
  });
}
