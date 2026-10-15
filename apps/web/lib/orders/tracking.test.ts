/**
 * Order tracking ledger — unit tests (Phase 2).
 *
 * Laws under test:
 * - The USPS link is the canonical TrackConfirmAction URL with the
 *   number as tLabels; the other carriers resolve to their public
 *   tracking URLs; numbers are URL-encoded.
 * - Sanitizers normalize display formatting (spaces) and reject
 *   anything that is not a plausible tracking number / known carrier.
 * - The ledger reader is tolerant (missing file, malformed lines) and
 *   the LATEST event for an order wins — corrections supersede, history
 *   is never edited.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildTrackingEvent,
  carrierLabel,
  carrierTrackingUrl,
  findLatestTracking,
  readTrackingEvents,
  sanitizeCarrier,
  sanitizeTrackingNumber,
  toTrackingView,
} from './tracking';

const DIR = mkdtempSync(join(tmpdir(), 'tracking-lib-'));
const LEDGER = join(DIR, 'tracking.jsonl');

function setEvents(lines: unknown[]): void {
  const content = lines.length
    ? lines
        .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
        .join('\n') + '\n'
    : '';
  writeFileSync(LEDGER, content, 'utf8');
}

function event(orderId: string, number: string, carrier = 'usps') {
  return {
    event_id: `TRK-TEST-${number}`,
    order_id: orderId,
    carrier,
    tracking_number: number,
    recorded_at: '2026-10-14T00:00:00.000Z',
    recorded_by: 'owner',
    ledger_version: 1,
  };
}

describe('carrierTrackingUrl', () => {
  it('builds the USPS TrackConfirmAction URL', () => {
    expect(carrierTrackingUrl('usps', '9400111899223397865891')).toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223397865891',
    );
  });

  it('builds UPS, FedEx, and DHL URLs', () => {
    expect(carrierTrackingUrl('ups', '1Z999AA10123456784')).toBe(
      'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    );
    expect(carrierTrackingUrl('fedex', '123456789012')).toBe(
      'https://www.fedex.com/fedextrack/?trknbr=123456789012',
    );
    expect(carrierTrackingUrl('dhl', '1234567890')).toBe(
      'https://www.dhl.com/en/express/tracking.html?AWB=1234567890',
    );
  });

  it('labels carriers for display', () => {
    expect(carrierLabel('usps')).toBe('USPS');
    expect(carrierLabel('fedex')).toBe('FedEx');
  });
});

describe('sanitizers', () => {
  it('sanitizeCarrier matches case-insensitively and rejects unknowns', () => {
    expect(sanitizeCarrier('USPS')).toBe('usps');
    expect(sanitizeCarrier(' FedEx ')).toBe('fedex');
    expect(sanitizeCarrier('ontrac')).toBeNull();
    expect(sanitizeCarrier(42)).toBeNull();
    expect(sanitizeCarrier(undefined)).toBeNull();
  });

  it('sanitizeTrackingNumber strips display spaces and validates shape', () => {
    expect(sanitizeTrackingNumber('9400 1118 9922 3397 8658 91')).toBe(
      '9400111899223397865891',
    );
    expect(sanitizeTrackingNumber('LX123456789US')).toBe('LX123456789US');
    expect(sanitizeTrackingNumber('12345')).toBeNull(); // too short
    expect(sanitizeTrackingNumber('9400!@#$')).toBeNull();
    expect(sanitizeTrackingNumber('')).toBeNull();
    expect(sanitizeTrackingNumber(null)).toBeNull();
  });
});

describe('tracking ledger reads', () => {
  it('missing ledger → no events, no tracking', () => {
    const missing = join(DIR, 'does-not-exist.jsonl');
    expect(readTrackingEvents(missing)).toEqual([]);
    expect(findLatestTracking('AWK-1', missing)).toBeUndefined();
  });

  it('skips malformed lines and unknown carriers', () => {
    setEvents([
      event('AWK-1', '111111'),
      'this is not json',
      { bogus: true },
      event('AWK-1', '222222', 'carrier-pigeon'),
      event('AWK-2', '333333'),
    ]);
    const events = readTrackingEvents(LEDGER);
    expect(events.map((e) => e.tracking_number)).toEqual(['111111', '333333']);
  });

  it('latest event per order wins (append-only supersede)', () => {
    setEvents([
      event('AWK-1', '111111'),
      event('AWK-2', '999999'),
      event('AWK-1', '222222'),
    ]);
    expect(findLatestTracking('AWK-1', LEDGER)?.tracking_number).toBe('222222');
    expect(findLatestTracking('AWK-2', LEDGER)?.tracking_number).toBe('999999');
    expect(findLatestTracking('AWK-3', LEDGER)).toBeUndefined();
    // History is preserved — all three events remain in the ledger.
    expect(readTrackingEvents(LEDGER)).toHaveLength(3);
  });

  it('buildTrackingEvent stamps owner + version; toTrackingView resolves the link', () => {
    const built = buildTrackingEvent({
      order_id: 'AWK-1',
      carrier: 'usps',
      tracking_number: '9400111899223397865891',
    });
    expect(built.recorded_by).toBe('owner');
    expect(built.ledger_version).toBe(1);
    expect(built.event_id).toMatch(/^TRK-\d{8}-[A-Z0-9]{6}$/);
    const view = toTrackingView(built);
    expect(view.carrier_label).toBe('USPS');
    expect(view.tracking_url).toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223397865891',
    );
  });
});
