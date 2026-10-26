/**
 * Email jobs — provider-neutral job contracts (G9).
 *
 * Templates: purchase_confirmation, weekly_promo, unsubscribe_confirmation,
 * review_reminder, quiz_results, account_signin_code.
 * Unsubscribe handling: record the address in the suppression list and
 * queue a confirmation job.
 *
 * Contract shape: { id, to, template, data, queued_at, status }.
 *
 * MERGE REPAIR (2026-10-19): this module carries BOTH Resend bindings,
 * because the 2026-10-19 go-live push overwrote the Phase 3 version of
 * this file with a build from an older local base and production builds
 * broke (missing exports). Nothing from either binding was dropped:
 *
 * - Phase 3 Step 2 (2026-10-15): the factory selects Resend ONLY when
 *   RESEND_API_KEY is set and non-empty; otherwise the logging preview.
 *   ResendEmailProvider's options form ({ apiKey, from?, fetchFn? })
 *   posts the plain-text renderEmailMessage() output to the Resend API
 *   via fetch — the form the account sign-in and quiz flows (and their
 *   tests) are pinned to, including DEFAULT_EMAIL_FROM / EMAIL_FROM
 *   sender resolution and emailDeliveryIsPreview() honesty checks.
 * - 2026-10-19 (owner directive): the factory binds the `resend` SDK
 *   transport (createResendProvider) with the ORDERS_FROM_EMAIL sender
 *   (ordersFromEmail), and purchase_confirmation jobs sent through that
 *   transport render via the owner's Template 1
 *   (lib/jobs/purchase-confirmation-email.ts — subject/text/html).
 *   TRIGGER: the checkout Route Handler queues a purchase_confirmation
 *   job for every accepted order via lib/jobs/order-confirmation.ts.
 *
 * No PII beyond the job's own addressing (to/subject context) leaves this
 * module; analytics events for queued jobs carry job_id/template only.
 */
import { Resend } from 'resend';
import { isRecord, sanitizeEmail } from '../security/validation';
import { createLogger } from '../observability/logger';

const log = createLogger('jobs:email');
import { formatPrice } from '../pricing/pricing';
import { siteUrl } from '../seo/config';
import type { QuizResultSnapshot } from '../quiz/quiz';
import { renderEmail } from './purchase-confirmation-email';

/* ------------------------------------------------------------------ */
/* Job contracts                                                        */
/* ------------------------------------------------------------------ */

export type EmailTemplate =
  | 'purchase_confirmation'
  | 'weekly_promo'
  | 'unsubscribe_confirmation'
  | 'review_reminder'
  | 'quiz_results'
  | 'account_signin_code'
  | 'contact_received';

export interface PurchaseConfirmationData {
  order_id: string;
  total_cents: number;
  item_summary: string;
  /** Renderer detail (Template 1) — populated from the order record. */
  customer_name?: string;
  items?: { title: string; quantity: number; unit_price_cents: number }[];
  subtotal_cents?: number;
  subscriber_discount_cents?: number;
  /** FIRST10 coupon (2026-10-24) — populated from the order record when a coupon applied. */
  coupon_code?: string | null;
  coupon_discount_cents?: number;
  shipping_status?: string;
  /**
   * Payment rails for the Cash App / Venmo method. Optional because an
   * embedded-card order must NOT carry the handles — its confirmation
   * points at the on-site card payment instead (see payment_method).
   * Older jobs always carried both handles.
   */
  cash_app_handle?: string;
  venmo_handle?: string;
  /** Payment method as recorded on the order. */
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

/**
 * Contact auto-response (2026-10-25): the confirmation sent to a contact
 * form sender after their message is persisted. Data carries only the
 * sender's name for the greeting — the message text is never copied
 * into the auto-response.
 */
export interface ContactReceivedData {
  name: string;
}

export type EmailTemplateData =
  | { template: 'purchase_confirmation'; data: PurchaseConfirmationData }
  | { template: 'weekly_promo'; data: WeeklyPromoData }
  | { template: 'unsubscribe_confirmation'; data: UnsubscribeConfirmationData }
  | { template: 'review_reminder'; data: ReviewReminderData }
  | { template: 'quiz_results'; data: QuizResultsData }
  | { template: 'account_signin_code'; data: AccountSigninCodeData }
  | { template: 'contact_received'; data: ContactReceivedData };

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
    | AccountSigninCodeData
    | ContactReceivedData;
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
    // Stage 5: structured log via lib/observability/logger (the
    // recipient address is email-masked by the logger's redaction).
    log.info('email preview (no provider bound): job queued', {
      template: job.template,
      to: job.to,
      job_id: job.id,
    });
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
 * account_signin_code body carries the 6-digit code — that delivery is
 * the template's entire purpose — but the rendered message exists only
 * as the provider's outbound payload: it is never logged, never
 * persisted here, and never put in analytics.
 */
export function renderEmailMessage(job: EmailJob): RenderedEmail {
  switch (job.template) {
    case 'purchase_confirmation': {
      const d = job.data as PurchaseConfirmationData;
      const handleLines = [
        ...(d.cash_app_handle ? [`Cash App: ${d.cash_app_handle}`] : []),
        ...(d.venmo_handle ? [`Venmo: ${d.venmo_handle}`] : []),
      ];
      return {
        subject: `Your Awaken Again order ${d.order_id} is confirmed`,
        text:
          `Thank you — your order is confirmed.\n\n` +
          `Order: ${d.order_id}\n` +
          `Items: ${d.item_summary}\n` +
          `Total: ${formatPrice(d.total_cents)}\n\n` +
          `Payment options on file for this order:\n` +
          (handleLines.length > 0 ? `${handleLines.join('\n')}\n` : '') +
          (d.payment_method === 'stripe_card_embedded'
            ? `Card: complete your card payment in the secure checkout on our website.\n\n`
            : '') +
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
    case 'contact_received': {
      const d = job.data as ContactReceivedData;
      return {
        subject: "We've received your message ✦ Amber's Alchemy Apothecary",
        text:
          `Hello ${d.name},\n\n` +
          `Thank you for reaching out to Amber's Alchemy Apothecary. This note is ` +
          `your confirmation that your message has been received.\n\n` +
          `Amber reads every message personally — no call center, no robots reading ` +
          `your words. She will respond just as soon as she is able.\n\n` +
          `Need a faster reply? Text Amber at 801-819-6795 — a text usually reaches ` +
          `her sooner than email.\n\n` +
          `With gratitude,\n` +
          `Amber's Alchemy Apothecary — Awaken With Amber LLC\n` +
          `awakenagain.com`,
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
/* Resend provider (Phase 3 Step 2 + 2026-10-19 SDK transport)         */
/* ------------------------------------------------------------------ */

export const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Default From identity for the fetch-form provider. The provider reads
 * EMAIL_FROM when set and otherwise uses this default on the
 * Resend-verified domain (awakenagain.com — owner-verified in Resend
 * 2026-10-15).
 */
export const DEFAULT_EMAIL_FROM = 'Awaken Again <no-reply@awakenagain.com>';

export function emailFromAddress(): string {
  const from = process.env.EMAIL_FROM?.trim();
  return from ? from : DEFAULT_EMAIL_FROM;
}

/**
 * Default sender for the SDK transport (2026-10-19) until the owner sets
 * ORDERS_FROM_EMAIL. The address/domain must be verified in the owner's
 * Resend account before real sends succeed (awakenagain.com is).
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

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render for the SDK transport: purchase_confirmation jobs use the
 * owner's Template 1 renderer (subject/text/html); every other template
 * uses the plain-text renderEmailMessage() output (the Phase 3 copy the
 * account/quiz flows are pinned to) wrapped in a minimal HTML shell so
 * the transport always carries an html part.
 */
function renderForTransport(job: EmailJob): {
  subject: string;
  text: string;
  html: string;
} {
  if (job.template === 'purchase_confirmation') {
    return renderEmail(job);
  }
  const plain = renderEmailMessage(job);
  return {
    subject: plain.subject,
    text: plain.text,
    html:
      '<div style="background:#2a1a40;color:#f3e9d2;font-family:Georgia,serif;padding:32px 24px;">' +
      `<p style="white-space:pre-wrap;">${escapeHtmlText(plain.text)}</p></div>`,
  };
}

/**
 * Resend provider — sends for real via Resend. Two construction forms,
 * one per binding era (see the module header):
 *
 * - Options form (Phase 3 Step 2): `new ResendEmailProvider({ apiKey,
 *   from?, fetchFn? })` posts renderEmailMessage() output to the Resend
 *   API with plain fetch (no SDK). Failures return { ok: false, error }
 *   (never thrown); logs carry template + recipient + job id only —
 *   never the rendered body, so the sign-in code is never logged.
 * - Transport form (2026-10-19): `new ResendEmailProvider(sendFn, from)`
 *   sends through an injected ResendSendFn (the production instance is
 *   built by createResendProvider over the `resend` SDK) and renders
 *   purchase confirmations via Template 1.
 *
 * Both forms mirror the logging provider's contract: same queued-job
 * guard, same { ok, provider_message_id } success shape, and an
 * in-memory sent-jobs record for inspection.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private sent: EmailJob[] = [];
  private readonly sendFn: ResendSendFn | null;
  private readonly sendFrom: string | null;
  private readonly options: ResendProviderOptions | null;

  constructor(sendFn: ResendSendFn, from: string);
  constructor(options: ResendProviderOptions);
  constructor(
    sendFnOrOptions: ResendSendFn | ResendProviderOptions,
    from?: string,
  ) {
    if (typeof sendFnOrOptions === 'function') {
      this.sendFn = sendFnOrOptions;
      this.sendFrom = from ?? ordersFromEmail();
      this.options = null;
    } else {
      this.sendFn = null;
      this.sendFrom = null;
      this.options = sendFnOrOptions;
    }
  }

  async send(job: EmailJob): Promise<SendResult> {
    if (job.status !== 'queued') {
      return { ok: false, error: `job ${job.id} is not queued` };
    }
    if (this.sendFn) return this.sendViaTransport(job);
    return this.sendViaApi(job);
  }

  /** Transport form (2026-10-19): injected send function, Template 1. */
  private async sendViaTransport(job: EmailJob): Promise<SendResult> {
    const rendered = renderForTransport(job);
    try {
      const result = await this.sendFn!({
        from: this.sendFrom ?? ordersFromEmail(),
        to: job.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      if (result.error) return { ok: false, error: result.error };
      this.sent.push({ ...job, status: 'sent', attempts: job.attempts + 1 });
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

  /** Options form (Phase 3 Step 2): plain fetch to the Resend API. */
  private async sendViaApi(job: EmailJob): Promise<SendResult> {
    const options = this.options!;
    const rendered = renderEmailMessage(job);
    const fetchFn = options.fetchFn ?? fetch;
    let response: Response;
    try {
      response = await fetchFn(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from ?? emailFromAddress(),
          to: [job.to],
          subject: rendered.subject,
          text: rendered.text,
        }),
      });
    } catch (err) {
      const error = safeProviderError(
        err instanceof Error ? err.message : 'network error',
      );
      log.error('resend send failed', {
        template: job.template,
        to: job.to,
        job_id: job.id,
        error,
      });
      return { ok: false, error };
    }
    if (!response.ok) {
      const error = await describeResendError(response);
      log.error('resend send failed', {
        template: job.template,
        to: job.to,
        job_id: job.id,
        error,
      });
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
    log.info('email sent via resend', {
      template: job.template,
      to: job.to,
      job_id: job.id,
    });
    return { ok: true, provider_message_id: messageId };
  }

  /** Jobs accepted by Resend through this provider — for tests/inspection. */
  sentJobs(): readonly EmailJob[] {
    return this.sent;
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
 * The provider factory. RESEND_API_KEY present (set and non-empty after
 * trim) → real Resend delivery through the SDK transport, sender from
 * ORDERS_FROM_EMAIL. Absent → the logging preview, so local/dev/test
 * flows never crash and never send. Env is read at call time so
 * configuration changes never require code changes.
 */
export function createEmailProvider(
  env: Record<string, string | undefined> = process.env,
): EmailProvider {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey) return createResendProvider(apiKey, ordersFromEmail(env));
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

/** Contact auto-response factory — the send is routed via the EmailProvider. */
export function buildContactReceivedJob(
  to: unknown,
  data: ContactReceivedData,
): EmailJob {
  if (!data.name?.trim()) {
    throw new Error('Contact auto-response requires the sender name.');
  }
  return buildEmailJob({ to, template: 'contact_received', data });
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
