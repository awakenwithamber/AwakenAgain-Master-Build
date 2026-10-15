/**
 * Provider-neutral lead store (G6 quiz leads, G15 newsletter).
 *
 * Contract: the app only ever depends on the `LeadStore` interface.
 * "Local JSONL now" — JsonlLeadStore appends one JSON object per line under
 * a data directory; the next store (Supabase, etc.) implements the same
 * interface. Consent is a hard requirement: no record is stored without it.
 *
 * Server-only: uses node:fs. Never import from a client component.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
} from '../events/event-store';
import type { QuizResultSnapshot } from '../quiz/quiz';

export type LeadKind = 'quiz_lead' | 'newsletter';

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
