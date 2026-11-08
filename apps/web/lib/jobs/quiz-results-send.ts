/**
 * Quiz-results email send service (owner spec 2026-11-07, ported onto
 * remote main).
 *
 * Every completed quiz sends its results email — every time, exactly
 * once per completion. The send goes through remote's provider factory
 * (lib/jobs/email.ts createEmailProvider): Resend (SDK transport, the
 * Oct-19 merge-repair binding) when RESEND_API_KEY is set, the logging
 * preview otherwise — either way the provider contract never throws
 * for a delivery failure, it returns { ok: false, error }.
 *
 * Reliability: a failed send is retried up to MAX_SEND_ATTEMPTS total
 * attempts with backoff. Retries stop at the first success, so a
 * succeeded send is never re-sent (exactly one delivered email per
 * completion). EVERY completed send is written to the email send log
 * with its final delivery status (lib/jobs/email-send-log.ts); a send
 * that still fails is logged status 'failed' (see
 * listFailedEmailSends) and reported back to the caller so the results
 * screen can be honest — the on-screen results never depend on the
 * email.
 */
import {
  buildQuizResultsJob,
  createEmailProvider,
  type EmailJob,
  type EmailProvider,
} from './email';
import { emailSendLog, type EmailSendLog } from './email-send-log';
import type { QuizResultSnapshot } from '../quiz/quiz';

export const MAX_SEND_ATTEMPTS = 3;
/** Backoff between attempts (ms): after attempt 1, then attempt 2. */
export const RETRY_DELAYS_MS: readonly number[] = [400, 1500];

export interface QuizResultsSendOutcome {
  job: EmailJob;
  /** 'sent' when the bound provider accepted the send; else 'failed'. */
  status: 'sent' | 'failed';
  /**
   * How the send was delivered: 'resend' for real delivery, 'preview'
   * when the logging provider is bound (NO real send happened). The
   * results screen keys its copy off this so it never claims delivery
   * while the preview is bound (the quiz honesty rule).
   */
  delivery: 'resend' | 'preview';
  attempts: number;
  provider: string;
  provider_message_id: string | null;
  last_error: string | null;
}

export interface QuizResultsSendDeps {
  provider?: EmailProvider;
  log?: EmailSendLog;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Send one quiz-results email with bounded retries, and log the
 * outcome. Never throws for a provider failure — the outcome object
 * carries it — but a broken job build (bad address, no snapshot) does
 * throw, because that is a programming error, not a delivery failure.
 */
export async function sendQuizResultsEmail(
  to: unknown,
  result: QuizResultSnapshot,
  name?: string | null,
  deps: QuizResultsSendDeps = {},
): Promise<QuizResultsSendOutcome> {
  const provider = deps.provider ?? createEmailProvider();
  const log = deps.log ?? emailSendLog;
  const sleep = deps.sleep ?? defaultSleep;
  const job = buildQuizResultsJob(to, { name: name ?? null, result });

  let attempts = 0;
  let lastError: string | null = null;
  let providerMessageId: string | null = null;
  let sent = false;

  while (attempts < MAX_SEND_ATTEMPTS) {
    attempts += 1;
    // A fresh queued copy per attempt: providers require status
    // 'queued' and record their own attempt count on accepted copies.
    const res = await provider.send({
      ...job,
      status: 'queued',
      attempts: attempts - 1,
    });
    if (res.ok) {
      sent = true;
      providerMessageId = res.provider_message_id ?? null;
      lastError = null;
      break; // exactly one delivered email — never retry a success
    }
    lastError = res.error ?? 'Provider send failed.';
    if (attempts < MAX_SEND_ATTEMPTS) {
      await sleep(RETRY_DELAYS_MS[attempts - 1] ?? 1500);
    }
  }

  const outcome: QuizResultsSendOutcome = {
    job,
    status: sent ? 'sent' : 'failed',
    delivery: provider.name === 'logging' ? 'preview' : 'resend',
    attempts,
    provider: provider.name,
    provider_message_id: providerMessageId,
    last_error: lastError,
  };

  try {
    await log.append({
      job_id: job.id,
      to: job.to,
      template: job.template,
      provider: provider.name,
      provider_message_id: providerMessageId,
      status: outcome.status,
      attempts,
      last_error: lastError,
      at: new Date().toISOString(),
    });
  } catch {
    // The log must never take down the send path; the outcome object
    // still reports the truth to the caller.
  }

  return outcome;
}
