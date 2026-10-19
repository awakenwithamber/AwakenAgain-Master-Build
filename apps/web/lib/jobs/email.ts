/**
 * Email jobs — provider-neutral job contracts (G9).
 *
 * Templates: purchase_confirmation, weekly_promo, unsubscribe_confirmation.
 * Unsubscribe handling: record the address in the suppression list and
 * queue a confirmation job.
 *
 * Contract shape: { id, to, template, data, queued_at, status }.
 * The EmailProvider interface sits behind a factory (createEmailProvider):
 * - RESEND bound 2026-10-19 (owner directive): when RESEND_API_KEY is set
 *   in the environment, sends go through the ResendEmailProvider and are
 *   REALLY delivered (sender from ORDERS_FROM_EMAIL; the sending domain
 *   must be verified in the owner's Resend account).
 * - When the key is absent, the factory falls back to the
 *   LoggingEmailProvider (validates, records the job, returns success —
 *   NO REAL SENDS) so local/dev/test flows never crash and never send.
 *
 * TRIGGER (wired 2026-10-19): the checkout Route Handler queues a
 * purchase_confirmation job for every accepted order via
 * lib/jobs/order-confirmation.ts, rendered by
 * lib/jobs/purchase-confirmation-email.ts (owner's Template 1).
 *
 * No PII beyond the job's own addressing (to/subject context) leaves this
 * module; analytics events for queued jobs carry job_id/template only.
 */
import { Resend } from 'resend';
import { isRecord, sanitizeEmail } from '../security/validation';
import { renderEmail } from './purchase-confirmation-email';

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
  /** Renderer detail (Template 1) — populated from the order record. */
  customer_name?: string;
  items?: { title: string; quantity: number; unit_price_cents: number }[];
  subtotal_cents?: number;
  subscriber_discount_cents?: number;
  shipping_status?: string;
  /**
   * Payment rails for the Cash App / Venmo method. Optional because a
   * Bookipi card-invoice order must NOT carry the handles — its
   * confirmation points at the emailed invoice instead (see
   * payment_method). Older jobs always carried both handles.
   */
  cash_app_handle?: string;
  venmo_handle?: string;
  /** 'cash_app_or_venmo' | 'bookipi_card_invoice' — as recorded on the order. */
  payment_method?: string;
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
/* Provider interface + implementations (Resend bound 2026-10-19)      */
/* ------------------------------------------------------------------ */

export interface SendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

/**
 * The provider contract. The factory below binds Resend when
 * RESEND_API_KEY is configured, and the logging provider otherwise.
 */
export interface EmailProvider {
  readonly name: string;
  send(job: EmailJob): Promise<SendResult>;
}

/**
 * Logging provider — the fallback when RESEND_API_KEY is not set.
 * Validates the job, records it in an in-memory outbox, and reports
 * success. NO REAL SENDS. Keeps every job contract testable in
 * local/dev/test environments.
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

/* ------------------------------------------------------------------ */
/* Resend provider (bound 2026-10-19 — owner directive)                 */
/* ------------------------------------------------------------------ */

/**
 * Default sender until the owner sets ORDERS_FROM_EMAIL. PLACEHOLDER:
 * the address/domain must be verified in the owner's Resend account
 * before real sends succeed.
 */
export const DEFAULT_ORDERS_FROM_EMAIL =
  "Amber's Alchemy Apothecary <orders@awakenagain.com>";

export function ordersFromEmail(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.ORDERS_FROM_EMAIL?.trim() || DEFAULT_ORDERS_FROM_EMAIL;
}

export interface ResendSendArgs {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type ResendSendFn = (
  args: ResendSendArgs,
) => Promise<{ id?: string | null; error?: string | null }>;

/**
 * Real delivery through Resend. The transport is a single send function
 * so tests can inject a fake — no real email is ever sent from tests.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly sendFn: ResendSendFn,
    private readonly from: string,
  ) {}

  async send(job: EmailJob): Promise<SendResult> {
    if (job.status !== 'queued') {
      return { ok: false, error: `job ${job.id} is not queued` };
    }
    const rendered = renderEmail(job);
    try {
      const result = await this.sendFn({
        from: this.from,
        to: job.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      if (result.error) return { ok: false, error: result.error };
      return {
        ok: true,
        provider_message_id: result.id ?? undefined,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Resend send failed.',
      };
    }
  }
}

/** Build the production Resend provider for an API key + sender. */
export function createResendProvider(
  apiKey: string,
  from: string,
): ResendEmailProvider {
  const client = new Resend(apiKey);
  return new ResendEmailProvider(async (args) => {
    const { data, error } = await client.emails.send(args);
    return {
      id: data?.id ?? null,
      error: error?.message ?? null,
    };
  }, from);
}

/**
 * The provider factory. RESEND_API_KEY present → real Resend delivery.
 * Absent → logging provider (never crashes, never sends). Env is read at
 * call time so configuration changes never require code changes.
 */
export function createEmailProvider(
  env: Record<string, string | undefined> = process.env,
): EmailProvider {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey) return createResendProvider(apiKey, ordersFromEmail(env));
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
