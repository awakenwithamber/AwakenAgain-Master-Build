/**
 * Order tracking events — APPEND-ONLY fulfillment ledger (Phase 2).
 *
 * When Amber ships an order she records its carrier tracking number here.
 * Tracking lives in its OWN ledger (.order-tracking-ledger.jsonl), never
 * inside the order record: the order ledger written by checkout stays
 * byte-for-byte the server-authoritative intake record, and a tracking
 * update is an EVENT appended after the fact. The latest event for an
 * order wins (a corrected number supersedes the first entry — history is
 * preserved, never edited).
 *
 * Writes happen only through POST /api/admin/orders/tracking (owner-secret
 * bridge auth, lib/admin/owner-auth.ts). Reads are tolerant in the
 * codebase's ledger style: a missing file means "no tracking yet" and
 * malformed lines are skipped, never thrown into a page render.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------------ */
/* Carriers                                                             */
/* ------------------------------------------------------------------ */

export const TRACKING_CARRIERS = ['usps', 'ups', 'fedex', 'dhl'] as const;
export type TrackingCarrier = (typeof TRACKING_CARRIERS)[number];

/** Amber ships USPS unless she says otherwise. */
export const DEFAULT_TRACKING_CARRIER: TrackingCarrier = 'usps';

const CARRIER_LABELS: Record<TrackingCarrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  dhl: 'DHL',
};

export function carrierLabel(carrier: TrackingCarrier): string {
  return CARRIER_LABELS[carrier];
}

/**
 * Public carrier tracking URL for a number, or null for a carrier this
 * module does not know (unreachable for validated input — the switch is
 * exhaustive over TrackingCarrier).
 */
export function carrierTrackingUrl(
  carrier: TrackingCarrier,
  trackingNumber: string,
): string | null {
  const n = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${n}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`;
  }
}

/* ------------------------------------------------------------------ */
/* Input validation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Normalize a carrier value from request input: case-insensitive match
 * against the known carriers. Returns null for anything unrecognized —
 * the route maps that to 422 rather than guessing.
 */
export function sanitizeCarrier(input: unknown): TrackingCarrier | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  return (TRACKING_CARRIERS as readonly string[]).includes(value)
    ? (value as TrackingCarrier)
    : null;
}

/**
 * Normalize a tracking number: internal spaces are display formatting
 * (carriers print them grouped), so they are removed; the remainder must
 * be 6–64 letters/digits/dashes (covers USPS 20–22 digit numbers, UPU
 * S10 codes like "LX123456789US", and UPS 1Z numbers). Returns null for
 * anything else.
 */
export function sanitizeTrackingNumber(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.replace(/\s+/g, '');
  if (value.length < 6 || value.length > 64) return null;
  return /^[A-Za-z0-9-]+$/.test(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Ledger                                                               */
/* ------------------------------------------------------------------ */

export interface OrderTrackingEvent {
  event_id: string;
  order_id: string;
  carrier: TrackingCarrier;
  tracking_number: string;
  /** ISO timestamp of when the owner recorded this event. */
  recorded_at: string;
  recorded_by: 'owner';
  ledger_version: 1;
}

/** Ledger path — env override for tests/preview, cwd default like the other ledgers. */
export function orderTrackingLedgerPath(): string {
  return (
    process.env.ORDER_TRACKING_LEDGER_PATH ??
    join(process.cwd(), '.order-tracking-ledger.jsonl')
  );
}

function generateTrackingEventId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TRK-${date}-${rand}`;
}

/** Build the event the route appends. Inputs must already be sanitized. */
export function buildTrackingEvent(input: {
  order_id: string;
  carrier: TrackingCarrier;
  tracking_number: string;
}): OrderTrackingEvent {
  return {
    event_id: generateTrackingEventId(),
    order_id: input.order_id,
    carrier: input.carrier,
    tracking_number: input.tracking_number,
    recorded_at: new Date().toISOString(),
    recorded_by: 'owner',
    ledger_version: 1,
  };
}

function isTrackingEvent(v: unknown): v is OrderTrackingEvent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.event_id === 'string' &&
    typeof r.order_id === 'string' &&
    typeof r.tracking_number === 'string' &&
    typeof r.recorded_at === 'string' &&
    (TRACKING_CARRIERS as readonly string[]).includes(r.carrier as string)
  );
}

/**
 * Read every tracking event in append order, tolerating a missing file
 * and skipping malformed lines (ledger noise never breaks a render).
 */
export function readTrackingEvents(
  ledgerPath: string = orderTrackingLedgerPath(),
): OrderTrackingEvent[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return []; // no ledger yet → no tracking recorded
  }
  const events: OrderTrackingEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isTrackingEvent(parsed)) events.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return events;
}

/** The latest tracking event recorded for an order, or undefined. */
export function findLatestTracking(
  orderId: string,
  ledgerPath: string = orderTrackingLedgerPath(),
): OrderTrackingEvent | undefined {
  let latest: OrderTrackingEvent | undefined;
  for (const event of readTrackingEvents(ledgerPath)) {
    if (event.order_id === orderId) latest = event;
  }
  return latest;
}

/** Customer/admin-facing shape: the event plus its resolved carrier link. */
export interface TrackingView {
  carrier: TrackingCarrier;
  carrier_label: string;
  tracking_number: string;
  tracking_url: string | null;
  recorded_at: string;
}

export function toTrackingView(event: OrderTrackingEvent): TrackingView {
  return {
    carrier: event.carrier,
    carrier_label: carrierLabel(event.carrier),
    tracking_number: event.tracking_number,
    tracking_url: carrierTrackingUrl(event.carrier, event.tracking_number),
    recorded_at: event.recorded_at,
  };
}
