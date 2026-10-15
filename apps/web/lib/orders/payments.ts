/**
 * Order payment confirmations — APPEND-ONLY payment ledger.
 *
 * Audit 2026-10-15 GAP-1: orders never left 'pending_payment'. Subscriptions
 * had the full owner-confirmation loop; orders had none — the G12 flow the
 * review-queue comment referenced was never built. This module is that
 * flow, built exactly like order tracking (lib/orders/tracking.ts):
 * payment confirmation is an EVENT in its own ledger
 * (.order-payments-ledger.jsonl), never an edit to the order record.
 * Checkout's ledger stays byte-for-byte the server-authoritative intake
 * record; read paths (admin orders, customer order-status) join the
 * latest payment event at read time — an order is 'paid' iff a payment
 * confirmation event exists for it. The latest event wins, so a
 * correction (wrong method/reference recorded) supersedes by appending,
 * with history preserved.
 *
 * Writes happen only through POST /api/admin/orders/payment (owner-secret
 * bridge auth, lib/admin/owner-auth.ts) — the same posture as the
 * subscription confirm and tracking routes. Reads are tolerant in the
 * codebase's ledger style: a missing file means "no payments confirmed
 * yet" and malformed lines are skipped, never thrown into a render.
 *
 * Bookipi note: Bookipi has no public API or webhooks, so nothing can
 * auto-confirm a card payment — the owner confirms here after BookiPay
 * shows the invoice paid (see the owner runbook). Cash App / Venmo
 * payments are confirmed the same way when the money lands.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../checkout/order';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';
import { sanitizePlainText } from '../security/validation';

/* ------------------------------------------------------------------ */
/* Labels                                                               */
/* ------------------------------------------------------------------ */

/**
 * Human-readable payment-method labels (audit POLISH-1: the admin orders
 * table printed the raw enum). The enum stays the storage/wire value;
 * this is display-only.
 */
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_app_or_venmo: 'Cash App / Venmo',
  bookipi_card_invoice: 'Card — Bookipi invoice',
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

/**
 * Validate an optional method override from request input: absent/null
 * means "the method recorded on the order". Returns null for anything
 * that is not one of the known methods — the route maps that to 422
 * rather than guessing.
 */
export function sanitizePaymentMethod(input: unknown): PaymentMethod | null {
  if (input === undefined || input === null) return null;
  return (PAYMENT_METHODS as readonly string[]).includes(input as string)
    ? (input as PaymentMethod)
    : null;
}

/** Optional free-text field (reference / note): sanitized, '' → null. */
export function sanitizeOptionalText(
  input: unknown,
  maxLength: number,
): string | null {
  if (input === undefined || input === null) return null;
  const value = sanitizePlainText(input, maxLength);
  return value === '' ? null : value;
}

/* ------------------------------------------------------------------ */
/* Ledger                                                               */
/* ------------------------------------------------------------------ */

export interface OrderPaymentEvent {
  event_id: string;
  order_id: string;
  /** How the payment actually arrived (defaults to the order's method). */
  method: PaymentMethod;
  /** Bookipi invoice number / Cash App or Venmo reference, when given. */
  reference: string | null;
  /** Owner note (e.g. "paid in two parts"), when given. */
  note: string | null;
  /** ISO timestamp of when the owner recorded this confirmation. */
  recorded_at: string;
  recorded_by: 'owner';
  ledger_version: 1;
}

/** Ledger path — env override for tests/preview, cwd default like the other ledgers. */
export function orderPaymentsLedgerPath(): string {
  return (
    process.env.ORDER_PAYMENTS_LEDGER_PATH ??
    join(process.cwd(), '.order-payments-ledger.jsonl')
  );
}

function generatePaymentEventId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PAY-${date}-${rand}`;
}

/** Build the event the route appends. Inputs must already be sanitized. */
export function buildPaymentEvent(input: {
  order_id: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
}): OrderPaymentEvent {
  return {
    event_id: generatePaymentEventId(),
    order_id: input.order_id,
    method: input.method,
    reference: input.reference,
    note: input.note,
    recorded_at: new Date().toISOString(),
    recorded_by: 'owner',
    ledger_version: 1,
  };
}

function isPaymentEvent(v: unknown): v is OrderPaymentEvent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.event_id === 'string' &&
    typeof r.order_id === 'string' &&
    typeof r.recorded_at === 'string' &&
    (PAYMENT_METHODS as readonly string[]).includes(r.method as string)
  );
}

/**
 * Read every payment event in append order, tolerating a missing file
 * and skipping malformed lines (ledger noise never breaks a render).
 */
export function readPaymentEvents(
  ledgerPath: string = orderPaymentsLedgerPath(),
): OrderPaymentEvent[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return []; // no ledger yet → no payments confirmed
  }
  const events: OrderPaymentEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isPaymentEvent(parsed)) events.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return events;
}

/** The latest payment confirmation for an order, or undefined. */
export function findLatestPayment(
  orderId: string,
  ledgerPath: string = orderPaymentsLedgerPath(),
): OrderPaymentEvent | undefined {
  let latest: OrderPaymentEvent | undefined;
  for (const event of readPaymentEvents(ledgerPath)) {
    if (event.order_id === orderId) latest = event;
  }
  return latest;
}

/* ------------------------------------------------------------------ */
/* Driver-aware async accessors (Phase 3 Step 1: store binding)        */
/* ------------------------------------------------------------------ */

/**
 * Append one payment event. JSONL driver: the append to the payments
 * ledger. Postgres driver: one 'order_payments' event keyed by order_id.
 */
export async function appendPaymentEvent(
  event: OrderPaymentEvent,
): Promise<void> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.orderPayments,
      event.order_id,
      'payment.confirmed',
      event,
      event.recorded_at,
    );
    return;
  }
  const path = orderPaymentsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
}

/** readPaymentEvents, driver-aware. Same validity filter, append order. */
export async function readPaymentEventsAsync(): Promise<OrderPaymentEvent[]> {
  if (!postgresEnabled()) return readPaymentEvents();
  const events = await readStreamEvents(EVENT_STREAMS.orderPayments);
  const valid: OrderPaymentEvent[] = [];
  for (const event of events) {
    const payload: unknown = event.payload;
    if (isPaymentEvent(payload)) valid.push(payload);
  }
  return valid;
}

/** findLatestPayment, driver-aware. */
export async function findLatestPaymentAsync(
  orderId: string,
): Promise<OrderPaymentEvent | undefined> {
  let latest: OrderPaymentEvent | undefined;
  for (const event of await readPaymentEventsAsync()) {
    if (event.order_id === orderId) latest = event;
  }
  return latest;
}

/** API-facing shape of a payment confirmation. */
export interface PaymentView {
  method: PaymentMethod;
  method_label: string;
  reference: string | null;
  note: string | null;
  confirmed_at: string;
}

export function toPaymentView(event: OrderPaymentEvent): PaymentView {
  return {
    method: event.method,
    method_label: paymentMethodLabel(event.method),
    reference: event.reference,
    note: event.note,
    confirmed_at: event.recorded_at,
  };
}
