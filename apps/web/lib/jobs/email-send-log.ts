/**
 * Email send log — the persistent delivery record (owner spec
 * 2026-11-07, ported onto remote main: "Log every send with its
 * delivery status… show me any that still fail").
 *
 * One JSONL line per completed send (after any retries resolve):
 * recipient, template, provider, provider message id, final status,
 * attempt count, and the last error when it failed. Sends that still
 * fail after retries stay in the log as status 'failed' and are
 * surfaced by listFailedEmailSends() — the owner-facing failure list.
 *
 * Provider-neutral interface + local JSONL implementation, following
 * the LeadStore pattern (lib/leads/lead-store.ts, including the
 * env-resolved directory). Server-only: uses node:fs.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmailTemplate } from './email';

export interface EmailSendRecord {
  /** The EmailJob id (EMAIL-YYYYMMDD-XXXXXX). */
  job_id: string;
  to: string;
  template: EmailTemplate;
  /** Provider name that attempted delivery ('resend' | 'logging'). */
  provider: string;
  provider_message_id: string | null;
  status: 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  /** ISO timestamp of the final attempt's outcome. */
  at: string;
}

export interface EmailSendLog {
  append(record: EmailSendRecord): Promise<void>;
  readAll(): Promise<EmailSendRecord[]>;
}

/** Resolves at call time so tests can point it at a tmp dir via env. */
function logDir(): string {
  return (
    process.env.EMAIL_SEND_LOG_DIR ??
    join(process.cwd(), 'data', 'email-sends')
  );
}

function logFile(): string {
  return join(logDir(), 'email-sends.jsonl');
}

export class JsonlEmailSendLog implements EmailSendLog {
  async append(record: EmailSendRecord): Promise<void> {
    await mkdir(logDir(), { recursive: true });
    await appendFile(logFile(), JSON.stringify(record) + '\n', 'utf8');
  }

  async readAll(): Promise<EmailSendRecord[]> {
    let raw: string;
    try {
      raw = await readFile(logFile(), 'utf8');
    } catch {
      return [];
    }
    const records: EmailSendRecord[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed) as EmailSendRecord);
      } catch {
        // A torn final line (crash mid-append) must not break the log.
      }
    }
    return records;
  }
}

/** The app-wide send log instance (JSONL today, same pattern as leads). */
export const emailSendLog: EmailSendLog = new JsonlEmailSendLog();

/**
 * The owner-facing failure surface: every send that still failed after
 * its retries, newest last. The raw records also live in
 * data/email-sends/email-sends.jsonl.
 */
export async function listFailedEmailSends(
  log: EmailSendLog = emailSendLog,
): Promise<EmailSendRecord[]> {
  const all = await log.readAll();
  return all.filter((r) => r.status === 'failed');
}
