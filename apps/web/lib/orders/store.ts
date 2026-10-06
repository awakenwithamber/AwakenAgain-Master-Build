/**
 * Provider-neutral record store — order intake (G3) + contact pipeline (G5).
 *
 * CONTRACT FIRST: `RecordStore<TRecord, TSummary>` is the only persistence
 * interface any Route Handler may depend on. It defines durable append plus
 * read-back for the fulfillment review queue. The single implementation
 * wired today is local JSONL (`JsonlRecordStore`) — the same reversible
 * ledger pattern the checkout flow already uses.
 *
 * A future Supabase-backed implementation must implement this interface and
 * be selected by configuration (environment), never by editing call sites.
 * No Supabase imports, SDKs, or provider-specific code exist in this module
 * or anywhere in lib/ — provider bindings belong in /infrastructure after
 * the owner's provider decision.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OrderRecord } from '../checkout/order';

/* ------------------------------------------------------------------ */
/* Generic contract                                                     */
/* ------------------------------------------------------------------ */

/** Proof that a record was durably persisted (not an analytics event). */
export interface StoreReceipt {
  /** Business ID of the persisted record (order_id / message_id). */
  id: string;
  persisted_at: string;
  backend: 'jsonl';
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
  shipping_status: 'FREE' | 'TO_BE_CONFIRMED';
  payment_method: 'cash_app_or_venmo';
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

/** Order store wired to the shared ledger (env-overridable). */
export function createOrderStore(): RecordStore<OrderRecord, OrderReviewEntry> {
  return new JsonlRecordStore<OrderRecord, OrderReviewEntry>({
    path: defaultOrderLedgerPath,
    getId: (record) => record.order_id,
    toSummary: toOrderReviewEntry,
  });
}
