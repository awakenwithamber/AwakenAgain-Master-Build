/**
 * Provider-neutral order store for admin operations (G12).
 *
 * The interface is the contract; implementations are swappable:
 * - JsonlOrderStore — reads the local JSONL order ledger written by
 *   POST /api/checkout (development / pre-Phase-3). Read-only.
 * - PgOrderStore — reads the append-only Postgres event store
 *   (Phase 3 Step 1), selected when DATABASE_URL is set.
 *
 * CLIENT=PREVIEW / SERVER=AUTHORITY: admin pages are read-only views over
 * whatever the server persisted. Nothing here computes prices — records are
 * rendered exactly as the checkout server wrote them.
 */
import { readFileSync, existsSync } from 'node:fs';
import type { OrderRecord } from '../checkout/order';
import {
  EVENT_STREAMS,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

export interface OrderListOptions {
  limit?: number;
}

export interface OrderStore {
  /** Newest-first order records. Read-only. */
  listOrders(options?: OrderListOptions): Promise<OrderRecord[]>;
}

/** Shape of a malformed ledger line — surfaced, never silently dropped. */
export interface LedgerParseIssue {
  line: number;
  error: string;
}

function isOrderRecord(v: unknown): v is OrderRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.order_id === 'string' &&
    typeof r.created_at === 'string' &&
    r.computed_by === 'server' &&
    Array.isArray(r.items) &&
    typeof r.total_cents === 'number'
  );
}

/**
 * Read-only store over the local JSONL ledger.
 * Corrupt lines are skipped AND reported via onParseIssue — the admin sees
 * the gap instead of silently missing orders.
 */
export class JsonlOrderStore implements OrderStore {
  private issues: LedgerParseIssue[] = [];

  constructor(private readonly ledgerPath: string) {}

  /** Parse issues from the last listOrders() call. */
  getParseIssues(): LedgerParseIssue[] {
    return [...this.issues];
  }

  async listOrders(options: OrderListOptions = {}): Promise<OrderRecord[]> {
    this.issues = [];
    if (!existsSync(this.ledgerPath)) return [];
    const raw = readFileSync(this.ledgerPath, 'utf8');
    const records: OrderRecord[] = [];
    raw.split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (isOrderRecord(parsed)) {
          records.push(parsed);
        } else {
          this.issues.push({
            line: i + 1,
            error: 'parsed JSON is not an OrderRecord (missing order_id/items/total_cents)',
          });
        }
      } catch (err) {
        this.issues.push({
          line: i + 1,
          error: err instanceof Error ? err.message : 'invalid JSON',
        });
      }
    });
    records.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const limit = options.limit ?? 100;
    return records.slice(0, Math.max(0, limit));
  }
}

/**
 * Postgres-backed order store (Phase 3 Step 1): reads the 'orders'
 * event stream. Same semantics as JsonlOrderStore — every stored order
 * record, newest created_at first, payloads that are not order records
 * skipped AND reported (with the event id standing in for the JSONL
 * line number, which has no meaning in a table).
 */
export class PgOrderStore implements OrderStore {
  private issues: LedgerParseIssue[] = [];

  /** Parse issues from the last listOrders() call. */
  getParseIssues(): LedgerParseIssue[] {
    return [...this.issues];
  }

  async listOrders(options: OrderListOptions = {}): Promise<OrderRecord[]> {
    this.issues = [];
    const events = await readStreamEvents(EVENT_STREAMS.orders);
    const records: OrderRecord[] = [];
    for (const event of events) {
      const payload: unknown = event.payload;
      if (isOrderRecord(payload)) {
        records.push(payload);
      } else {
        this.issues.push({
          line: event.id,
          error:
            'stored event payload is not an OrderRecord (missing order_id/items/total_cents)',
        });
      }
    }
    records.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const limit = options.limit ?? 100;
    return records.slice(0, Math.max(0, limit));
  }
}

/**
 * Default store. Driver selection by env (Phase 3 Step 1): DATABASE_URL
 * set → Postgres event store; unset → the JSONL ledger at the same path
 * convention POST /api/checkout uses, byte-identical to before.
 */
export function defaultOrderStore(): OrderStore {
  if (postgresEnabled()) {
    return new PgOrderStore();
  }
  const path =
    process.env.ORDERS_LEDGER_PATH ??
    `${process.cwd()}/.orders-ledger.jsonl`;
  return new JsonlOrderStore(path);
}
