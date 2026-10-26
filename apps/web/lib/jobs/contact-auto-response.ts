/**
 * Contact auto-response trigger (2026-10-25) — mirrors
 * lib/jobs/order-confirmation.ts.
 *
 * After a contact message is PERSISTED, the sender gets a confirmation
 * email (copy pack §5): "We've received your message ✦ …". The job is
 * built from the sanitized contact record (name + email only — the
 * message text never enters the auto-response).
 *
 * Delivery honesty, same rule as the quiz/account flows: the provider
 * factory binds Resend only when RESEND_API_KEY is set. When no real
 * provider is configured, this SKIPS silently — the visitor's message
 * is still stored and the on-site success message stands on its own,
 * and no one is told a confirmation email is coming when none is.
 *
 * The send can never fail the contact request: every failure path
 * (unconfigured provider, provider error, thrown exception) resolves
 * to a { sent: false } result for logging, never a rejection.
 */
import {
  buildContactReceivedJob,
  createEmailProvider,
  type EmailProvider,
} from './email';
import { createLogger } from '../observability/logger';

const log = createLogger('jobs:contact-auto-response');

export interface ContactAutoResponseResult {
  sent: boolean;
  reason?: 'provider_unconfigured' | 'provider_error' | 'send_failed';
}

/**
 * Send the auto-response for an accepted contact message. Awaitable for
 * tests; the contact route calls it fire-and-forget.
 */
export async function sendContactAutoResponse(
  record: { name: string; email: string },
  provider: EmailProvider = createEmailProvider(),
): Promise<ContactAutoResponseResult> {
  // The logging preview means NO real provider is configured — skip
  // silently rather than "sending" into a preview outbox and claiming
  // a confirmation is on its way.
  if (provider.name === 'logging') {
    return { sent: false, reason: 'provider_unconfigured' };
  }
  try {
    const job = buildContactReceivedJob(record.email, { name: record.name });
    const result = await provider.send(job);
    if (!result.ok) {
      log.error('contact auto-response failed', {
        job_id: job.id,
        error: result.error ?? 'unknown error',
      });
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true };
  } catch (err) {
    log.error('contact auto-response threw', {
      error: err instanceof Error ? err.message : 'unknown error',
    });
    return { sent: false, reason: 'send_failed' };
  }
}
