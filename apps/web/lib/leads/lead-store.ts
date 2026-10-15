/**
 * Provider-neutral lead store (G6 quiz leads, G15 newsletter,
 * affiliate-interest + partner-idea captures since 2026-10-15).
 *
 * Contract: the app only ever depends on the `LeadStore` interface.
 * "Local JSONL now" — JsonlLeadStore appends one JSON object per line under
 * a data directory; the next store (Supabase, etc.) implements the same
 * interface. Consent is a hard requirement: no record is stored without it.
 *
 * Server-only: uses node:fs. Never import from a client component.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';
import type { QuizResultSnapshot } from '../quiz/quiz';

/**
 * Lead kinds. The 2026-10-15 get-involved build (audit fix #8) added
 * 'affiliate_interest' (/network) and 'partner_idea' (/partner) on the
 * same pattern: consent-gated, one append per capture, stored verbatim
 * by both drivers. Broadcast audience reads 'newsletter' only — the
 * new kinds are never emailed as a list.
 */
export type LeadKind =
  | 'quiz_lead'
  | 'newsletter'
  | 'affiliate_interest'
  | 'partner_idea';

export interface LeadRecord {
  id: string;
  kind: LeadKind;
  email: string;
  name: string | null;
  consent: true;
  consentAt: string;
  metadata: Record<string, string | number | boolean>;
  /**
   * Full computed quiz result (quiz_lead only) — the allies and product
   * recommendations the visitor actually saw (audit 2026-10-15 BROKEN-1).
   * Both store implementations persist the whole record verbatim (JSONL
   * line / event payload), so driver parity is automatic.
   */
  quizResult?: QuizResultSnapshot;
  capturedAt: string;
  /** Migration source tag — same convention as PostHog events. */
  source: 'nextjs';
}

export interface LeadStore {
  append(record: Omit<LeadRecord, 'id' | 'capturedAt' | 'source'>): Promise<LeadRecord>;
}

/** Resolves at call time so tests can point it at a tmp dir via env. */
function storeDir(): string {
  return (
    process.env.LEAD_STORE_DIR ??
    join(process.cwd(), 'data', 'leads')
  );
}

/**
 * Local JSONL implementation: `<dir>/<kind>.jsonl`, one record per line.
 * Append-only — records are never edited in place (GDPR-style erasure is a
 * future provider's job; the interface hides the storage choice).
 */
export class JsonlLeadStore implements LeadStore {
  async append(
    record: Omit<LeadRecord, 'id' | 'capturedAt' | 'source'>,
  ): Promise<LeadRecord> {
    const full: LeadRecord = {
      ...record,
      id: randomUUID(),
      capturedAt: new Date().toISOString(),
      source: 'nextjs',
    };
    const dir = storeDir();
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, `${full.kind}.jsonl`), JSON.stringify(full) + '\n', 'utf8');
    return full;
  }
}

/**
 * Postgres implementation (Phase 3 Step 1): leads become events in the
 * 'leads' stream, keyed by normalized email, one event per capture —
 * the same append-only shape as the JSONL files. Record construction
 * (id, capturedAt, source tag) is identical to JsonlLeadStore.
 */
export class PgLeadStore implements LeadStore {
  async append(
    record: Omit<LeadRecord, 'id' | 'capturedAt' | 'source'>,
  ): Promise<LeadRecord> {
    const full: LeadRecord = {
      ...record,
      id: randomUUID(),
      capturedAt: new Date().toISOString(),
      source: 'nextjs',
    };
    await appendEvent(
      EVENT_STREAMS.leads,
      full.email.trim().toLowerCase(),
      `lead.${full.kind}`,
      full,
      full.capturedAt,
    );
    return full;
  }
}

const jsonlLeadStore = new JsonlLeadStore();
const pgLeadStore = new PgLeadStore();

/**
 * Shared instance for Route Handlers. Driver selection happens at CALL
 * time (Phase 3 Step 1): DATABASE_URL set → Postgres event store;
 * unset → JSONL, byte-identical to before. Constructing either store
 * connects to nothing.
 */
export const leadStore: LeadStore = {
  append: (record) =>
    (postgresEnabled() ? pgLeadStore : jsonlLeadStore).append(record),
};

/* ------------------------------------------------------------------ */
/* Reads (Phase 3 Step 3: profile linking + account data export)       */
/* ------------------------------------------------------------------ */

const LEAD_KINDS: readonly LeadKind[] = [
  'quiz_lead',
  'newsletter',
  'affiliate_interest',
  'partner_idea',
];

/** A stored object counts as a lead for the email when kind + normalized email match. */
function leadRecordFromParsed(parsed: unknown, email: string): LeadRecord | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const record = parsed as LeadRecord;
  if (!LEAD_KINDS.includes(record.kind)) return null;
  if (typeof record.email !== 'string') return null;
  if (record.email.trim().toLowerCase() !== email) return null;
  return record;
}

/**
 * Every lead stored for one normalized email, in append order, from
 * either driver — the read side profiles use to LINK past quiz captures
 * to an account (the lead records themselves are never copied or
 * mutated) and the account export uses for completeness. Missing files
 * and malformed lines are tolerated in the codebase's ledger style.
 */
export async function readLeadsForEmailAsync(
  emailInput: unknown,
): Promise<LeadRecord[]> {
  const email =
    typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
  if (!email) return [];
  if (postgresEnabled()) {
    const events = await readStreamEvents(EVENT_STREAMS.leads);
    const records: LeadRecord[] = [];
    for (const event of events) {
      if (event.stream_key !== email) continue;
      const record = leadRecordFromParsed(event.payload, email);
      if (record) records.push(record);
    }
    return records;
  }
  const records: LeadRecord[] = [];
  for (const kind of LEAD_KINDS) {
    let raw: string;
    try {
      raw = readFileSync(join(storeDir(), `${kind}.jsonl`), 'utf8');
    } catch {
      continue; // no captures of this kind yet
    }
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = leadRecordFromParsed(JSON.parse(trimmed), email);
        if (record) records.push(record);
      } catch {
        // skip malformed line
      }
    }
  }
  return records;
}
