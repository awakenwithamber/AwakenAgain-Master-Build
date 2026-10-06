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

export type LeadKind = 'quiz_lead' | 'newsletter';

export interface LeadRecord {
  id: string;
  kind: LeadKind;
  email: string;
  name: string | null;
  consent: true;
  consentAt: string;
  metadata: Record<string, string | number | boolean>;
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

/** Shared instance for Route Handlers. */
export const leadStore: LeadStore = new JsonlLeadStore();
