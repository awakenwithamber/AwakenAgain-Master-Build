/**
 * Order payment confirmations — unit tests (audit 2026-10-15 GAP-1).
 *
 * Laws under test:
 * - Payment methods render as human labels, never the raw enum (POLISH-1).
 * - Sanitizers accept only the known methods and clean optional text.
 * - The ledger reader is tolerant (missing file, malformed lines) and
 *   the LATEST event for an order wins — corrections supersede, history
 *   is never edited.
 * - The async append/read pair round-trips through the JSONL driver.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendPaymentEvent,
  buildPaymentEvent,
  findLatestPayment,
  findLatestPaymentAsync,
  paymentMethodLabel,
  readPaymentEvents,
  sanitizeOptionalText,
  sanitizePaymentMethod,
  toPaymentView,
} from './payments';

const DIR = mkdtempSync(join(tmpdir(), 'payments-lib-'));
const LEDGER = join(DIR, 'payments.jsonl');

function setEvents(lines: unknown[]): void {
  const content = lines.length
    ? lines
        .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
        .join('\n') + '\n'
    : '';
  writeFileSync(LEDGER, content, 'utf8');
}

function event(orderId: string, method: string, reference: string | null = null) {
  return {
    event_id: `PAY-TEST-${orderId}-${reference ?? 'none'}`,
    order_id: orderId,
    method,
    reference,
    note: null,
    recorded_at: '2026-10-15T00:00:00.000Z',
    recorded_by: 'owner',
    ledger_version: 1,
  };
}

describe('paymentMethodLabel (POLISH-1)', () => {
  it('humanizes both methods', () => {
    expect(paymentMethodLabel('cash_app_or_venmo')).toBe('Cash App / Venmo');
    expect(paymentMethodLabel('bookipi_card_invoice')).toBe(
      'Card — Bookipi invoice',
    );
  });
});

describe('sanitizers', () => {
  it('accepts only the known methods; absent → null (use order default)', () => {
    expect(sanitizePaymentMethod('cash_app_or_venmo')).toBe('cash_app_or_venmo');
    expect(sanitizePaymentMethod('bookipi_card_invoice')).toBe(
      'bookipi_card_invoice',
    );
    expect(sanitizePaymentMethod(undefined)).toBeNull();
    expect(sanitizePaymentMethod(null)).toBeNull();
    expect(sanitizePaymentMethod('stripe')).toBeNull();
    expect(sanitizePaymentMethod(42)).toBeNull();
  });

  it('optional text is cleaned, capped, and empty → null', () => {
    expect(sanitizeOptionalText('  INV-1042  ', 120)).toBe('INV-1042');
    expect(sanitizeOptionalText('   ', 120)).toBeNull();
    expect(sanitizeOptionalText(undefined, 120)).toBeNull();
    expect(sanitizeOptionalText('x'.repeat(200), 120)).toHaveLength(120);
  });
});

describe('ledger reads', () => {
  it('missing file reads as no payments', () => {
    expect(readPaymentEvents(join(DIR, 'nope.jsonl'))).toEqual([]);
    expect(findLatestPayment('AWK-1', join(DIR, 'nope.jsonl'))).toBeUndefined();
  });

  it('skips malformed lines and unknown methods; latest per order wins', () => {
    setEvents([
      event('AWK-1', 'cash_app_or_venmo'),
      'this is not json',
      { nope: true },
      event('AWK-1', 'bookipi_card_invoice', 'INV-9'), // correction supersedes
      event('AWK-2', 'stripe'), // unknown method — never a valid event
      event('AWK-2', 'cash_app_or_venmo'),
    ]);
    const events = readPaymentEvents(LEDGER);
    expect(events.map((e) => e.order_id)).toEqual(['AWK-1', 'AWK-1', 'AWK-2']);
    const latest = findLatestPayment('AWK-1', LEDGER);
    expect(latest?.method).toBe('bookipi_card_invoice');
    expect(latest?.reference).toBe('INV-9');
    expect(findLatestPayment('AWK-404', LEDGER)).toBeUndefined();
  });
});

describe('buildPaymentEvent + view', () => {
  it('builds a ledger_version 1 owner event and a labelled view', () => {
    const built = buildPaymentEvent({
      order_id: 'AWK-1',
      method: 'bookipi_card_invoice',
      reference: 'INV-1042',
      note: null,
    });
    expect(built.event_id).toMatch(/^PAY-\d{8}-[A-Z0-9]{6}$/);
    expect(built.recorded_by).toBe('owner');
    expect(built.ledger_version).toBe(1);
    const view = toPaymentView(built);
    expect(view.method_label).toBe('Card — Bookipi invoice');
    expect(view.reference).toBe('INV-1042');
    expect(view.confirmed_at).toBe(built.recorded_at);
  });
});

describe('async JSONL round-trip (driver-aware accessors)', () => {
  beforeEach(() => {
    process.env.ORDER_PAYMENTS_LEDGER_PATH = LEDGER;
    writeFileSync(LEDGER, '', 'utf8');
  });
  afterEach(() => {
    delete process.env.ORDER_PAYMENTS_LEDGER_PATH;
  });

  it('append then findLatest returns the event; the line is one JSON object', async () => {
    const built = buildPaymentEvent({
      order_id: 'AWK-9',
      method: 'cash_app_or_venmo',
      reference: null,
      note: 'paid in full',
    });
    await appendPaymentEvent(built);
    const latest = await findLatestPaymentAsync('AWK-9');
    expect(latest?.event_id).toBe(built.event_id);
    expect(latest?.note).toBe('paid in full');
    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).order_id).toBe('AWK-9');
  });
});
