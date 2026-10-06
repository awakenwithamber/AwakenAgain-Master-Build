/**
 * Order-intake pipeline (G3) — explicit POST → validate → persist.
 *
 * This is the durable order-intake contract that replaces the legacy
 * Netlify Forms `submission-created` event flow (CONVERSION_MAP §§82, 93).
 * It UNIFIES the existing /api/checkout validation logic rather than
 * duplicating it: `validateAndBuildOrder` (lib/checkout/order.ts) remains
 * the single server-authoritative validator — CLIENT=PREVIEW /
 * SERVER=AUTHORITY, every total recomputed from canonical data in integer
 * cents, any client-supplied total or unit price that mismatches is
 * REJECTED.
 *
 * Pipeline stages:
 *   1. validate — validateAndBuildOrder(body) throws on any problem
 *      (tampered totals, unknown products/variants, incompatible
 *      customizations, malformed bundle payloads).
 *   2. persist — RecordStore.append() through the provider-neutral store
 *      interface (lib/orders/store.ts). Local JSONL today; a
 *      Supabase-backed RecordStore later, selected by configuration —
 *      never by editing this module.
 *   3. review-queue shape — the returned OrderReviewEntry is the
 *      fulfillment triage row (pending_review until the G12 admin flow
 *      confirms the order).
 *
 * The Route Handler (app/api/orders/route.ts) maps IntakeOutcome to HTTP:
 * validation failure → 422, persistence failure → 500, success → 2xx with
 * the review-queue entry. Analytics events (order_submitted /
 * order_accepted / order_rejected) are emitted by the handler, not here —
 * this module is pure pipeline logic and stays importable by tests without
 * HTTP or analytics.
 */
import { validateAndBuildOrder, type OrderRecord } from '../checkout/order';
import {
  toOrderReviewEntry,
  type OrderReviewEntry,
  type RecordStore,
  type StoreReceipt,
} from './store';

export interface IntakeSuccess {
  ok: true;
  record: OrderRecord;
  receipt: StoreReceipt;
  reviewEntry: OrderReviewEntry;
}

export interface IntakeFailure {
  ok: false;
  errors: string[];
  /** Which pipeline stage failed — drives the HTTP status + analytics. */
  stage: 'validation' | 'persistence';
}

export type IntakeOutcome = IntakeSuccess | IntakeFailure;

function failure(errors: string[], stage: IntakeFailure['stage']): IntakeFailure {
  return { ok: false, errors, stage };
}

/**
 * Run the full intake pipeline for one order payload. Never throws —
 * every failure mode is returned as an IntakeFailure.
 */
export async function intakeOrder(
  body: unknown,
  store: RecordStore<OrderRecord, OrderReviewEntry>,
): Promise<IntakeOutcome> {
  let record: OrderRecord;
  try {
    record = validateAndBuildOrder(body);
  } catch (err) {
    return failure(
      [err instanceof Error ? err.message : 'Invalid order.'],
      'validation',
    );
  }

  try {
    const receipt = await store.append(record);
    return {
      ok: true,
      record,
      receipt,
      reviewEntry: toOrderReviewEntry(record),
    };
  } catch (err) {
    return failure(
      [
        `Order validated but could not be recorded: ${
          err instanceof Error ? err.message : 'store write failed'
        }. Please contact Amber directly.`,
      ],
      'persistence',
    );
  }
}
