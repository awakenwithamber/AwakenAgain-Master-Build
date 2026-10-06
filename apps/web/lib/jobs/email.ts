/**
 * Email jobs — provider-neutral job contracts (G9).
 *
 * Templates: purchase_confirmation, weekly_promo, unsubscribe_confirmation.
 * Unsubscribe handling: record the address in the suppression list and
 * queue a confirmation job.
 *
 * Contract shape: { id, to, template, data, queued_at, status }.
 * The EmailProvider interface sits behind a factory; the ONLY bound
 * implementation is LoggingEmailProvider (validates, persists the job to a
 * local JSONL ledger, returns success) — NO REAL SENDS. A real provider
 * (Resend or other — UNDECIDED, NEEDS VERIFICATION) binds later behind the
 * interface; swapping the factory is the only change required.
 *
 * No PII beyond the job's own addressing (to/subject context) leaves this
 * module; analytics events for queued jobs carry job_id/template only.
 */
import { isRecord, sanitizeEmail } from '../security/validation';

/* ------------------------------------------------------------------ */
/* Job contracts                                                        */
/* ------------------------------------------------------------------ */

export type EmailTemplate =
  | 'purchase_confirmation'
  | 'weekly_promo'
  | 'unsubscribe_confirmation'
  | 'review_reminder';

export interface PurchaseConfirmationData {
  order_id: string;
  total_cents: number;
  item_summary: string;
  cash_app_handle: string;
  venmo_handle: string;
}

export interface WeeklyPromoData {
  subject: string;
  headline: string;
  body: string;
  cta_url: string;
}

export interface UnsubscribeConfirmationData {
  suppressed_at: string;
}

export interface ReviewReminderData {
  order_id: string;
  product_summary: string;
  review_url: string;
}

export type EmailTemplateData =
  | { template: 'purchase_confirmation'; data: PurchaseConfirmationData }
  | { template: 'weekly_promo'; data: WeeklyPromoData }
  | { template: 'unsubscribe_confirmation'; data: UnsubscribeConfirmationData }
  | { template: 'review_reminder'; data: ReviewReminderData };

export type EmailJobStatus = 'queued' | 'sent' | 'failed';

export interface EmailJob {
  id: string;
  to: string;
  template: EmailTemplate;
  data:
    | PurchaseConfirmationData
    | WeeklyPromoData
    | UnsubscribeConfirmationData
    | ReviewReminderData;
  queued_at: string;
  status: EmailJobStatus;
  attempts: number;
  last_error: string | null;
}

export interface EmailJobInput {
  to: unknown;
  template: EmailTemplateData['template'];
  data: EmailTemplateData['data'];
}

function generateJobId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EMAIL-${date}-${rand}`;
}

/**
 * Validate an email-job input and build a queued job. Throws a
 * human-readable Error on invalid input. The template/data shape is
 * enforced by TypeScript; runtime checks verify addressing + presence.
 */
export function buildEmailJob(input: EmailJobInput): EmailJob {
  const to = sanitizeEmail(input.to);
  if (!to) throw new Error('Email job requires a valid recipient address.');
  if (!isRecord(input.data as unknown)) {
    throw new Error('Email job requires a data object.');
  }
  return {
    id: generateJobId(),
    to,
    template: input.template,
    data: input.data,
    queued_at: new Date().toISOString(),
    status: 'queued',
    attempts: 0,
    last_error: null,
  };
}

/* ------------------------------------------------------------------ */
/* Provider interface (bind Resend/another later — UNDECIDED)           */
/* ------------------------------------------------------------------ */

export interface SendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

/**
 * The provider contract. A real provider (Resend or other — NEEDS
 * VERIFICATION) implements this interface and replaces the factory
 * binding below. Nothing else changes.
 */
export interface EmailProvider {
  readonly name: string;
  send(job: EmailJob): Promise<SendResult>;
}

/**
 * Logging provider — the ONLY bound implementation. Validates the job,
 * writes it to a local JSONL outbox ledger (reversible), and reports
 * success. NO REAL SENDS. This keeps every job contract testable and the
 * money-path honest until a provider is approved and bound.
 */
export class LoggingEmailProvider implements EmailProvider {
  readonly name = 'logging';
  private outbox: EmailJob[] = [];

  async send(job: EmailJob): Promise<SendResult> {
    if (job.status !== 'queued') {
      return { ok: false, error: `job ${job.id} is not queued` };
    }
    this.outbox.push({ ...job, status: 'sent', attempts: job.attempts + 1 });
    console.info(
      `[email] PREVIEW (no provider bound): queued ${job.template} → ${job.to} (job ${job.id})`,
    );
    return { ok: true, provider_message_id: `preview-${job.id}` };
  }

  /** Jobs "sent" through the logging provider — for tests and inspection. */
  sentJobs(): readonly EmailJob[] {
    return this.outbox;
  }
}

export function createEmailProvider(): EmailProvider {
  return new LoggingEmailProvider();
}

/* ------------------------------------------------------------------ */
/* Unsubscribe handling                                                 */
/* ------------------------------------------------------------------ */

/**
 * Suppression list contract. In-memory now; the durable binding (database
 * table with one-click tokenized links) is NEEDS VERIFICATION.
 */
export class InMemorySuppressionList {
  private suppressed = new Set<string>();

  add(email: string): void {
    this.suppressed.add(email.toLowerCase().trim());
  }

  has(email: string): boolean {
    return this.suppressed.has(email.toLowerCase().trim());
  }
}

/**
 * Handle an unsubscribe request: validate the address, add it to the
 * suppression list, and return a confirmation job. Weekly promos MUST be
 * filtered through the suppression list before queueing (enforced in
 * buildWeeklyPromoJob below).
 */
export function handleUnsubscribe(
  suppressionList: InMemorySuppressionList,
  emailInput: unknown,
): EmailJob {
  const email = sanitizeEmail(emailInput);
  if (!email) throw new Error('A valid email address is required to unsubscribe.');
  suppressionList.add(email);
  return buildEmailJob({
    to: email,
    template: 'unsubscribe_confirmation',
    data: { suppressed_at: new Date().toISOString() },
  });
}

/** Weekly-promo factory — refuses to queue for suppressed addresses. */
export function buildWeeklyPromoJob(
  suppressionList: InMemorySuppressionList,
  to: unknown,
  data: WeeklyPromoData,
): EmailJob {
  const email = sanitizeEmail(to);
  if (!email) throw new Error('Email job requires a valid recipient address.');
  if (suppressionList.has(email)) {
    throw new Error('Address is unsubscribed — promo not queued.');
  }
  return buildEmailJob({ to: email, template: 'weekly_promo', data });
}

/* ------------------------------------------------------------------ */
/* Convenience factories for the queueing call sites                    */
/* ------------------------------------------------------------------ */

export function buildPurchaseConfirmationJob(
  to: unknown,
  data: PurchaseConfirmationData,
): EmailJob {
  if (!data.order_id || data.total_cents < 0 || !data.item_summary) {
    throw new Error('Purchase confirmation requires order_id, total_cents, item_summary.');
  }
  return buildEmailJob({ to, template: 'purchase_confirmation', data });
}

export function buildReviewReminderJob(
  suppressionList: InMemorySuppressionList,
  to: unknown,
  data: ReviewReminderData,
): EmailJob {
  const email = sanitizeEmail(to);
  if (!email) throw new Error('Email job requires a valid recipient address.');
  if (suppressionList.has(email)) {
    throw new Error('Address is unsubscribed — reminder not queued.');
  }
  return buildEmailJob({ to: email, template: 'review_reminder', data });
}
