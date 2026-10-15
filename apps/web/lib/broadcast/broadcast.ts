/**
 * Broadcast drafts — recorded intent, NOT delivery (Phase 2).
 *
 * SURVEY RESULT (2026-10-14): no email provider is bound to this app.
 * There is no mail dependency in package.json, no provider binding under
 * lib/, and the legacy composer (app/admin/broadcast) shipped its send
 * control permanently disabled — there is no code path that sends bulk
 * email, and this module does not create one. Delivery is a Phase 3
 * decision (provider binding).
 *
 * What exists here instead — the truthful version:
 * - The audience is COMPUTED from the real stores: newsletter signups
 *   that consented (the lead store's newsletter.jsonl) plus ACTIVE
 *   Living Grimoire subscribers (latest-line status in the subscription
 *   ledger), deduplicated by normalized email. Nobody is assumed and no
 *   list is fabricated.
 * - A composed broadcast is appended to an append-only drafts ledger as
 *   a recorded intent with its audience snapshot and the explicit status
 *   'recorded_not_sent'. When a provider is bound in Phase 3, delivery
 *   will consume these drafts; until then NOTHING is sent and no surface
 *   may claim otherwise.
 *
 * SERVER-ONLY: uses node:fs. Never import from a client component.
 */
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  normalizeSubscriptionEmail,
  readSubscriptionLedger,
  readSubscriptionLedgerAsync,
  subscriptionsLedgerPath,
  type SubscriptionLedgerEntry,
} from '../subscriptions/entitlement';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

/* ------------------------------------------------------------------ */
/* Audience                                                             */
/* ------------------------------------------------------------------ */

export interface BroadcastAudience {
  /** Consented newsletter signups (lead store), unique by email. */
  newsletter_recipients: number;
  /** Living Grimoire subscribers whose latest status is 'active'. */
  active_subscribers: number;
  /** Union of both lists, deduplicated — the real recipient count. */
  total_recipients: number;
}

/** The lead store's directory convention (lib/leads/lead-store.ts). */
export function leadsDir(): string {
  return process.env.LEAD_STORE_DIR ?? join(process.cwd(), 'data', 'leads');
}

/**
 * Emails from one lead-store kind file. Only records with consent: true
 * count — consent is the lead store's hard gate, and a broadcast audience
 * must never widen it. Tolerant: a missing file is an empty list.
 */
function readConsentedLeadEmails(filePath: string): Set<string> {
  const emails = new Set<string>();
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return emails;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as {
        email?: unknown;
        consent?: unknown;
      };
      const email = normalizeSubscriptionEmail(parsed?.email);
      if (email && parsed?.consent === true) emails.add(email);
    } catch {
      // skip malformed line — ledger tolerance
    }
  }
  return emails;
}

/** Fold ledger entries to the emails whose LATEST status is 'active'. */
function activeEmailsFromEntries(
  entries: SubscriptionLedgerEntry[],
): Set<string> {
  const latest = new Map<string, string>();
  for (const entry of entries) {
    latest.set(entry.email, entry.status);
  }
  const emails = new Set<string>();
  for (const [email, status] of latest) {
    if (status === 'active') emails.add(email);
  }
  return emails;
}

/** Emails whose LATEST subscription-ledger status is 'active'. */
function readActiveSubscriberEmails(
  ledgerPath: string = subscriptionsLedgerPath(),
): Set<string> {
  return activeEmailsFromEntries(readSubscriptionLedger(ledgerPath));
}

/**
 * The broadcast audience, derived from the real stores at call time.
 * `sources` is injectable for tests; production callers pass nothing.
 */
export function computeBroadcastAudience(sources?: {
  newsletterFile?: string;
  subscriptionsLedger?: string;
}): BroadcastAudience {
  const newsletter = readConsentedLeadEmails(
    sources?.newsletterFile ?? join(leadsDir(), 'newsletter.jsonl'),
  );
  const subscribers = readActiveSubscriberEmails(sources?.subscriptionsLedger);
  const union = new Set<string>([...newsletter, ...subscribers]);
  return {
    newsletter_recipients: newsletter.size,
    active_subscribers: subscribers.size,
    total_recipients: union.size,
  };
}

/* ------------------------------------------------------------------ */
/* Draft ledger                                                         */
/* ------------------------------------------------------------------ */

/**
 * The only delivery status a broadcast can hold today. Named so no UI
 * can drift into calling a recorded draft "sent".
 */
export const BROADCAST_DELIVERY_STATUS = 'recorded_not_sent' as const;

export interface BroadcastDraftRecord {
  broadcast_id: string;
  created_at: string;
  created_by: 'owner';
  subject: string;
  body: string;
  /** Audience snapshot at record time (recomputed live until delivery exists). */
  audience_newsletter: number;
  audience_active_subscribers: number;
  audience_total: number;
  delivery_status: typeof BROADCAST_DELIVERY_STATUS;
  /** Plain-language truth, stored with the record so it travels with it. */
  delivery_note: string;
  ledger_version: 1;
}

export const BROADCAST_DELIVERY_NOTE =
  'Recorded only — no email provider is connected to this site yet, so nothing was sent. Delivery activates when an email provider is bound (Phase 3).';

/** Ledger path — env override for tests/preview, cwd default like the other ledgers. */
export function broadcastsLedgerPath(): string {
  return (
    process.env.BROADCAST_LEDGER_PATH ??
    join(process.cwd(), '.broadcasts-ledger.jsonl')
  );
}

function generateBroadcastId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BCAST-${date}-${rand}`;
}

/** Build the draft record the route appends. Inputs must already be sanitized. */
export function buildBroadcastDraft(input: {
  subject: string;
  body: string;
  audience: BroadcastAudience;
}): BroadcastDraftRecord {
  return {
    broadcast_id: generateBroadcastId(),
    created_at: new Date().toISOString(),
    created_by: 'owner',
    subject: input.subject,
    body: input.body,
    audience_newsletter: input.audience.newsletter_recipients,
    audience_active_subscribers: input.audience.active_subscribers,
    audience_total: input.audience.total_recipients,
    delivery_status: BROADCAST_DELIVERY_STATUS,
    delivery_note: BROADCAST_DELIVERY_NOTE,
    ledger_version: 1,
  };
}

function isBroadcastDraft(v: unknown): v is BroadcastDraftRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.broadcast_id === 'string' &&
    typeof r.created_at === 'string' &&
    typeof r.subject === 'string' &&
    typeof r.body === 'string' &&
    r.delivery_status === BROADCAST_DELIVERY_STATUS
  );
}

/**
 * Read recorded drafts, NEWEST first, tolerating a missing file and
 * skipping malformed lines.
 */
export function readBroadcastDrafts(
  ledgerPath: string = broadcastsLedgerPath(),
): BroadcastDraftRecord[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return []; // no ledger yet → nothing recorded
  }
  const drafts: BroadcastDraftRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isBroadcastDraft(parsed)) drafts.push(parsed);
    } catch {
      // skip malformed line — ledger tolerance
    }
  }
  return drafts.reverse();
}

/* ------------------------------------------------------------------ */
/* Driver-aware async accessors (Phase 3 Step 1: store binding)        */
/* ------------------------------------------------------------------ */

/**
 * Append one broadcast draft record. JSONL driver: the exact append the
 * admin route used to perform itself. Postgres driver: one 'broadcasts'
 * event keyed by broadcast_id. Still records intent only — nothing is
 * sent, in either driver.
 */
export async function appendBroadcastDraftRecord(
  record: BroadcastDraftRecord,
): Promise<void> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.broadcasts,
      record.broadcast_id,
      'broadcast.recorded',
      record,
      record.created_at,
    );
    return;
  }
  const path = broadcastsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/** readBroadcastDrafts, driver-aware. Newest first, same validity filter. */
export async function readBroadcastDraftsAsync(): Promise<
  BroadcastDraftRecord[]
> {
  if (!postgresEnabled()) return readBroadcastDrafts();
  const events = await readStreamEvents(EVENT_STREAMS.broadcasts);
  const drafts: BroadcastDraftRecord[] = [];
  for (const event of events) {
    const payload: unknown = event.payload;
    if (isBroadcastDraft(payload)) drafts.push(payload);
  }
  return drafts.reverse();
}

/**
 * computeBroadcastAudience, driver-aware. With DATABASE_URL set the
 * audience folds the 'leads' event stream (newsletter captures with
 * consent: true — the same hard gate) and the subscription event
 * stream; the injectable `sources` only apply to the JSONL driver.
 */
export async function computeBroadcastAudienceAsync(
  sources?: Parameters<typeof computeBroadcastAudience>[0],
): Promise<BroadcastAudience> {
  if (!postgresEnabled()) return computeBroadcastAudience(sources);
  const leadEvents = await readStreamEvents(EVENT_STREAMS.leads);
  const newsletter = new Set<string>();
  for (const event of leadEvents) {
    const parsed = event.payload as { email?: unknown; consent?: unknown; kind?: unknown };
    const email = normalizeSubscriptionEmail(parsed?.email);
    if (email && parsed?.kind === 'newsletter' && parsed?.consent === true) {
      newsletter.add(email);
    }
  }
  const subscribers = activeEmailsFromEntries(
    await readSubscriptionLedgerAsync(),
  );
  const union = new Set<string>([...newsletter, ...subscribers]);
  return {
    newsletter_recipients: newsletter.size,
    active_subscribers: subscribers.size,
    total_recipients: union.size,
  };
}
