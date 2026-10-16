/**
 * Email jobs — provider-neutral job contracts (G9).
 *
 * Templates: purchase_confirmation, weekly_promo, unsubscribe_confirmation.
 * Unsubscribe handling: record the address in the suppression list and
 * queue a confirmation job.
 *
 * Contract shape: { id, to, template, data, queued_at, status }.
 * The EmailProvider interface sits behind a factory. Two implementations
 * are bound (Phase 3 Step 2, 2026-10-15): LoggingEmailProvider (validates,
 * records the job in an in-memory outbox, returns success — NO REAL SENDS)
 * is the default, and ResendEmailProvider sends for real via the Resend
 * API. The factory selects Resend ONLY when RESEND_API_KEY is set and
 * non-empty; otherwise behavior is exactly the logging preview, so
 * production is unchanged until the owner wires the key + deploys.
 *
 * No PII beyond the job's own addressing (to/subject context) leaves this
 * module; analytics events for queued jobs carry job_id/template only.
 */
import { isRecord, sanitizeEmail } from '../security/validation';
import { formatPrice } from '../pricing/pricing';
import { siteUrl } from '../seo/config';
import type { QuizResultSnapshot } from '../quiz/quiz';

/* ------------------------------------------------------------------ */
/* Job contracts                                                        */
/* ------------------------------------------------------------------ */

export type EmailTemplate =
  | 'purchase_confirmation'
  | 'weekly_promo'
  | 'unsubscribe_confirmation'
  | 'review_reminder'
  | 'quiz_results'
  | 'account_signin_code';

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

/**
 * Quiz-results email data (audit 2026-10-15 fix #2): the FULL computed
 * result snapshot from the lead record, so the send renders exactly what
 * the visitor saw. The job is built and routed through the EmailProvider
 * at lead-capture time; the provider is the logging preview (NO REAL
 * SENDS) unless RESEND_API_KEY binds Resend (Phase 3 Step 2), and
 * customer-facing copy keys off emailDeliveryIsPreview() so it never
 * claims delivery while the preview is bound.
 */
export interface QuizResultsData {
  name: string | null;
  result: QuizResultSnapshot;
}

/**
 * Account sign-in code (Phase 3 Step 3): the ONLY template whose data
 * carries a secret — the 6-digit code itself, which exists solely to be
 * delivered to the address's owner. The job is built at the route, the
 * code is never logged (the logging provider logs template + recipient
 * + job id only), never returned to the client, and never put in an
 * analytics payload.
 */
export interface AccountSigninCodeData {
  code: string;
  expires_in_minutes: number;
}

export type EmailTemplateData =
  | { template: 'purchase_confirmation'; data: PurchaseConfirmationData }
  | { template: 'weekly_promo'; data: WeeklyPromoData }
  | { template: 'unsubscribe_confirmation'; data: UnsubscribeConfirmationData }
  | { template: 'review_reminder'; data: ReviewReminderData }
  | { template: 'quiz_results'; data: QuizResultsData }
  | { template: 'account_signin_code'; data: AccountSigninCodeData };

export type EmailJobStatus = 'queued' | 'sent' | 'failed';

export interface EmailJob {
  id: string;
  to: string;
  template: EmailTemplate;
  data:
    | PurchaseConfirmationData
    | WeeklyPromoData
    | UnsubscribeConfirmationData
    | ReviewReminderData
    | QuizResultsData
    | AccountSigninCodeData;
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
/* Provider interface + bound implementations (Phase 3 Step 2)         */
/* ------------------------------------------------------------------ */

export interface SendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

/**
 * The provider contract. Implementations NEVER throw out of send() for
 * a delivery failure — they return { ok: false, error } and the call
 * sites decide what that means (the account request-code route reports
 * the delivery honestly as 'preview' and fails closed; the quiz-lead
 * route logs and keeps the lead). Nothing else changes per provider.
 */
export interface EmailProvider {
  readonly name: string;
  send(job: EmailJob): Promise<SendResult>;
}

/**
 * Logging provider — the default implementation. Validates the job,
 * records it in an in-memory outbox (reversible), and reports success.
 * NO REAL SENDS. This keeps every job contract testable and the
 * money-path honest while no real provider is bound.
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
/* Template rendering (shared by the real provider; plain text)        */
/* ------------------------------------------------------------------ */

export interface RenderedEmail {
  subject: string;
  text: string;
}

const SIGN_OFF = '\n\n— Amber\'s Alchemy Apothecary · Awaken Again';

/**
 * Render a job to subject + plain-text body. Plain text only: the
 * codebase has no HTML-email pattern to follow, and text renders
 * everywhere. The account_signin_code body carries the 6-digit code —
 * that delivery is the template's entire purpose — but the rendered
 * message exists only as the provider's outbound payload: it is never
 * logged, never persisted here, and never put in analytics.
 */
export function renderEmailMessage(job: EmailJob): RenderedEmail {
  switch (job.template) {
    case 'purchase_confirmation': {
      const d = job.data as PurchaseConfirmationData;
      return {
        subject: `Your Awaken Again order ${d.order_id} is confirmed`,
        text:
          `Thank you — your order is confirmed.\n\n` +
          `Order: ${d.order_id}\n` +
          `Items: ${d.item_summary}\n` +
          `Total: ${formatPrice(d.total_cents)}\n\n` +
          `Payment options on file for this order:\n` +
          `Cash App: ${d.cash_app_handle}\n` +
          `Venmo: ${d.venmo_handle}\n` +
          `Card: pay the secure Bookipi invoice we email you for this order.\n\n` +
          `Questions about your order? Reply to this email and we'll help.` +
          SIGN_OFF,
      };
    }
    case 'weekly_promo': {
      const d = job.data as WeeklyPromoData;
      return {
        subject: d.subject,
        text: `${d.headline}\n\n${d.body}\n\n${d.cta_url}` + SIGN_OFF,
      };
    }
    case 'unsubscribe_confirmation': {
      const d = job.data as UnsubscribeConfirmationData;
      return {
        subject: 'You are unsubscribed — Awaken Again',
        text:
          `This confirms ${job.to} was unsubscribed on ${d.suppressed_at}.\n\n` +
          `You will no longer receive promotional email from us. ` +
          `(Transactional messages about your own orders or sign-ins can still arrive.)` +
          SIGN_OFF,
      };
    }
    case 'review_reminder': {
      const d = job.data as ReviewReminderData;
      return {
        subject: `How was your ${d.product_summary}?`,
        text:
          `We hope you're enjoying your ${d.product_summary} ` +
          `(order ${d.order_id}).\n\n` +
          `If you have a moment, we'd love your honest review:\n${d.review_url}` +
          SIGN_OFF,
      };
    }
    case 'quiz_results': {
      const d = job.data as QuizResultsData;
      const r = d.result;
      const allyLines = r.allies
        .map((a) => `• ${a.name} (${a.latin}) — ${a.note}`)
        .join('\n');
      const productLines = r.productHandles
        .map((h) => `• ${siteUrl()}/shop/${h}`)
        .join('\n');
      return {
        subject: 'Your Herbal Allies quiz results — Awaken Again',
        text:
          `${d.name ? `Hello ${d.name},` : 'Hello,'}\n\n` +
          `Here are your Herbal Allies results — the same ones you saw on the site.\n\n` +
          `Focus: ${r.concernLabel}\n` +
          `Preferred form: ${r.formLabel}\n\n` +
          `Your herbal allies:\n${allyLines}\n\n` +
          `${r.productReason}\n` +
          (productLines ? `\nRecommended from the apothecary:\n${productLines}\n` : '') +
          `\nThese notes reflect traditional use and the evidence context shown ` +
          `with each ally — they are education, not medical advice.` +
          SIGN_OFF,
      };
    }
    case 'account_signin_code': {
      const d = job.data as AccountSigninCodeData;
      return {
        subject: 'Your Awaken Again sign-in code',
        text:
          `Your sign-in code is:\n\n` +
          `    ${d.code}\n\n` +
          `It expires in ${d.expires_in_minutes} minutes and can be used once.\n\n` +
          `Never share this code — we will never ask for it. If you didn't ` +
          `request a sign-in, you can ignore this email; no account changes ` +
          `were made.` +
          SIGN_OFF,
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Resend provider (Phase 3 Step 2 — owner-approved binding)            */
/* ------------------------------------------------------------------ */

export const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Default From identity. The codebase/.env.example dictate no From
 * variable, so the provider reads EMAIL_FROM when set and otherwise
 * uses this default on the Resend-verified domain (awakenagain.com —
 * owner-verified in Resend 2026-10-15).
 */
export const DEFAULT_EMAIL_FROM = 'Awaken Again <no-reply@awakenagain.com>';

export function emailFromAddress(): string {
  const from = process.env.EMAIL_FROM?.trim();
  return from ? from : DEFAULT_EMAIL_FROM;
}

export interface ResendProviderOptions {
  apiKey: string;
  /** Explicit From override; defaults to emailFromAddress() at send time. */
  from?: string;
  /** Injectable for tests — zero real network in the suite. */
  fetchFn?: typeof fetch;
}

/** Cap + sanitize a provider/network error for logs and SendResult. */
function safeProviderError(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 200) || 'unknown error';
}

async function describeResendError(response: Response): Promise<string> {
  let detail = '';
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      const name = typeof payload.name === 'string' ? payload.name : '';
      const message = typeof payload.message === 'string' ? payload.message : '';
      detail = [name, message].filter(Boolean).join(': ');
    }
  } catch {
    detail = '';
  }
  return safeProviderError(
    `resend API error (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
  );
}

/**
 * Resend provider — sends for real via the Resend API (plain fetch;
 * the resend SDK is not a dependency and none is added). It mirrors the
 * logging provider's contract exactly: same queued-job guard, same
 * { ok, provider_message_id } success shape, failures returned as
 * { ok: false, error } (never thrown), and an in-memory sent-jobs
 * record for inspection. Logs carry template + recipient + job id only
 * — never the rendered body, so the sign-in code is never logged.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private sent: EmailJob[] = [];

  constructor(private readonly options: ResendProviderOptions) {}

  async send(job: EmailJob): Promise<SendResult> {
    if (job.status !== 'queued') {
      return { ok: false, error: `job ${job.id} is not queued` };
    }
    const rendered = renderEmailMessage(job);
    const fetchFn = this.options.fetchFn ?? fetch;
    let response: Response;
    try {
      response = await fetchFn(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.options.from ?? emailFromAddress(),
          to: [job.to],
          subject: rendered.subject,
          text: rendered.text,
        }),
      });
    } catch (err) {
      const error = safeProviderError(
        err instanceof Error ? err.message : 'network error',
      );
      console.error(
        `[email] resend send failed: ${job.template} → ${job.to} (job ${job.id}): ${error}`,
      );
      return { ok: false, error };
    }
    if (!response.ok) {
      const error = await describeResendError(response);
      console.error(
        `[email] resend send failed: ${job.template} → ${job.to} (job ${job.id}): ${error}`,
      );
      return { ok: false, error };
    }
    let messageId: string | undefined;
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload) && typeof payload.id === 'string') {
        messageId = payload.id;
      }
    } catch {
      messageId = undefined;
    }
    this.sent.push({ ...job, status: 'sent', attempts: job.attempts + 1 });
    console.info(
      `[email] sent via resend: ${job.template} → ${job.to} (job ${job.id})`,
    );
    return { ok: true, provider_message_id: messageId };
  }

  /** Jobs accepted by Resend through this provider — for tests/inspection. */
  sentJobs(): readonly EmailJob[] {
    return this.sent;
  }
}

/**
 * The factory. Resend is bound ONLY when RESEND_API_KEY is set and
 * non-empty (after trim); otherwise the logging preview is returned
 * with byte-identical behavior, so nothing changes in production until
 * the owner wires the key and deploys.
 */
export function createEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) return new ResendEmailProvider({ apiKey });
  return new LoggingEmailProvider();
}

/**
 * True while the bound provider is the logging preview (NO REAL SENDS).
 * Customer-facing copy keys off this so it never claims an email was
 * delivered while delivery is unbound (the quiz honesty rule, audit
 * 2026-10-15 BROKEN-1, applied to account sign-in).
 */
export function emailDeliveryIsPreview(): boolean {
  return createEmailProvider().name === 'logging';
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

/** Account sign-in code factory — delivery via the EmailProvider only. */
export function buildAccountSigninCodeJob(
  to: unknown,
  data: AccountSigninCodeData,
): EmailJob {
  if (!/^\d{6}$/.test(data.code)) {
    throw new Error('Sign-in code job requires the 6-digit code.');
  }
  return buildEmailJob({ to, template: 'account_signin_code', data });
}

/** Quiz-results factory — the send is routed via the EmailProvider. */
export function buildQuizResultsJob(
  to: unknown,
  data: QuizResultsData,
): EmailJob {
  if (!data.result || !Array.isArray(data.result.allies)) {
    throw new Error('Quiz results email requires the computed result snapshot.');
  }
  return buildEmailJob({ to, template: 'quiz_results', data });
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
